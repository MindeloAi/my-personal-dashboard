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
  TimelineConflictError,
  closePromise,
  createPromise,
  deleteEntry,
  deletePromise,
  getClientTimeline,
  getOpenPromises,
  getTimelineCounts,
  reopenPromise,
  replacePromise,
  saveEntry,
  updateEntry,
  updatePromise,
} from "../src/lib/timeline-db";
import {
  addDays,
  cleanSuggestions,
  textTooLong,
  MAX_SUGGESTIONS,
  MAX_WHAT,
  MAX_QUOTE,
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
import { suggestPromises } from "../src/lib/suggest";

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
    // ---- Suggestions: cleaning and the guards before any call ----
    {
      const P = (id: string, o: Partial<ClientPromise> = {}): ClientPromise => ({
        id, clientId: "c1", entryId: null, owedBy: "client", what: "Send the draft", dueOn: null,
        status: "open", replacedBy: null, closedOn: null, closedBy: null, closedEntryId: null,
        note: null, createdBy: ZANE, created: "2026-10-01T00:00:00Z", ...o,
      });
      const OPEN = "11111111-1111-4111-8111-111111111111";
      const SHUT = "22222222-2222-4222-8222-222222222222";
      const open = [P(OPEN), P(SHUT, { status: "done" })];
      const raw = (s: Record<string, unknown>) => ({
        summary: "s", people: "p",
        suggestions: [{ action: "new", promise_id: null, owed_by: "us", what: "w", due_on: null, quote: "q", ...s }],
      }) as Parameters<typeof cleanSuggestions>[0];
      check("clean: done with an unknown id is dropped", cleanSuggestions(raw({ action: "done", promise_id: "33333333-3333-4333-8333-333333333333" }), open).length === 0);
      check("clean: replace with a closed promise's id is dropped", cleanSuggestions(raw({ action: "replace", promise_id: SHUT }), open).length === 0);
      check("clean: done with a null id is dropped", cleanSuggestions(raw({ action: "done", promise_id: null }), open).length === 0);
      check("clean: new with a promise_id gets null", cleanSuggestions(raw({ promise_id: OPEN }), open)[0]?.promiseId === null);
      check("clean: a malformed due_on becomes null", cleanSuggestions(raw({ due_on: "2 Nov" }), open)[0]?.dueOn === null);
      const kept = cleanSuggestions(raw({ action: "replace", promise_id: OPEN, due_on: "2026-11-02", what: "Later", owed_by: "client" }), open)[0];
      check("clean: keeps a valid replace", kept?.action === "replace" && kept.promiseId === OPEN && kept.dueOn === "2026-11-02" && kept.what === "Later" && kept.owedBy === "client" && kept.quote === "q", JSON.stringify(kept));
      const two = raw({ action: "done", promise_id: OPEN });
      two.suggestions.push({ ...two.suggestions[0], action: "replace", what: "second" });
      check("clean: a second suggestion for the same promise is dropped", cleanSuggestions(two, open).length === 1 && cleanSuggestions(two, open)[0].action === "done");
      check("clean: an empty what is dropped", cleanSuggestions(raw({ what: "  " }), open).length === 0);
      const longOne = cleanSuggestions(raw({ what: "w".repeat(MAX_WHAT + 5), quote: "q".repeat(MAX_QUOTE + 5) }), open)[0];
      check("clean: what and quote are cut to the save limits", longOne?.what.length === MAX_WHAT && longOne.quote.length === MAX_QUOTE);
      const many = raw({});
      many.suggestions = Array.from({ length: MAX_SUGGESTIONS + 10 }, (_, i) => ({ ...many.suggestions[0], what: "w" + i }));
      check("clean: keeps at most 50", cleanSuggestions(many, open).length === MAX_SUGGESTIONS);
      check("textTooLong: 100,000 passes", textTooLong("x".repeat(100_000)) === null);
      check("textTooLong: 100,001 returns the message", textTooLong("x".repeat(100_001)) === "That text is too long. Paste up to 100,000 characters.");

      const input = { clientName: "Test Client A", occurredOn: TODAY, kind: "call" as const, direction: "both" as const, open: [] };
      const savedKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const realError = console.error;
      const logged: string[] = [];
      console.error = (...a: unknown[]) => void logged.push(a.join(" "));
      const huge = await suggestPromises({ ...input, text: "x".repeat(100_001) });
      check("huge paste refused before any call", !huge.ok && huge.error === "That text is too long. Paste up to 100,000 characters.", JSON.stringify(huge));
      const nokey = await suggestPromises({ ...input, text: "short" });
      check("no key", !nokey.ok && nokey.error.includes("ANTHROPIC_API_KEY"), JSON.stringify(nokey));
      console.error = realError;
      check("no key: logs ANTHROPIC_API_KEY", logged.some((m) => m.includes("ANTHROPIC_API_KEY")), logged.join("|"));
      if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    }

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
            prom("undated"),
            prom("far", { dueOn: "2027-06-01" }),
            prom("nov2", { dueOn: "2026-11-02" }),
            prom("early", { dueOn: "2026-10-01" }),
          ],
          [{ id: "inv-nov2", number: "T-2", balance: 5, dueOn: "2026-11-02" }],
          "client",
        );
        const dm = groupDiamonds(mixed, "client", TODAY, w);
        check("the far fixture lies after the window", "2027-06-01" > w.end);
        check("diamonds drop undated and out-of-window items", dm.every((d) => !d.promiseIds.includes("undated") && !d.promiseIds.includes("far")));
        // Built by hand, later date first, so only groupDiamonds can put them in order.
        const unsorted = ["2026-11-10", "2026-10-01", "2026-11-02"].map((d) => ({
          type: "promise" as const,
          promise: prom("u" + d, { dueOn: d }),
        }));
        check(
          "diamonds are sorted by date",
          deepEq(groupDiamonds(unsorted, "client", TODAY, w).map((d) => d.date), ["2026-10-01", "2026-11-02", "2026-11-10"]),
        );
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

    // ---- Database reads and writes (src/lib/timeline-db.ts) ----
    {
      const CONFLICT = "Something changed on this client. Suggest again.";
      type Sug = Parameters<typeof saveEntry>[0]["suggestions"];
      const entryInput = (clientId: string, suggestions: Sug = [], occurredOn = "2026-10-23") => ({
        clientId, occurredOn, kind: "email" as const, direction: "received" as const,
        summary: "Test summary", people: null, body: "Pasted text", link: null, createdBy: ZANE, suggestions,
      });
      const mk = (clientId: string, what: string, dueOn: string | null = null, owedBy: "us" | "client" = "client") =>
        createPromise({ clientId, entryId: null, owedBy, what, dueOn, createdBy: ZANE }).then((r) => r.id);
      const count = async (t: "client_entries" | "client_promises") =>
        Number((await sql`select count(*)::int as n from ${sql(t)}`)[0].n);
      const rowOf = async (id: string) => (await sql`select * from client_promises where id = ${id}`)[0];
      const newClient = async (name: string) => String((await sql`insert into clients (name) values (${name}) returning id`)[0].id);
      // Passes only for a TimelineConflictError with the exact message; prints anything else.
      const conflicts = async (run: () => Promise<unknown>) => {
        try {
          await run();
          console.log("      unexpected result: no error");
          return false;
        } catch (e) {
          if (e instanceof TimelineConflictError && e.message === CONFLICT) return true;
          console.log(`      unexpected error: ${e instanceof Error ? e.message : String(e)}`);
          return false;
        }
      };
      const done = (promiseId: string | null): Sug[number] => ({ action: "done", promiseId, owedBy: "client", what: "x", dueOn: null, quote: "q" });
      const replace = (promiseId: string | null): Sug[number] => ({ action: "replace", promiseId, owedBy: "client", what: "x", dueOn: "2026-11-02", quote: "q" });
      const fresh = async () => {
        await reset();
        return newClient("Test Client A");
      };
      const unchanged = async (entries: number, promises: number) =>
        (await count("client_entries")) === entries && (await count("client_promises")) === promises;

      // save: new, done and replace in one entry
      {
        const A = await fresh();
        const p1 = await mk(A, "First promise", "2026-10-25");
        const p2 = await mk(A, "Second promise", "2026-10-26");
        const { entryId } = await saveEntry(entryInput(A, [
          { action: "new", promiseId: null, owedBy: "us", what: "Brand new", dueOn: "2026-11-05", quote: "q1" },
          done(p1),
          { action: "replace", promiseId: p2, owedBy: "client", what: "Second promise moved", dueOn: "2026-11-02", quote: "q3" },
        ]));
        const r1 = await rowOf(p1);
        const r2 = await rowOf(p2);
        check("save: done sets status, closed_entry_id, closed_on, closed_by", r1.status === "done" && String(r1.closed_entry_id) === entryId && r1.closed_on === "2026-10-23" && r1.closed_by === ZANE);
        const repl = r2.replaced_by ? await rowOf(String(r2.replaced_by)) : null;
        check("save: replace closes the old one as replaced, with closed_by", r2.status === "replaced" && String(r2.closed_entry_id) === entryId && r2.closed_on === "2026-10-23" && r2.closed_by === ZANE);
        check("save: replacement is open, dated, and linked to the entry", !!repl && repl.status === "open" && repl.due_on === "2026-11-02" && String(repl.entry_id) === entryId && repl.what === "Second promise moved");
        const [nw] = await sql`select * from client_promises where what = 'Brand new'`;
        check("save: new promise exists with entry_id", !!nw && String(nw.entry_id) === entryId && nw.owed_by === "us" && nw.due_on === "2026-11-05" && nw.status === "open");
      }

      // save: stale targets
      {
        const A = await fresh();
        const p = await mk(A, "Already closed");
        await closePromise(p, { status: "done", closedOn: TODAY, closedBy: ZANE, note: null });
        const q = await mk(A, "Still open");
        const entries = await count("client_entries");
        const promises = await count("client_promises");
        const ok = await conflicts(() => saveEntry(entryInput(A, [
          { action: "new", promiseId: null, owedBy: "us", what: "Would be new", dueOn: null, quote: "q" },
          done(q),
          done(p),
        ])));
        check("save: a done target that is already closed rejects everything", ok && (await unchanged(entries, promises)) && (await rowOf(q)).status === "open");
        const okReplace = await conflicts(() => saveEntry(entryInput(A, [done(q), replace(p)])));
        check("save: a replace target that is already closed rejects everything", okReplace && (await unchanged(entries, promises)) && (await rowOf(q)).status === "open");
        const dup = await conflicts(() => saveEntry(entryInput(A, [done(q), done(q)])));
        check("save: naming the same open promise twice rejects everything", dup && (await unchanged(entries, promises)) && (await rowOf(q)).status === "open");
        const gone = await conflicts(() => saveEntry(entryInput(A, [done("00000000-0000-0000-0000-000000000000")])));
        check("save: a missing target rejects everything", gone && (await unchanged(entries, promises)));
      }

      // save: other client's target, and null promise ids
      {
        const A = await fresh();
        const B = await newClient("Test Client B");
        const other = await mk(B, "Belongs to B");
        const entries = await count("client_entries");
        const promises = await count("client_promises");
        const okDone = await conflicts(() => saveEntry(entryInput(A, [done(other)])));
        check("save: a done target from another client rejects everything", okDone && (await unchanged(entries, promises)) && (await rowOf(other)).status === "open");
        const okReplace = await conflicts(() => saveEntry(entryInput(A, [replace(other)])));
        check("save: a replace target from another client rejects everything", okReplace && (await unchanged(entries, promises)) && (await rowOf(other)).status === "open");
        const nullDone = await conflicts(() => saveEntry(entryInput(A, [done(null)])));
        check("save: a done with a null promiseId rejects everything", nullDone && (await unchanged(entries, promises)));
        const nullReplace = await conflicts(() => saveEntry(entryInput(A, [replace(null)])));
        check("save: a replace with a null promiseId rejects everything", nullReplace && (await unchanged(entries, promises)));
      }

      // close, reopen, replace
      {
        const A = await fresh();
        const old = await mk(A, "Old", "2026-10-01");
        const { id: next } = await replacePromise(old, { owedBy: "client", what: "New", dueOn: "2026-11-02", closedOn: TODAY, createdBy: ZANE });
        const r = await rowOf(old);
        const rn = await rowOf(next);
        check("replacePromise closes the old one and links the new open one", r.status === "replaced" && String(r.replaced_by) === next && r.closed_on === TODAY && r.closed_by === ZANE && rn.status === "open" && rn.entry_id === null && String(rn.client_id) === A);
        await reopenPromise(old);
        const r2 = await rowOf(old);
        check("reopen clears closing fields and replaced_by", r2.status === "open" && r2.closed_on === null && r2.closed_by === null && r2.closed_entry_id === null && r2.note === null && r2.replaced_by === null);
        check("reopen leaves the replacement in place", (await rowOf(next)).status === "open");

        await closePromise(old, { status: "dropped", closedOn: TODAY, closedBy: ZANE, note: "no longer needed" });
        const r3 = await rowOf(old);
        check("closePromise drops with a note", r3.status === "dropped" && r3.note === "no longer needed" && r3.closed_on === TODAY);
        const promises = await count("client_promises");
        const entries = await count("client_entries");
        const refusedClose = await conflicts(() => closePromise(old, { status: "done", closedOn: "2026-10-24", closedBy: ZANE, note: null }));
        const afterClose = await rowOf(old);
        check("closePromise refuses a promise that is not open and changes nothing", refusedClose && afterClose.status === "dropped" && afterClose.closed_on === TODAY && afterClose.note === "no longer needed" && (await unchanged(entries, promises)));
        const refusedReplace = await conflicts(() => replacePromise(old, { owedBy: "client", what: "x", dueOn: null, closedOn: TODAY, createdBy: ZANE }));
        check("replacePromise refuses a promise that is not open and creates nothing", refusedReplace && (await rowOf(old)).status === "dropped" && (await unchanged(entries, promises)));
        const missing = await fails(() => reopenPromise("00000000-0000-0000-0000-000000000000"));
        check("reopenPromise with an unknown id throws not found", missing !== null && /not found/.test(missing.message), describeFailure(missing));
      }

      // delete a replacement
      {
        const A = await fresh();
        const old = await mk(A, "Original", "2026-10-01");
        const { id: next } = await replacePromise(old, { owedBy: "client", what: "Moved", dueOn: "2026-11-02", closedOn: TODAY, createdBy: ZANE });
        await deletePromise(next);
        const r = await rowOf(old);
        check("deleting a replacement reopens the promise it replaced", r.status === "open" && r.replaced_by === null && r.closed_on === null && r.closed_by === null && (await rowOf(next)) === undefined);
      }

      // delete an entry
      {
        const A = await fresh();
        const p1 = await mk(A, "Closed by entry");
        const { entryId } = await saveEntry(entryInput(A, [
          { action: "new", promiseId: null, owedBy: "us", what: "Born in entry", dueOn: null, quote: "q" },
          done(p1),
        ]));
        await deleteEntry(entryId);
        const [born] = await sql`select * from client_promises where what = 'Born in entry'`;
        const closed = await rowOf(p1);
        check("deleting an entry keeps its promises with empty links", born.entry_id === null && born.status === "open" && closed.closed_entry_id === null && closed.status === "done");
      }

      // update and unknown ids
      {
        const A = await fresh();
        const p = await mk(A, "Typo", "2026-10-30");
        await updatePromise(p, { owedBy: "us", what: "Fixed", dueOn: null });
        const r = await rowOf(p);
        check("updatePromise corrects wording, side and date", r.what === "Fixed" && r.owed_by === "us" && r.due_on === null);
        const { entryId } = await saveEntry(entryInput(A));
        await updateEntry(entryId, { occurredOn: "2026-10-20", kind: "call", direction: "both", summary: "Edited", people: "P", body: "B", link: "https://example.test" });
        const e = (await getClientTimeline(A)).entries.find((x) => x.id === entryId);
        check("updateEntry saves and getClientTimeline maps it", !!e && e.summary === "Edited" && e.kind === "call" && e.occurredOn === "2026-10-20" && e.link === "https://example.test" && e.created.endsWith("Z"));
        const missing = "00000000-0000-0000-0000-000000000000";
        const errs = await Promise.all([
          fails(() => updatePromise(missing, { owedBy: "us", what: "x", dueOn: null })),
          fails(() => updateEntry(missing, { occurredOn: TODAY, kind: "call", direction: "both", summary: "x", people: null, body: null, link: null })),
          fails(() => deletePromise(missing)),
          fails(() => deleteEntry(missing)),
        ]);
        check("unknown ids throw not found", errs.every((f) => f !== null && /not found/.test(f.message)));
      }

      // reads: ordering and all four statuses
      {
        const A = await fresh();
        // Separate statements, so created differs for the two entries on the same date.
        const first = (await saveEntry(entryInput(A, [], "2026-10-20"))).entryId;
        const second = (await saveEntry(entryInput(A, [], "2026-10-20"))).entryId;
        const newest = (await saveEntry(entryInput(A, [], "2026-10-22"))).entryId;
        const oldest = (await saveEntry(entryInput(A, [], "2026-10-01"))).entryId;
        const tl = await getClientTimeline(A);
        check("entries come newest first, ties by created desc", deepEq(tl.entries.map((x) => x.id), [newest, second, first, oldest]), JSON.stringify(tl.entries.map((x) => x.id)));

        const openP = await mk(A, "Open one");
        const doneP = await mk(A, "Done one");
        const dropP = await mk(A, "Dropped one");
        const replP = await mk(A, "Replaced one");
        await closePromise(doneP, { status: "done", closedOn: TODAY, closedBy: ZANE, note: null });
        await closePromise(dropP, { status: "dropped", closedOn: TODAY, closedBy: ZANE, note: null });
        const { id: replacement } = await replacePromise(replP, { owedBy: "client", what: "Replacement", dueOn: null, closedOn: TODAY, createdBy: ZANE });
        const ps = (await getClientTimeline(A)).promises;
        const statusOf = (id: string) => ps.find((x) => x.id === id)?.status;
        check(
          "getClientTimeline returns promises in all four statuses",
          statusOf(openP) === "open" && statusOf(doneP) === "done" && statusOf(dropP) === "dropped" && statusOf(replP) === "replaced" && statusOf(replacement) === "open" && ps.length === 5 && ps.every((x) => x.clientId === A),
        );
      }

      // open promises only, for one client
      {
        const a = await fresh();
        const b = await newClient("Test Client B");
        const x = await mk(a, "Open one");
        const y = await mk(a, "Closed one");
        await mk(b, "Other client");
        await closePromise(y, { status: "done", closedOn: TODAY, closedBy: ZANE, note: null });
        const got = await getOpenPromises(a);
        check("getOpenPromises: only open promises of that client", got.length === 1 && got[0].id === x, JSON.stringify(got.map((p) => p.what)));
      }

      // counts
      {
        const a = await fresh();
        const b = await newClient("Test Client B");
        const p1 = await mk(a, "One");
        await mk(a, "Two");
        await saveEntry(entryInput(a, [done(p1)]));
        await saveEntry(entryInput(a));
        await saveEntry(entryInput(b));
        const counts = await getTimelineCounts();
        check("counts per client", deepEq(counts[a], { entries: 2, promises: 2 }) && deepEq(counts[b], { entries: 1, promises: 0 }), JSON.stringify(counts[a]));
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
