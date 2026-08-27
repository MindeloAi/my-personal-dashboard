// verify-migration.mjs — prove Postgres returns exactly what Airtable returns.
//
// This is the safety net for the migration. It reads BOTH sources and compares
// them field by field, record by record — not a sample.
//
// Critically, it imports the PRODUCTION getters from src/lib/db.ts rather than
// reimplementing the mapping. Anything else would verify the wrong thing: the
// mappers, the type parsers and the ORDER BY clauses are precisely where a
// silent corruption would live.
//
// Run with bun (it imports TypeScript directly):
//   npm run db:verify
// Env: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, DATABASE_URL
//
// Exits non-zero on any mismatch.

import Airtable from "airtable";
import postgres from "postgres";
import {
  getClients,
  getProjects,
  getInvoices,
  getExpenses,
  getMilestones,
  getLeads,
  getTasks,
  getIdeas,
  closeDb,
  ClientSchema,
  ProjectSchema,
  InvoiceSchema,
  ExpenseSchema,
  MilestoneSchema,
  LeadSchema,
  TaskSchema,
  IdeaSchema,
} from "../src/lib/db.ts";

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const dbUrl = process.env.DATABASE_URL;
if (!apiKey || !baseId || !dbUrl) {
  console.error("Need AIRTABLE_API_KEY, AIRTABLE_BASE_ID and DATABASE_URL.");
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);
const sql = postgres(dbUrl, { prepare: false, max: 2, onnotice: () => {} });

const ABSENT = Symbol("absent");
const round2 = (n) => Math.round(n * 100) / 100;

// Fields whose values are money / computed numbers.
const MONEY = new Set([
  "Amount",
  "Total Value",
  "Recurring Amount",
  "Deposit Percentage",
  "Paid To Date",
  "Balance Remaining",
  "Order",
]);
// Values the dashboard reads as bare YYYY-MM-DD.
const DATES = new Set([
  "Start Date",
  "End Date",
  "Issue Date",
  "Due Date",
  "Paid Date",
  "Date",
  "Follow-up Date",
  "Triggered Date",
]);
// Airtable created-time; compared at second precision (a configured Created
// field may be truncated relative to the record's true createdTime).
const TIMESTAMPS = new Set(["Created"]);
// Link fields — compared as sets of Airtable record ids.
const LINKS = new Set(["Client", "Project"]);
// Computed in Postgres by the project_totals view, and ABSENT from Airtable —
// the rollup/formula the original build plan specified was never actually
// created in the base, so these have always been empty there. Excluded from the
// field diff and checked separately below against the raw invoice data, which
// is a stronger assertion than comparing to a field that does not exist.
const COMPUTED = new Set(["Paid To Date", "Balance Remaining"]);

/**
 * Normalise a value so the two sources are compared on meaning, not encoding.
 * Every branch here corresponds to a real trap in the migration.
 */
function norm(field, v) {
  if (v === null || v === undefined || v === "") return ABSENT;

  if (Array.isArray(v)) return v.length === 0 ? ABSENT : [...v].sort().join(",");

  if (field === "Recurring") return v === true ? true : ABSENT;

  if (TIMESTAMPS.has(field)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return `!!BAD-TIMESTAMP:${String(v)}`;
    return Math.floor(d.getTime() / 1000); // second precision
  }

  if (DATES.has(field)) {
    // The single most important assertion in this script. project-board.tsx:515
    // renders this value straight into the DOM, and ~20 sites call parseISO on
    // it, so a Date object or a full timestamp would be a visible regression.
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return `!!BAD-DATE-SHAPE:${JSON.stringify(v)}`;
    }
    return v;
  }

  if (MONEY.has(field)) {
    if (typeof v === "string") return `!!NUMBER-AS-STRING:${v}`;
    return round2(Number(v));
  }

  if (typeof v === "number") return round2(v);
  return v;
}

const fmt = (v) => (v === ABSENT ? "—" : JSON.stringify(v));

