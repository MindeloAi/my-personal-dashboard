// export-airtable.mjs — snapshot every Airtable table to local JSON.
//
// Why this exists: this is both the input to the Supabase import and the
// one-time archive of the Airtable base before it is retired. It is also the
// only way to find out how close the base is to Airtable's free-plan record cap
// (1,000 records per BASE, shared across all tables) — so it reports counts.
//
// Record ORDER is significant and is preserved. Four dashboard panels (leads,
// ideas, tasks, projects) render in raw fetch order with no sort, so the order
// Airtable returns here is the order the UI shows today. The importer turns each
// record's index into a sort_key so Postgres reproduces it exactly.
//
// Output is gitignored — it contains client emails and complete financials.
// Copy scripts/.airtable-export/ somewhere durable (OneDrive) after running.
//
// Run:  npm run db:export
// Env:  AIRTABLE_API_KEY, AIRTABLE_BASE_ID  (get them with `vercel env pull`)

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Airtable from "airtable";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, ".airtable-export");

// Airtable's free plan caps a BASE at 1,000 records across all tables.
const FREE_PLAN_CAP = 1000;
const WARN_AT = 950;

const TABLES = [
  "Clients",
  "Projects",
  "Invoices",
  "Expenses",
  "Milestones",
  "Leads",
  "Tasks",
  "Ideas",
];

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) {
  console.error(
    "Missing AIRTABLE_API_KEY / AIRTABLE_BASE_ID.\n" +
      "Run `vercel env pull .env.local` in business-dashboard/ to fetch them.",
  );
  process.exit(1);
}

const base = new Airtable({ apiKey }).base(baseId);
mkdirSync(OUT_DIR, { recursive: true });

const counts = {};

for (const table of TABLES) {
  let records;
  try {
    // No view, no sort, no filter: .all() auto-paginates and returns the base's
    // natural order, which is what the dashboard renders today.
    records = await base(table).select().all();
  } catch (err) {
    console.error(`Failed to read table "${table}": ${err.message}`);
    process.exit(1);
  }

  const rows = records.map((r, index) => ({
    index,
    id: r.id,
    // _rawJson.createdTime is always millisecond precision, unlike a configured
    // "Created time" field which may be truncated to minute/second.
    createdTime: r._rawJson?.createdTime ?? null,
    fields: r.fields,
  }));

  writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2));
  counts[table] = rows.length;
  console.log(`  ${table.padEnd(12)} ${String(rows.length).padStart(5)} records`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);

writeFileSync(
  join(OUT_DIR, "_manifest.json"),
  JSON.stringify({ exportedAt: new Date().toISOString(), baseId, counts, total }, null, 2),
);

console.log(`\nTOTAL: ${total} records across ${TABLES.length} tables`);
console.log(`Written to ${OUT_DIR}`);

// A table sitting exactly at the cap means Airtable silently refused writes and
// records you think exist simply do not. Migrating would bake that loss in.
const atCap = Object.entries(counts).filter(([, n]) => n >= FREE_PLAN_CAP);
if (atCap.length > 0) {
  console.warn(
    `\n!! At or over the free-plan record cap: ${atCap
      .map(([t, n]) => `${t}=${n}`)
      .join(", ")}\n` +
      `!! Records may already have been silently refused. Investigate before importing.`,
  );
  process.exitCode = 1;
} else if (total >= WARN_AT) {
  console.warn(
    `\n!! Base total is ${total} / ${FREE_PLAN_CAP} — you were close to the wall.\n` +
      `!! Good timing on this migration.`,
  );
}
