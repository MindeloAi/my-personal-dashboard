// client-timeline.test.ts — acceptance checks for the client timeline (migration 015).
//
// Runs against a THROWAWAY database. It deletes every client_entries and
// client_promises row between checks, so it refuses to run against anything
// that is not localhost.
//
//   docker run -d --name timeline-pg -e POSTGRES_PASSWORD=pg -p 55433:5432 postgres:17
//   docker exec timeline-pg psql -U postgres -c "create role anon; create role authenticated;"
//   docker exec -i timeline-pg psql -U postgres < scripts/schema.sql
//   DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/011_founder_ledger.up.sql   # then 012, 013, 015
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres npx tsx scripts/client-timeline.test.ts

import postgres from "postgres";
import { closeDb } from "../src/lib/db";
import {
  addDays,
  dueState,
  entryTag,
  groupDiamonds,
  groupDots,
  lineWindow,
  litFromEntry,
  litFromItems,
  movedFrom,
  owedItems,
  pct,
  type ClientPromise,
  type TimelineEntry,
  type UnpaidInvoice,
} from "../src/lib/timeline";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}

// Same numeric/date parsing as db.ts, so values compare as numbers and "YYYY-MM-DD".
const sql = postgres(url, {
  prepare: false,
  max: 1,
  onnotice: () => {},
  types: {
    num: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    d: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
  },
});
const TODAY = "2026-10-23";
const ZANE = "admin@example.test";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

// replaced_by points at the same table, so clear it before deleting promises.
async function reset() {
  await sql.begin(async (tx) => {
    await tx`update client_promises set replaced_by = null, status = 'open', closed_on = null`;
    await tx`delete from client_promises`;
    await tx`delete from client_entries`;
    await tx`delete from clients where name like 'Test Client%'`;
  });
}

type Failure = { code: string; constraint: string; message: string };

// Returns null when the statement succeeds, otherwise the Postgres error fields, so a
// check can require the exact error and not just any error.
async function fails(run: () => Promise<unknown>): Promise<Failure | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const err = e as { code?: string; constraint_name?: string; message?: string };
    return { code: err.code ?? "", constraint: err.constraint_name ?? "", message: err.message ?? String(e) };
  }
}

const deepEq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const describeFailure = (f: Failure | null) => (f ? `${f.code} ${f.constraint} ${f.message}` : "no error");