const TABLES = [
  { airtable: "Clients", getter: getClients, pg: "clients", schema: ClientSchema },
  { airtable: "Projects", getter: getProjects, pg: "projects", schema: ProjectSchema },
  { airtable: "Invoices", getter: getInvoices, pg: "invoices", schema: InvoiceSchema },
  { airtable: "Expenses", getter: getExpenses, pg: "expenses", schema: ExpenseSchema },
  { airtable: "Milestones", getter: getMilestones, pg: "milestones", schema: MilestoneSchema },
  { airtable: "Leads", getter: getLeads, pg: "leads", schema: LeadSchema },
  { airtable: "Tasks", getter: getTasks, pg: "tasks", schema: TaskSchema },
  { airtable: "Ideas", getter: getIdeas, pg: "ideas", schema: IdeaSchema },
];

let problems = 0;
const report = (msg) => {
  problems++;
  console.log(`  ${msg}`);
};

// ─── uuid → recId, so Postgres rows can be compared in Airtable's namespace ──
const uuidToRec = new Map();
for (const { pg } of TABLES) {
  const rows = await sql.unsafe(
    `select id, airtable_id from "${pg}" where airtable_id is not null`,
  );
  for (const r of rows) uuidToRec.set(String(r.id), r.airtable_id);
}

/** Rewrite a shaped record's ids back into Airtable's namespace. */
function toAirtableNamespace(rec) {
  const out = { ...rec };
  out.id = uuidToRec.get(String(rec.id)) ?? `!!NEW:${rec.id}`;
  for (const f of LINKS) {
    if (Array.isArray(out[f])) {
      out[f] = out[f].map((u) => uuidToRec.get(String(u)) ?? `!!UNMAPPED:${u}`);
    }
  }
  return out;
}

console.log("Comparing Airtable ⇄ Postgres\n");

const airtableByTable = {};

for (const { airtable, getter, schema } of TABLES) {
  console.log(`${airtable}`);

  const [atRecords, pgRecordsRaw] = await Promise.all([
    base(airtable).select().all(),
    getter(),
  ]);

  // Filter the Airtable side through the SAME read schema the app applies, so
  // the comparison is like-for-like: what the dashboard actually receives from
  // each source. The base contains genuinely blank rows (Airtable returns
  // `fields: {}`), and production already drops those — Postgres dropping them
  // too is correct, not a regression.
  const atRows = [];
  let atDropped = 0;
  for (const r of atRecords) {
    const parsed = schema.safeParse({ id: r.id, ...r.fields });
    if (parsed.success) atRows.push(parsed.data);
    else atDropped++;
  }
  if (atDropped > 0) {
    console.log(
      `  ${atDropped} blank/invalid Airtable record(s) — dropped by production too, not compared`,
    );
  }
  airtableByTable[airtable] = atRows;

  const pgRows = pgRecordsRaw.map(toAirtableNamespace);

  // Records created after cutover have no airtable_id; report, don't diff.
  const fresh = pgRows.filter((r) => String(r.id).startsWith("!!NEW:"));
  if (fresh.length > 0) {
    console.log(`  ${fresh.length} record(s) created since cutover — not compared`);
  }

  const atById = new Map(atRows.map((r) => [r.id, r]));
  const pgById = new Map(
    pgRows.filter((r) => !String(r.id).startsWith("!!NEW:")).map((r) => [r.id, r]),
  );

  for (const id of atById.keys()) {
    if (!pgById.has(id)) report(`MISSING_IN_PG   ${id}`);
  }
  for (const id of pgById.keys()) {
    if (!atById.has(id)) report(`EXTRA_IN_PG     ${id}`);
  }

  // Field-by-field over the union of keys, for every record they share.
  for (const [id, atRow] of atById) {
    const pgRow = pgById.get(id);
    if (!pgRow) continue;

    const keys = new Set([...Object.keys(atRow), ...Object.keys(pgRow)]);
    keys.delete("id");
    for (const k of COMPUTED) keys.delete(k);

    for (const key of keys) {
      const a = norm(key, atRow[key]);
      const b = norm(key, pgRow[key]);
      if (a === ABSENT && b === ABSENT) continue;
      if (a !== b) report(`${id}  ${key}: airtable=${fmt(a)}  pg=${fmt(b)}`);
    }
  }

  // Order: the four unsorted panels render in raw fetch order, so the getter's
  // sequence must match Airtable's exactly.
  const atOrder = atRows.map((r) => r.id).join("|");
  const pgOrder = pgRows
    .filter((r) => !String(r.id).startsWith("!!NEW:"))
    .map((r) => r.id)
    .join("|");
  if (atOrder !== pgOrder) {
    report(`ORDER_MISMATCH  ${airtable} renders in a different order`);
  }

  // A row present in Postgres but rejected by the read schema vanishes from the
  // dashboard. That is only a PROBLEM if Postgres drops more than Airtable does
  // — the blank rows are dropped by both and that is the correct behaviour.
  const [{ count }] = await sql.unsafe(
    `select count(*)::int as count from "${TABLES.find((t) => t.airtable === airtable).pg}"`,
  );
  const pgDropped = count - pgRecordsRaw.length;
  if (pgDropped > atDropped) {
    report(
      `DROPPED_BY_MAPPER  Postgres dropped ${pgDropped} row(s) but Airtable only ` +
        `dropped ${atDropped} — ${pgDropped - atDropped} record(s) became invisible ` +
        `(see [airtable] dropped record warnings above)`,
    );
  }

  console.log(
    `  ${atRows.length} airtable / ${pgRecordsRaw.length} postgres compared`,
  );
}

