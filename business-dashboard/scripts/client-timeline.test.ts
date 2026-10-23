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
const TODAY = "2026-10-22";
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

async function fails(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function main() {
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
    check("entry and open promise insert", err === null, err ?? "");
  }

  const promise = (status: string, closedOn: string | null) =>
    sql`insert into client_promises (client_id, owed_by, what, status, closed_on, created_by)
        values (${client.id}, 'us', 'Test promise', ${status}, ${closedOn}, ${ZANE})`;

  check("open promise with closed_on is rejected", (await fails(() => promise("open", TODAY))) !== null);
  check("done promise without closed_on is rejected", (await fails(() => promise("done", null))) !== null);
  check("replaced promise without replaced_by is rejected", (await fails(() => promise("replaced", TODAY))) !== null);

  {
    const err = await fails(() => sql.begin(async (tx) => {
      await tx`set local role anon`;
      await tx`select 1 from client_entries`;
    }));
    check("anon cannot read client_entries", err !== null && /permission denied/i.test(err), err ?? "no error");
  }

  await reset();
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