async function main() {
  let failed = false;
  try {
    // ---- Pure timeline logic ----
    {
      const entry = (id: string, occurredOn: string, direction: TimelineEntry["direction"]): TimelineEntry => ({
        id, clientId: "c1", occurredOn, kind: "email", direction, summary: "Test entry",
        people: null, body: null, link: null, createdBy: ZANE, created: "2026-10-01T00:00:00Z",
      });
      const prom = (id: string, o: Partial<ClientPromise> = {}): ClientPromise => ({
        id, clientId: "c1", entryId: null, owedBy: "client", what: "Send the draft", dueOn: null,
        status: "open", replacedBy: null, closedOn: null, closedBy: null, closedEntryId: null,
        note: null, createdBy: ZANE, created: "2026-10-01T00:00:00Z", ...o,
      });
      const w = lineWindow(TODAY, []);

      check("addDays crosses a month", addDays("2026-10-30", 3) === "2026-11-02");
      check("due none", dueState(null, TODAY).kind === "none");
      check("due today is soon", deepEq(dueState("2026-10-23", TODAY), { kind: "soon", days: 0 }));
      check("due in 7 days is soon", dueState("2026-10-30", TODAY).kind === "soon");
      check("due in 8 days is future", deepEq(dueState("2026-10-31", TODAY), { kind: "future", days: 8 }));
      check("due yesterday is late by 1", deepEq(dueState("2026-10-22", TODAY), { kind: "late", days: 1 }));
      check("window with nothing", deepEq(w, { start: "2026-09-08", end: "2026-11-22" }));
      check("window reaches an old late item", lineWindow(TODAY, [{ date: "2026-08-28", late: true }]).start === "2026-08-28");
      check("window ends 7 days past the last due date", lineWindow(TODAY, [{ date: "2026-12-07", late: false }]).end === "2026-12-14");
      check("pct of start is 0 and end is 100", pct(w.start, w) === 0 && pct(w.end, w) === 100);
      check("pct clamps outside the window", pct("2020-01-01", w) === 0 && pct("2030-01-01", w) === 100);

      const e1 = entry("e1", "2026-10-10", "sent");
      const e2 = entry("e2", "2026-10-10", "received");
      check("same-day entries share a dot", groupDots([e1, e2], w).length === 1);
      check("mixed directions on one day are 'both'", groupDots([e1, e2], w)[0].direction === "both");
      check("entries before the window have no dot", groupDots([entry("e0", "2026-01-01", "sent")], w).length === 0);

      check(
        "entries on the window start and end days each get a dot",
        deepEq(groupDots([entry("s", w.start, "sent"), entry("t", w.end, "sent")], w).map((d) => d.date), [w.start, w.end]),
      );

      const inv: UnpaidInvoice = { id: "inv-sep30", number: "T-1", balance: 10, dueOn: "2026-09-30" };
      const pNov2 = prom("p-nov2", { dueOn: "2026-11-02" });
      const pNoDate = prom("p-nodate");
      const ps0 = [
        pNoDate, pNov2, prom("p-done", { status: "done", closedOn: TODAY, dueOn: "2026-10-01" }),
        prom("p-us", { owedBy: "us", dueOn: "2026-10-01" }),
      ];
      const owed = owedItems(ps0, [inv], "client");
      check(
        "owed items sort by due date, undated last, open only",
        deepEq(owed.map((i) => (i.type === "promise" ? i.promise.id : i.invoice.id)), ["inv-sep30", "p-nov2", "p-nodate"]),
      );
      check("invoices only on the client side", owedItems(ps0, [inv], "us").every((i) => i.type === "promise"));

      const same = ["a", "b", "c"].map((id) => prom(id, { dueOn: "2026-11-02" }));
      const ds = groupDiamonds(owedItems(same, [inv], "client"), "client", TODAY, w);
      check("same-day same-side items share a diamond", ds.find((d) => d.date === "2026-11-02")!.promiseIds.length === 3);
      check("a past diamond is late", ds.find((d) => d.date === "2026-09-30")!.late);
      check("a future diamond is not late", !ds.find((d) => d.date === "2026-11-02")!.late);

      {
        const mixed = owedItems(
          [
            prom("late-undated"),
            prom("far", { dueOn: "2027-06-01" }),
            prom("nov2", { dueOn: "2026-11-02" }),
            prom("early", { dueOn: "2026-10-01" }),
          ],
          [{ id: "inv-nov2", number: "T-2", balance: 5, dueOn: "2026-11-02" }],
          "client",
        );
        const dm = groupDiamonds(mixed, "client", TODAY, w);
        check("diamonds drop undated and out-of-window items", dm.every((d) => !d.promiseIds.includes("late-undated") && !d.promiseIds.includes("far")));
        check("diamonds are sorted by date", deepEq(dm.map((d) => d.date), ["2026-10-01", "2026-11-02"]));
        check(
          "a promise and an invoice due the same day share one diamond",
          deepEq(dm[1], { date: "2026-11-02", side: "client", late: false, promiseIds: ["nov2"], invoiceIds: ["inv-nov2"] }),
        );
      }

      const A = prom("A", { dueOn: "2026-10-01", status: "replaced", replacedBy: "B", closedOn: TODAY });
      const B = prom("B", { dueOn: "2026-10-10", status: "replaced", replacedBy: "C", closedOn: TODAY });
      const C = prom("C", { dueOn: "2026-10-20" });
      check("moved from the direct predecessor", movedFrom(C, [A, B, C]) === B.dueOn);
      check("moved twice shows the previous date, not the first", movedFrom(C, [A, B, C]) === "2026-10-10");
      check("moved from an undated promise is null", movedFrom(prom("N"), [prom("M", { replacedBy: "N" }), prom("N")]) === null);
      const A0 = prom("A0");
      check("never moved", movedFrom(A0, [A0]) === undefined);

      const ps = [
        prom("p1", { entryId: "e6" }),
        prom("p2", { entryId: "e6" }),
        prom("p9", { entryId: "e3", closedEntryId: "e6" }),
        prom("p5", { entryId: "e4" }),
      ];
      check("an entry lights the promises it created and closed", deepEq(litFromEntry("e6", ps).promises.sort(), ["p1", "p2", "p9"]));
      check("an entry lights itself", deepEq(litFromEntry("e6", ps).entries, ["e6"]));
      check("a promise lights its source entry", litFromItems(["p1"], [], ps).entries[0] === "e6");
      check("items light their own ids", deepEq(litFromItems(["p1"], ["inv-sep30"], ps), { entries: ["e6"], promises: ["p1"], invoices: ["inv-sep30"] }));
      check("tag", entryTag("email", "received") === "Email received" && entryTag("call", "both") === "Call");
      check("tag for sent and meeting", entryTag("message", "sent") === "Message sent" && entryTag("meeting", "received") === "Meeting" && entryTag("document", "both") === "Document");
    }

    // ---- Migration 015: tables and constraints ----
    await reset();
    const [client] = await sql`insert into clients (name) values ('Test Client A') returning id`;

    {
      const err = await fails(async () => {
        const [e] = await sql`
          insert into client_entries (client_id, occurred_on, kind, direction, summary, created_by)
          values (${client.id}, ${TODAY}, 'call', 'both', 'Test call', ${ZANE}) returning id`;
        await sql`
          insert into client_promises (client_id, entry_id, owed_by, what, due_on, created_by)
          values (${client.id}, ${e.id}, 'us', 'Send the draft', ${TODAY}, ${ZANE})`;
      });
      check("entry and open promise insert", err === null, describeFailure(err));
    }

    const promise = (status: string, closedOn: string | null, replacedBy: string | null = null) =>
      sql`insert into client_promises (client_id, owed_by, what, status, closed_on, replaced_by, created_by)
          values (${client.id}, 'us', 'Test promise', ${status}, ${closedOn}, ${replacedBy}, ${ZANE})
          returning id`;

    // Rejection checks require check_violation (23514) on the named constraint, so a typo,
    // a dropped connection or a missing table cannot turn them green.
    const rejected = async (name: string, run: () => Promise<unknown>, constraint: string) => {
      const err = await fails(run);
      check(name, err?.code === "23514" && err.constraint === constraint, describeFailure(err));
    };
    await rejected("open promise with closed_on is rejected", () => promise("open", TODAY), "client_promises_closed_iff_not_open");
    await rejected("done promise without closed_on is rejected", () => promise("done", null), "client_promises_closed_iff_not_open");
    await rejected(
      "replaced promise without replaced_by is rejected",
      () => promise("replaced", TODAY),
      "client_promises_replaced_has_target",
    );

    // Positive controls: the valid shapes of the same rows insert.
    {
      const err = await fails(() => promise("done", TODAY));
      check("done promise with closed_on inserts", err === null, describeFailure(err));
    }
    {
      const err = await fails(async () => {
        const [next] = await promise("open", null);
        await promise("replaced", TODAY, next.id);
      });
      check("replaced promise with replaced_by and closed_on inserts", err === null, describeFailure(err));
    }

    // Permission checks: both roles, both tables.
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["client_entries", "client_promises"]) {
        const err = await fails(() =>
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx.unsafe(`select 1 from ${table}`);
          }),
        );
        check(`${role} cannot read ${table}`, err?.code === "42501", describeFailure(err));
      }
    }
  } catch (e) {
    failed = true;
    throw e;
  } finally {
    // Runs even when a section throws. A reset error never replaces an earlier failure.
    try {
      await reset();
    } catch (e) {
      if (!failed) throw e;
      console.error("reset() also failed:", e);
    }
  }
}

// tsx runs .ts files as CommonJS, which has no top-level await, so the sections live in main().
main()
  .then(async () => {
    await closeDb();
    await sql.end();
    process.exit(failures ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
