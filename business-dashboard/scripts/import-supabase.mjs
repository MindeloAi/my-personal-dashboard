// import-supabase.mjs — load the Airtable export into Postgres.
//
// Why this exists: Airtable record ids ("recXXXX") are replaced by uuid primary
// keys, so every link field has to be rewritten as it is inserted. Tables are
// therefore imported in dependency order, building a recId → uuid map as it goes.
//
// Idempotent: every row carries its `airtable_id`, which is UNIQUE, so re-running
// upserts rather than duplicating. Rows created *after* cutover have a NULL
// airtable_id and never conflict, so they are left untouched.
//
// The whole import runs in ONE transaction: a failure on the last table rolls
// back the first, so there is no half-migrated state to clean up.
//
// Run:  npm run db:import   (after npm run db:export)
// Env:  DIRECT_URL

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = join(__dirname, ".airtable-export");

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL is not set. See .env.local.example.");
  process.exit(1);
}
if (!existsSync(join(IN_DIR, "_manifest.json"))) {
  console.error(`No export found in ${IN_DIR}. Run \`npm run db:export\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(IN_DIR, "_manifest.json"), "utf8"));
const load = (t) => JSON.parse(readFileSync(join(IN_DIR, `${t}.json`), "utf8"));

// recId → uuid, populated as each table is inserted.
const idMap = new Map();
// Invoices whose Airtable Client differs from their project's client.
const clientOverrides = [];

const blank = (v) => (v === "" || v === undefined ? null : v);

/**
 * Collapse an Airtable link array to a single FK.
 *
 * Fails loudly on more than one element: Postgres models these as a scalar FK,
 * so silently keeping the first would be undetectable data loss.
 */
function linkOne(table, recordId, field, value) {
  if (value == null) return null;
  if (!Array.isArray(value)) {
    throw new Error(
      `${table}/${recordId}: "${field}" is not an array: ${JSON.stringify(value)}`,
    );
  }
  if (value.length === 0) return null;
  if (value.length > 1) {
    throw new Error(
      `${table}/${recordId}: link field "${field}" has ${value.length} elements ` +
        `(${value.join(", ")}). The Postgres schema models this as a single FK. ` +
        `Fix the Airtable record or widen the schema — refusing to drop data.`,
    );
  }
  const uuid = idMap.get(value[0]);
  if (!uuid) {
    throw new Error(
      `${table}/${recordId}: "${field}" → ${value[0]} is not in the id map. ` +
        `Is the export stale, or is that target table imported later?`,
    );
  }
  return uuid;
}

// ─── Per-table field mapping ────────────────────────────────────────────────
// Deliberately spelled out rather than shared with src/lib/db.ts: this maps the
// raw *export* shape (which also carries airtable_id, sort_key and createdTime),
// and any drift between the two is exactly what db:verify exists to catch.

const MAPPERS = {
  Clients: (rec) => ({
    name: rec.fields.Name ?? "",
    company: blank(rec.fields.Company),
    email: blank(rec.fields.Email),
    phone: blank(rec.fields.Phone),
    status: blank(rec.fields.Status),
    notes: blank(rec.fields.Notes),
    owner: blank(rec.fields.Owner),
    created: rec.fields.Created ?? rec.createdTime,
  }),

  Projects: (rec) => ({
    name: rec.fields.Name ?? "",
    client_id: linkOne("Projects", rec.id, "Client", rec.fields.Client),
    status: blank(rec.fields.Status),
    payment_structure: blank(rec.fields["Payment Structure"]),
    total_value: rec.fields["Total Value"] ?? null,
    recurring_amount: rec.fields["Recurring Amount"] ?? null,
    recurring_frequency: blank(rec.fields["Recurring Frequency"]),
    deposit_percentage: rec.fields["Deposit Percentage"] ?? null,
    start_date: blank(rec.fields["Start Date"]),
    end_date: blank(rec.fields["End Date"]),
    notes: blank(rec.fields.Notes),
    owner: blank(rec.fields.Owner),
    service_type: blank(rec.fields["Service Type"]),
    github_repo_url: blank(rec.fields["GitHub Repo URL"]),
    deploy_url: blank(rec.fields["Deploy URL"]),
    host: blank(rec.fields.Host),
    tech_stack: blank(rec.fields["Tech Stack"]),
  }),

  Invoices: (rec) => {
    const projectId = linkOne("Invoices", rec.id, "Project", rec.fields.Project);
    const airtableClientId = linkOne("Invoices", rec.id, "Client", rec.fields.Client);

    // Invoices.Client is documented as a lookup through Project. Store it only
    // when it genuinely disagrees with the project's client (or there is no
    // project), so reads can coalesce and reproduce lookup behaviour. A run that
    // logs zero overrides confirms the lookup assumption held.
    let clientId = null;
    if (airtableClientId) {
      const projectClientId = projectId ? projectClientById.get(projectId) : null;
      if (!projectId || airtableClientId !== projectClientId) {
        clientId = airtableClientId;
        clientOverrides.push(rec.id);
      }
    }

    return {
      invoice_number: blank(rec.fields["Invoice Number"]),
      project_id: projectId,
      client_id: clientId,
      amount: rec.fields.Amount ?? null,
      invoice_type: blank(rec.fields["Invoice Type"]),
      status: blank(rec.fields.Status),
      issue_date: blank(rec.fields["Issue Date"]),
      due_date: blank(rec.fields["Due Date"]),
      paid_date: blank(rec.fields["Paid Date"]),
      payment_method: blank(rec.fields["Payment Method"]),
      pdf_url: blank(rec.fields["PDF URL"]),
      notes: blank(rec.fields.Notes),
    };
  },

  Expenses: (rec) => ({
    name: rec.fields.Name ?? "",
    category: blank(rec.fields.Category),
    amount: rec.fields.Amount ?? null,
    date: blank(rec.fields.Date),
    recurring: rec.fields.Recurring === true,
    notes: blank(rec.fields.Notes),
  }),

  Milestones: (rec) => ({
    name: rec.fields.Name ?? "",
    project_id: linkOne("Milestones", rec.id, "Project", rec.fields.Project),
    amount: rec.fields.Amount ?? null,
    order_index: rec.fields.Order ?? null,
    status: blank(rec.fields.Status),
    triggered_date: blank(rec.fields["Triggered Date"]),
  }),

  Leads: (rec) => ({
    name: rec.fields.Name ?? "",
    business_name: blank(rec.fields["Business Name"]),
    email: blank(rec.fields.Email),
    phone_whatsapp: blank(rec.fields["Phone/WhatsApp"]),
    source: blank(rec.fields.Source),
    status: blank(rec.fields.Status),
    service_interest: blank(rec.fields["Service Interest"]),
    current_website: blank(rec.fields["Current Website"]),
    budget_range: blank(rec.fields["Budget Range"]),
    message: blank(rec.fields.Message),
    followup_date: blank(rec.fields["Follow-up Date"]),
    proposal_draft: blank(rec.fields["Proposal Draft"]),
    owner: blank(rec.fields.Owner),
    created: rec.fields.Created ?? rec.createdTime,
    notes: blank(rec.fields.Notes),
  }),

  Tasks: (rec) => ({
    title: rec.fields.Title ?? "",
    description: blank(rec.fields.Description),
    project_id: linkOne("Tasks", rec.id, "Project", rec.fields.Project),
    kind: blank(rec.fields.Kind),
    status: blank(rec.fields.Status),
    priority: blank(rec.fields.Priority),
    assigned_to: blank(rec.fields["Assigned To"]),
    picked_up_by: blank(rec.fields["Picked Up By"]),
    inputs: blank(rec.fields.Inputs),
    result_notes: blank(rec.fields["Result Notes"]),
    created: rec.fields.Created ?? rec.createdTime,
    created_by: blank(rec.fields["Created By"]),
  }),

  Ideas: (rec) => ({
    title: rec.fields.Title ?? "",
    description: blank(rec.fields.Description),
    category: blank(rec.fields.Category),
    status: blank(rec.fields.Status),
    effort: blank(rec.fields.Effort),
    impact: blank(rec.fields.Impact),
    notes: blank(rec.fields.Notes),
    created: rec.fields.Created ?? rec.createdTime,
  }),
};

// Airtable table → Postgres table. Order is dependency order: a table's links
// must resolve to rows already inserted.
const ORDER = [
  ["Clients", "clients"],
  ["Projects", "projects"],
  ["Invoices", "invoices"],
  ["Milestones", "milestones"],
  ["Tasks", "tasks"],
  ["Expenses", "expenses"],
  ["Leads", "leads"],
  ["Ideas", "ideas"],
];

const SEQUENCES = ORDER.map(([, pg]) => [pg, `${pg}_sort_seq`]);

// projectUuid → clientUuid, needed by the Invoices mapper for override detection.
const projectClientById = new Map();

// Postgres caps a statement at 65535 parameters; chunk well under it.
const CHUNK = 200;

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const results = {};

try {
  await sql.begin(async (tx) => {
    for (const [airtableTable, pgTable] of ORDER) {
      const records = load(airtableTable);
      const mapper = MAPPERS[airtableTable];

      const rows = records.map((rec, i) => ({
        airtable_id: rec.id,
        sort_key: (i + 1) * 1000,
        ...mapper(rec),
      }));

      if (rows.length === 0) {
        results[airtableTable] = 0;
        continue;
      }

      const cols = Object.keys(rows[0]);
      const quoted = cols.map((c) => `"${c}"`).join(", ");
      // Overwrite every mapped column, sort_key included, so a re-run after a
      // fresh export converges exactly rather than leaving stale values.
      const setClause = cols
        .filter((c) => c !== "airtable_id")
        .map((c) => `"${c}" = excluded."${c}"`)
        .join(", ");

      let done = 0;
      for (let start = 0; start < rows.length; start += CHUNK) {
        const chunk = rows.slice(start, start + CHUNK);
        const placeholders = chunk
          .map(
            (_, r) =>
              `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(", ")})`,
          )
          .join(", ");
        const values = chunk.flatMap((row) => cols.map((c) => row[c] ?? null));

        const inserted = await tx.unsafe(
          `insert into "${pgTable}" (${quoted}) values ${placeholders}
             on conflict (airtable_id) do update set ${setClause}
             returning id, airtable_id`,
          values,
        );

        for (const r of inserted) idMap.set(r.airtable_id, r.id);
        done += inserted.length;
      }

      // Projects must be queryable by the Invoices mapper before it runs.
      if (pgTable === "projects") {
        for (const rec of records) {
          const uuid = idMap.get(rec.id);
          const clientRec = rec.fields.Client?.[0];
          projectClientById.set(uuid, clientRec ? idMap.get(clientRec) : null);
        }
      }

      results[airtableTable] = done;
      console.log(`  ${airtableTable.padEnd(12)} ${String(done).padStart(5)} rows`);
    }
  });

  // Point each sequence past the highest imported sort_key so newly created
  // records append to the bottom of the list, as an Airtable grid row does.
  for (const [pgTable, seq] of SEQUENCES) {
    await sql.unsafe(
      `select setval('${seq}', coalesce((select max(sort_key) from "${pgTable}"), 1000))`,
    );
  }

  console.log("\nImport complete.");

  const mismatched = Object.entries(results).filter(
    ([t, n]) => manifest.counts[t] !== n,
  );
  if (mismatched.length > 0) {
    console.warn(
      `\n!! Row counts differ from the export manifest: ` +
        mismatched.map(([t, n]) => `${t} ${manifest.counts[t]}→${n}`).join(", "),
    );
    process.exitCode = 1;
  }

  if (clientOverrides.length === 0) {
    console.log(
      "Invoices.Client behaved as a pure lookup through Project (0 overrides).",
    );
  } else {
    console.warn(
      `\n!! ${clientOverrides.length} invoice(s) have a Client that differs from ` +
        `their project's client. Stored as explicit overrides:\n   ` +
        clientOverrides.join(", "),
    );
  }
} catch (err) {
  console.error("\nImport failed and was rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