// ─── Totals reconciliation ──────────────────────────────────────────────────
// Independent of the record diff: recompute the actual numbers the dashboard
// shows, from both sides.

console.log("\nTotals");

const atInvoices = airtableByTable.Invoices;
const atExpenses = airtableByTable.Expenses;
const pgInvoices = await getInvoices();
const pgExpenses = await getExpenses();

const sumPaid = (rows) =>
  round2(
    rows
      .filter((r) => r.Status === "Paid")
      .reduce((s, r) => s + (Number(r.Amount) || 0), 0),
  );
const sumAll = (rows) =>
  round2(rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0));

const checks = [
  ["invoiced total", sumAll(atInvoices), sumAll(pgInvoices)],
  ["paid total", sumPaid(atInvoices), sumPaid(pgInvoices)],
  ["expenses total", sumAll(atExpenses), sumAll(pgExpenses)],
];

for (const [label, a, b] of checks) {
  const ok = a === b;
  if (!ok) problems++;
  console.log(`  ${ok ? "ok " : "!! "}${label.padEnd(16)} airtable=${a}  pg=${b}`);
}

// project_totals view: check its arithmetic against Airtable's RAW invoices,
// since the Airtable rollup field it replaces does not exist in the base.
const atProjects = airtableByTable.Projects;
const pgProjects = (await getProjects()).map(toAirtableNamespace);
const pgProjById = new Map(pgProjects.map((p) => [p.id, p]));

const expectedPaid = new Map();
for (const inv of atInvoices) {
  const projId = inv.Project?.[0];
  if (!projId || inv.Status !== "Paid") continue;
  expectedPaid.set(projId, (expectedPaid.get(projId) ?? 0) + (Number(inv.Amount) || 0));
}

let rollupMismatches = 0;
for (const p of atProjects) {
  const pg = pgProjById.get(p.id);
  if (!pg) continue;
  const expected = round2(expectedPaid.get(p.id) ?? 0);
  const actual = round2(Number(pg["Paid To Date"]) || 0);
  if (expected !== actual) {
    rollupMismatches++;
    problems++;
    console.log(
      `  !! Paid To Date  ${p.Name}: expected ${expected} from Airtable invoices, view says ${actual}`,
    );
  }
}
if (rollupMismatches === 0) {
  const shown = [...expectedPaid.values()].filter((v) => v > 0).length;
  console.log(
    `  ok  Paid To Date    view matches raw Airtable invoices for all ` +
      `${atProjects.length} projects (${shown} non-zero)`,
  );
}

// ─── Result ─────────────────────────────────────────────────────────────────
await closeDb();
await sql.end();

if (problems === 0) {
  console.log("\nPASS — Postgres and Airtable agree on every record and every total.");
} else {
  console.log(`\nFAIL — ${problems} mismatch(es). Do not cut over.`);
  process.exitCode = 1;
}
