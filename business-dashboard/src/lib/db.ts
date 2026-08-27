import postgres from "postgres";
import { z } from "zod";

// ─── Postgres data layer ──────────────────────────────────────────────────────
//
// This replaces the Airtable REST backend while keeping the *exact* public API
// that `lib/airtable.ts` used to expose — same function names, same argument
// shapes, same return types, same zod schemas. `lib/airtable.ts` is now a
// re-export shim, so no consumer changed.
//
// Column names in Postgres are snake_case; the shapers below map them back to
// the Airtable field names the UI reads ("Total Value", "Phone/WhatsApp", …).
//
// NOTE ON `server-only`: deliberately not imported. The verification script
// imports this module under bun to exercise the production mappers against live
// Airtable data, and `server-only` throws outside a React Server Component
// bundle. Client-bundle leakage is prevented instead by the fact that all 21
// component importers use `import type`, which is erased at compile time; the
// only runtime importers are a page, a server-actions file, and an async Server
// Component.

// ─── Lazy client ──────────────────────────────────────────────────────────────
//
// The connection is only constructed when a query actually runs, keeping
// `import "@/lib/db"` side-effect free so the dashboard page can be statically
// analyzed for build / page-data without env vars.
//
// Name kept as MissingAirtableEnvError: `dashboard/page.tsx` and `dev-hub.tsx`
// both catch it with `instanceof` and render `err.message` verbatim. Renaming it
// would be a user-visible change in the misconfigured state. Renamed in Pass 2.

export class MissingAirtableEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing Airtable env vars: ${missing.join(", ")}. ` +
        `Set them in .env.local (dev) or Railway service variables (deploy).`,
    );
    this.name = "MissingAirtableEnvError";
  }
}

type Sql = ReturnType<typeof postgres>;
type Row = Record<string, unknown>;

declare global {
  var __dashboardSql: Sql | undefined;
}

let _sql: Sql | null = null;

function getSql(): Sql {
  if (_sql) return _sql;
  // Reuse across dev hot-reloads so we don't leak a pool per edit.
  if (process.env.NODE_ENV !== "production" && globalThis.__dashboardSql) {
    _sql = globalThis.__dashboardSql;
    return _sql;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingAirtableEnvError(["DATABASE_URL"]);

  _sql = postgres(url, {
    // Supabase's transaction pooler cannot hold prepared statements between
    // queries. Everything here uses the simple/extended protocol without named
    // statements, so no session state may be relied on: no SET, no LISTEN, no
    // advisory locks. Adding any of those would work in dev (direct connection)
    // and fail intermittently in production.
    prepare: false,
    // The dashboard fans out 7 parallel SELECTs; a smaller max serialises them.
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      DateStyle: "ISO, YMD",
      TimeZone: "UTC",
      application_name: "business-dashboard",
    },
    // These parsers are the reason this migration is invisible. They are scoped
    // to this connection object rather than a process-global registry, so they
    // cannot affect anything else in the process.
    types: {
      // numeric(1700) arrives as a string by default. Every consumer treats
      // these as real numbers — `(x ?? 0) > 0`, `.toLocaleString()`,
      // `reduce((s, x) => s + x)` — so a string would corrupt every money figure
      // on the dashboard while still rendering without error.
      num: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
      // date(1082) is parsed into a JS Date by default. It must stay a bare
      // "YYYY-MM-DD" string: project-board.tsx:515 renders the raw value into
      // the DOM, ~20 sites call date-fns parseISO() on it, and two lists sort
      // by localeCompare over the raw string.
      d: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
      // timestamp(1114) / timestamptz(1184) — only the `Created` fields. Emit
      // Airtable's exact wire format so the verifier's diff is byte-clean.
      ts: {
        to: 1184,
        from: [1114, 1184],
        serialize: (x: string) => x,
        parse: (x: string) =>
          new Date(x.includes("Z") || x.includes("+") ? x : `${x}Z`).toISOString(),
      },
    },
  });

  if (process.env.NODE_ENV !== "production") globalThis.__dashboardSql = _sql;
  return _sql;
}

/** Close the pool. Only used by scripts; the app keeps it open. */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    globalThis.__dashboardSql = undefined;
  }
}

// ─── Read schemas ─────────────────────────────────────────────────────────────
//
// Moved verbatim from lib/airtable.ts. These define the public type surface, so
// any edit here is a user-visible risk.

export const ClientSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Company: z.string().optional(),
  Email: z.string().optional(),
  Phone: z.string().optional(),
  Status: z.enum(["Active", "Inactive", "Lead"]).optional(),
  Notes: z.string().optional(),
  Created: z.string().optional(),
  Owner: z.string().optional(),
});
export type Client = z.infer<typeof ClientSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Client: z.array(z.string()).optional(),
  Status: z
    .enum(["Lead", "In Progress", "Review", "Done", "Cancelled"])
    .optional(),
  "Payment Structure": z
    .enum([
      "one_time",
      "deposit_final",
      "milestones",
      "recurring_monthly",
      "recurring_custom",
    ])
    .optional(),
  "Total Value": z.number().optional(),
  "Recurring Amount": z.number().optional(),
  "Recurring Frequency": z.enum(["monthly", "quarterly", "yearly"]).optional(),
  "Deposit Percentage": z.number().optional(),
  "Start Date": z.string().optional(),
  "End Date": z.string().optional(),
  "Paid To Date": z.number().optional(),
  "Balance Remaining": z.number().optional(),
  Notes: z.string().optional(),
  Owner: z.string().optional(),
  "Service Type": z.string().optional(),
  "GitHub Repo URL": z.string().optional(),
  "Deploy URL": z.string().optional(),
  Host: z.enum(["Railway", "Vercel", "Netlify"]).optional(),
  "Tech Stack": z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const InvoiceSchema = z.object({
  id: z.string(),
  "Invoice Number": z.string().optional(),
  Project: z.array(z.string()).optional(),
  Client: z.array(z.string()).optional(),
  Amount: z.number().optional(),
  "Invoice Type": z
    .enum(["deposit", "milestone", "final", "recurring", "one_off"])
    .optional(),
  Status: z.enum(["Draft", "Sent", "Paid", "Overdue", "Void"]).optional(),
  "Issue Date": z.string().optional(),
  "Due Date": z.string().optional(),
  "Paid Date": z.string().optional(),
  "Payment Method": z
    .enum(["Bank", "PayPal", "Stripe", "Cash", "Other"])
    .optional(),
  "PDF URL": z.string().optional(),
  Notes: z.string().optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const ExpenseSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Category: z
    .enum([
      "Software",
      "Subcontractors",
      "Hosting",
      "Hardware",
      "Marketing",
      "Other",
    ])
    .optional(),
  Amount: z.number().optional(),
  Date: z.string().optional(),
  Recurring: z.boolean().optional(),
  Notes: z.string().optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Project: z.array(z.string()).optional(),
  Amount: z.number().optional(),
  Order: z.number().optional(),
  Status: z.enum(["Pending", "Triggered", "Invoiced"]).optional(),
  "Triggered Date": z.string().optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  Name: z.string(),
  "Business Name": z.string().optional(),
  Email: z.string().optional(),
  "Phone/WhatsApp": z.string().optional(),
  Source: z.string().optional(),
  Status: z
    .enum(["New", "Contacted", "Proposal Sent", "Won", "Lost"])
    .optional(),
  "Service Interest": z.string().optional(),
  "Current Website": z.string().optional(),
  "Budget Range": z.string().optional(),
  Message: z.string().optional(),
  "Follow-up Date": z.string().optional(),
  "Proposal Draft": z.string().optional(),
  Owner: z.string().optional(),
  Created: z.string().optional(),
  Notes: z.string().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  Title: z.string(),
  Description: z.string().optional(),
  Project: z.array(z.string()).optional(),
  Kind: z
    .enum([
      "code",
      "lead-gen",
      "client-comms",
      "research",
      "content",
      "ops",
      "other",
    ])
    .optional(),
  Status: z.enum(["Pending", "In Progress", "Blocked", "Done"]).optional(),
  Priority: z.string().optional(),
  "Assigned To": z.enum(["You", "Partner", "Any"]).optional(),
  "Picked Up By": z.string().optional(),
  Inputs: z.string().optional(),
  "Result Notes": z.string().optional(),
  Created: z.string().optional(),
  "Created By": z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const IdeaSchema = z.object({
  id: z.string(),
  Title: z.string(),
  Description: z.string().optional(),
  Category: z
    .enum(["product", "service", "marketing", "internal", "client"])
    .optional(),
  Status: z
    .enum(["Raw", "Exploring", "Validated", "Parked", "Doing"])
    .optional(),
  Effort: z.string().optional(),
  Impact: z.string().optional(),
  Notes: z.string().optional(),
  Created: z.string().optional(),
});
export type Idea = z.infer<typeof IdeaSchema>;

// ─── Write schemas ────────────────────────────────────────────────────────────
//
// Strict per-table input shapes. Validated *before* any mutation — so an invalid
// payload throws locally and never reaches the database.
// Computed / read-only fields (Created, Paid To Date, Balance Remaining) are
// excluded; everything else is optional so partial updates work.

export const ClientWriteSchema = z.object({
  Name: z.string().optional(),
  Company: z.string().optional(),
  Email: z.string().optional(),
  Phone: z.string().optional(),
  Status: z.enum(["Active", "Inactive", "Lead"]).optional(),
  Notes: z.string().optional(),
  Owner: z.string().optional(),
});
export type ClientWrite = z.infer<typeof ClientWriteSchema>;

export const ProjectWriteSchema = z.object({
  Name: z.string().optional(),
  Client: z.array(z.string()).optional(),
  Status: z
    .enum(["Lead", "In Progress", "Review", "Done", "Cancelled"])
    .optional(),
  "Payment Structure": z
    .enum([
      "one_time",
      "deposit_final",
      "milestones",
      "recurring_monthly",
      "recurring_custom",
    ])
    .optional(),
  "Total Value": z.number().optional(),
  "Recurring Amount": z.number().optional(),
  "Recurring Frequency": z.enum(["monthly", "quarterly", "yearly"]).optional(),
  "Deposit Percentage": z.number().optional(),
  "Start Date": z.string().optional(),
  "End Date": z.string().optional(),
  Notes: z.string().optional(),
  Owner: z.string().optional(),
  "Service Type": z.string().optional(),
  "GitHub Repo URL": z.string().optional(),
  "Deploy URL": z.string().optional(),
  Host: z.enum(["Railway", "Vercel", "Netlify"]).optional(),
  "Tech Stack": z.string().optional(),
});
export type ProjectWrite = z.infer<typeof ProjectWriteSchema>;

export const InvoiceWriteSchema = z.object({
  "Invoice Number": z.string().optional(),
  Project: z.array(z.string()).optional(),
  Client: z.array(z.string()).optional(),
  Amount: z.number().optional(),
  "Invoice Type": z
    .enum(["deposit", "milestone", "final", "recurring", "one_off"])
    .optional(),
  Status: z.enum(["Draft", "Sent", "Paid", "Overdue", "Void"]).optional(),
  "Issue Date": z.string().optional(),
  "Due Date": z.string().optional(),
  "Paid Date": z.string().optional(),
  "Payment Method": z
    .enum(["Bank", "PayPal", "Stripe", "Cash", "Other"])
    .optional(),
  "PDF URL": z.string().optional(),
  Notes: z.string().optional(),
});
export type InvoiceWrite = z.infer<typeof InvoiceWriteSchema>;

export const ExpenseWriteSchema = z.object({
  Name: z.string().optional(),
  Category: z
    .enum(["Software", "Subcontractors", "Hosting", "Hardware", "Marketing", "Other"])
    .optional(),
  Amount: z.number().optional(),
  Date: z.string().optional(),
  Recurring: z.boolean().optional(),
  Notes: z.string().optional(),
});
export type ExpenseWrite = z.infer<typeof ExpenseWriteSchema>;

export const LeadWriteSchema = z.object({
  Name: z.string().optional(),
  "Business Name": z.string().optional(),
  Email: z.string().optional(),
  "Phone/WhatsApp": z.string().optional(),
  Source: z.string().optional(),
  Status: z
    .enum(["New", "Contacted", "Proposal Sent", "Won", "Lost"])
    .optional(),
  "Service Interest": z.string().optional(),
  "Current Website": z.string().optional(),
  "Budget Range": z.string().optional(),
  Message: z.string().optional(),
  "Follow-up Date": z.string().optional(),
  "Proposal Draft": z.string().optional(),
  Owner: z.string().optional(),
  Created: z.string().optional(),
  Notes: z.string().optional(),
});
export type LeadWrite = z.infer<typeof LeadWriteSchema>;

export const TaskWriteSchema = z.object({
  Title: z.string().optional(),
  Description: z.string().optional(),
  Project: z.array(z.string()).optional(),
  Kind: z
    .enum([
      "code",
      "lead-gen",
      "client-comms",
      "research",
      "content",
      "ops",
      "other",
    ])
    .optional(),
  Status: z.enum(["Pending", "In Progress", "Blocked", "Done"]).optional(),
  Priority: z.string().optional(),
  "Assigned To": z.enum(["You", "Partner", "Any"]).optional(),
  "Picked Up By": z.string().optional(),
  Inputs: z.string().optional(),
  "Result Notes": z.string().optional(),
  Created: z.string().optional(),
  "Created By": z.string().optional(),
});
export type TaskWrite = z.infer<typeof TaskWriteSchema>;

export const IdeaWriteSchema = z.object({
  Title: z.string().optional(),
  Description: z.string().optional(),
  Category: z
    .enum(["product", "service", "marketing", "internal", "client"])
    .optional(),
  Status: z
    .enum(["Raw", "Exploring", "Validated", "Parked", "Doing"])
    .optional(),
  Effort: z.string().optional(),
  Impact: z.string().optional(),
  Notes: z.string().optional(),
  Created: z.string().optional(),
});
export type IdeaWrite = z.infer<typeof IdeaWriteSchema>;

// ─── Field ↔ column maps ──────────────────────────────────────────────────────
//
// Scalar fields map field-name → column. Link fields are listed separately
// because they are `string[]` in the public type but a scalar FK in Postgres.

type ColMap = Readonly<Record<string, string>>;

const CLIENT_COLS: ColMap = {
  Name: "name",
  Company: "company",
  Email: "email",
  Phone: "phone",
  Status: "status",
  Notes: "notes",
  Owner: "owner",
};

const PROJECT_COLS: ColMap = {
  Name: "name",
  Status: "status",
  "Payment Structure": "payment_structure",
  "Total Value": "total_value",
  "Recurring Amount": "recurring_amount",
  "Recurring Frequency": "recurring_frequency",
  "Deposit Percentage": "deposit_percentage",
  "Start Date": "start_date",
  "End Date": "end_date",
  Notes: "notes",
  Owner: "owner",
  "Service Type": "service_type",
  "GitHub Repo URL": "github_repo_url",
  "Deploy URL": "deploy_url",
  Host: "host",
  "Tech Stack": "tech_stack",
};
const PROJECT_LINKS: ColMap = { Client: "client_id" };

const INVOICE_COLS: ColMap = {
  "Invoice Number": "invoice_number",
  Amount: "amount",
  "Invoice Type": "invoice_type",
  Status: "status",
  "Issue Date": "issue_date",
  "Due Date": "due_date",
  "Paid Date": "paid_date",
  "Payment Method": "payment_method",
  "PDF URL": "pdf_url",
  Notes: "notes",
};
// `Client` is stored when written. Reads coalesce it with the project's client,
// reproducing Airtable's lookup semantics when it is null.
const INVOICE_LINKS: ColMap = { Project: "project_id", Client: "client_id" };

const EXPENSE_COLS: ColMap = {
  Name: "name",
  Category: "category",
  Amount: "amount",
  Date: "date",
  Recurring: "recurring",
  Notes: "notes",
};

// Milestones is read-only in the app today, so it has no write maps yet.
// Pass 2 adds Milestones CRUD and the corresponding MILESTONE_COLS/LINKS.

const LEAD_COLS: ColMap = {
  Name: "name",
  "Business Name": "business_name",
  Email: "email",
  "Phone/WhatsApp": "phone_whatsapp",
  Source: "source",
  Status: "status",
  "Service Interest": "service_interest",
  "Current Website": "current_website",
  "Budget Range": "budget_range",
  Message: "message",
  "Follow-up Date": "followup_date",
  "Proposal Draft": "proposal_draft",
  Owner: "owner",
  Created: "created",
  Notes: "notes",
};

const TASK_COLS: ColMap = {
  Title: "title",
  Description: "description",
  Kind: "kind",
  Status: "status",
  Priority: "priority",
  "Assigned To": "assigned_to",
  "Picked Up By": "picked_up_by",
  Inputs: "inputs",
  "Result Notes": "result_notes",
  Created: "created",
  "Created By": "created_by",
};
const TASK_LINKS: ColMap = { Project: "project_id" };

const IDEA_COLS: ColMap = {
  Title: "title",
  Description: "description",
  Category: "category",
  Status: "status",
  Effort: "effort",
  Impact: "impact",
  Notes: "notes",
  Created: "created",
};

// ─── Row shapers ──────────────────────────────────────────────────────────────
//
// Postgres row → the Airtable-shaped object the UI expects. Link columns become
// single-element arrays so `inv.Project?.[0]` keeps working.

const link = (v: unknown) => (v ? [String(v)] : undefined);

function shapeClient(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    Company: r.company,
    Email: r.email,
    Phone: r.phone,
    Status: r.status,
    Notes: r.notes,
    Created: r.created,
    Owner: r.owner,
  };
}

function shapeProject(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    Client: link(r.client_id),
    Status: r.status,
    "Payment Structure": r.payment_structure,
    "Total Value": r.total_value,
    "Recurring Amount": r.recurring_amount,
    "Recurring Frequency": r.recurring_frequency,
    "Deposit Percentage": r.deposit_percentage,
    "Start Date": r.start_date,
    "End Date": r.end_date,
    // From the project_totals view — never stored. project-board.tsx:524 is the
    // only reader of Paid To Date; Balance Remaining is read by nobody but is
    // kept for type parity.
    "Paid To Date": r.paid_to_date,
    "Balance Remaining": r.balance_remaining,
    Notes: r.notes,
    Owner: r.owner,
    "Service Type": r.service_type,
    "GitHub Repo URL": r.github_repo_url,
    "Deploy URL": r.deploy_url,
    Host: r.host,
    "Tech Stack": r.tech_stack,
  };
}

function shapeInvoice(r: Row) {
  return {
    id: String(r.id),
    "Invoice Number": r.invoice_number,
    Project: link(r.project_id),
    // Lookup semantics: fall back to the project's client when the invoice has
    // no explicit one. `effective_client_id` is computed by the query.
    Client: link(r.effective_client_id ?? r.client_id),
    Amount: r.amount,
    "Invoice Type": r.invoice_type,
    Status: r.status,
    "Issue Date": r.issue_date,
    "Due Date": r.due_date,
    "Paid Date": r.paid_date,
    "Payment Method": r.payment_method,
    "PDF URL": r.pdf_url,
    Notes: r.notes,
  };
}

function shapeExpense(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    Category: r.category,
    Amount: r.amount,
    Date: r.date,
    // Airtable omits an unchecked checkbox, so the UI sees undefined rather than
    // false. Both read as falsy, but emitting undefined keeps the verifier diff
    // byte-exact.
    Recurring: r.recurring === true ? true : undefined,
    Notes: r.notes,
  };
}

function shapeMilestone(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    Project: link(r.project_id),
    Amount: r.amount,
    Order: r.order_index,
    Status: r.status,
    "Triggered Date": r.triggered_date,
  };
}

function shapeLead(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    "Business Name": r.business_name,
    Email: r.email,
    "Phone/WhatsApp": r.phone_whatsapp,
    Source: r.source,
    Status: r.status,
    "Service Interest": r.service_interest,
    "Current Website": r.current_website,
    "Budget Range": r.budget_range,
    Message: r.message,
    "Follow-up Date": r.followup_date,
    "Proposal Draft": r.proposal_draft,
    Owner: r.owner,
    Created: r.created,
    Notes: r.notes,
  };
}

function shapeTask(r: Row) {
  return {
    id: String(r.id),
    Title: r.title,
    Description: r.description,
    Project: link(r.project_id),
    Kind: r.kind,
    Status: r.status,
    Priority: r.priority,
    "Assigned To": r.assigned_to,
    "Picked Up By": r.picked_up_by,
    Inputs: r.inputs,
    "Result Notes": r.result_notes,
    Created: r.created,
    "Created By": r.created_by,
  };
}

function shapeIdea(r: Row) {
  return {
    id: String(r.id),
    Title: r.title,
    Description: r.description,
    Category: r.category,
    Status: r.status,
    Effort: r.effort,
    Impact: r.impact,
    Notes: r.notes,
    Created: r.created,
  };
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Airtable omits empty cells entirely, so every schema field is `.optional()` —
 * which zod REJECTS null for. Postgres returns NULL. Without this, a single
 * empty cell would silently drop the whole row from the dashboard.
 *
 * `""` is stripped for the same reason: Airtable treats a written empty string
 * as clearing the cell, so a later read returns undefined. actions.ts:145 clears
 * "Picked Up By" that way. Stripping `""` on read (and mapping `""` → NULL on
 * write) makes the round-trip identical.
 *
 * Empty arrays are stripped so `inv.Project?.[0]` is undefined, not a read of [].
 * `0` and `false` are deliberately kept.
 */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/**
 * Mirrors the old parseRecord: a record failing its schema is dropped with a
 * warning rather than throwing, so one bad enum value hides a single row instead
 * of 500-ing the whole dashboard. Log line kept identical, prefix included.
 */
function parseRow<T>(
  table: string,
  id: string,
  shaped: Record<string, unknown>,
  schema: z.ZodType<T>,
): T | null {
  const result = schema.safeParse(compact(shaped));
  if (result.success) return result.data;
  console.warn("[airtable] dropped record", {
    table,
    id,
    issues: result.error.issues,
  });
  return null;
}

function parseRows<T>(
  table: string,
  rows: Row[],
  shape: (r: Row) => Record<string, unknown>,
  schema: z.ZodType<T>,
): T[] {
  return rows
    .map((r) => parseRow(table, String(r.id), shape(r), schema))
    .filter((r): r is T => r !== null);
}

// ─── Reads ────────────────────────────────────────────────────────────────────
//
// Every getter orders by sort_key so the four unsorted panels (leads, ideas,
// tasks, projects) render in the same order they did on Airtable. Without an
// explicit ORDER BY, Postgres row order is not deterministic.
//
// The `opts` parameter the Airtable versions accepted is gone: no caller ever
// passed one, and all filtering/sorting happens client-side over full tables.

export async function getClients(): Promise<Client[]> {
  const sql = getSql();
  const rows = await sql`select * from clients order by sort_key asc, id asc`;
  return parseRows("Clients", rows, shapeClient, ClientSchema);
}

export async function getProjects(): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    select p.*, t.paid_to_date, t.balance_remaining
      from projects p
      left join project_totals t on t.project_id = p.id
     order by p.sort_key asc, p.id asc
  `;
  return parseRows("Projects", rows, shapeProject, ProjectSchema);
}

export async function getInvoices(): Promise<Invoice[]> {
  const sql = getSql();
  const rows = await sql`
    select i.*, coalesce(i.client_id, p.client_id) as effective_client_id
      from invoices i
      left join projects p on p.id = i.project_id
     order by i.sort_key asc, i.id asc
  `;
  return parseRows("Invoices", rows, shapeInvoice, InvoiceSchema);
}

export async function getExpenses(): Promise<Expense[]> {
  const sql = getSql();
  const rows = await sql`select * from expenses order by sort_key asc, id asc`;
  return parseRows("Expenses", rows, shapeExpense, ExpenseSchema);
}

export async function getMilestones(): Promise<Milestone[]> {
  const sql = getSql();
  const rows = await sql`select * from milestones order by sort_key asc, id asc`;
  return parseRows("Milestones", rows, shapeMilestone, MilestoneSchema);
}

export async function getLeads(): Promise<Lead[]> {
  const sql = getSql();
  const rows = await sql`select * from leads order by sort_key asc, id asc`;
  return parseRows("Leads", rows, shapeLead, LeadSchema);
}

export async function getTasks(): Promise<Task[]> {
  const sql = getSql();
  const rows = await sql`select * from tasks order by sort_key asc, id asc`;
  return parseRows("Tasks", rows, shapeTask, TaskSchema);
}

/** Tasks still available to claim (Status = Pending). */
export async function getOpenTasks(): Promise<Task[]> {
  const sql = getSql();
  const rows = await sql`
    select * from tasks where status = 'Pending' order by sort_key asc, id asc
  `;
  return parseRows("Tasks", rows, shapeTask, TaskSchema);
}

export async function getIdeas(): Promise<Idea[]> {
  const sql = getSql();
  const rows = await sql`select * from ideas order by sort_key asc, id asc`;
  return parseRows("Ideas", rows, shapeIdea, IdeaSchema);
}

// ─── Single-record reads (by id) ──────────────────────────────────────────────
// Used by the in-app automations, which operate on one chosen record.
//
// These return null for a missing row. Airtable's .find() threw a 404 instead,
// which surfaced as "Automation failed. Check the server logs."; null surfaces
// as the more accurate "Lead not found." / "Project not found.". Both are error
// paths reachable only if a record is deleted between page render and action.

export async function getLead(id: string): Promise<Lead | null> {
  const sql = getSql();
  const [row] = await sql`select * from leads where id = ${id}`;
  return row ? parseRow("Leads", String(row.id), shapeLead(row), LeadSchema) : null;
}

export async function getProject(id: string): Promise<Project | null> {
  const sql = getSql();
  const [row] = await sql`
    select p.*, t.paid_to_date, t.balance_remaining
      from projects p
      left join project_totals t on t.project_id = p.id
     where p.id = ${id}
  `;
  return row
    ? parseRow("Projects", String(row.id), shapeProject(row), ProjectSchema)
    : null;
}

export async function getClientById(id: string): Promise<Client | null> {
  const sql = getSql();
  const [row] = await sql`select * from clients where id = ${id}`;
  return row
    ? parseRow("Clients", String(row.id), shapeClient(row), ClientSchema)
    : null;
}

// ─── Write helpers ────────────────────────────────────────────────────────────
//
// Validate input first. Return the raw row (id + columns) without re-parsing
// through the read schema, so a successful write is never reported as a failure
// due to an unexpected response field. No caller reads the returned fields.

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

function toRecord(row: Row): AirtableRecord {
  const { id, ...fields } = row;
  return { id: String(id), fields };
}

/**
 * Builds the column set for an INSERT/UPDATE, reproducing Airtable's PATCH
 * semantics exactly:
 *
 *   - a key that is absent, or present but `undefined`, is a NO-OP and does not
 *     clear the stored value. edit-invoice-modal.tsx:54 depends on this: picking
 *     "— None" sends `Project: undefined` and must NOT unlink the invoice.
 *   - `""` CLEARS the value. That is how callers blank a field today, e.g.
 *     actions.ts:145 sends `"Picked Up By": ""` to release a task.
 *
 * Link fields collapse from `string[]` to a scalar FK. More than one element
 * cannot be represented, so it throws rather than silently dropping data.
 */
function toColumns(
  payload: Record<string, unknown>,
  scalar: ColMap,
  links: ColMap = {},
): Record<string, unknown> {
  const cols: Record<string, unknown> = {};

  for (const [field, col] of Object.entries(scalar)) {
    if (!(field in payload)) continue;
    const v = payload[field];
    if (v === undefined) continue;
    cols[col] = v === "" ? null : v;
  }

  for (const [field, col] of Object.entries(links)) {
    if (!(field in payload)) continue;
    const v = payload[field];
    if (v === undefined) continue;
    if (!Array.isArray(v)) continue;
    if (v.length > 1) {
      throw new Error(
        `[db] "${field}" accepts at most one linked record, got ${v.length}`,
      );
    }
    cols[col] = v.length === 0 ? null : v[0];
  }

  return cols;
}

async function createRow<TInput>(
  table: string,
  schema: z.ZodType<TInput>,
  payload: TInput,
  scalar: ColMap,
  links: ColMap = {},
): Promise<AirtableRecord> {
  const validated = schema.parse(payload) as Record<string, unknown>;
  const cols = toColumns(validated, scalar, links);
  const sql = getSql();
  const [row] = Object.keys(cols).length
    ? await sql`insert into ${sql(table)} ${sql(cols)} returning *`
    : await sql`insert into ${sql(table)} default values returning *`;
  return toRecord(row);
}

async function updateRow<TInput>(
  table: string,
  schema: z.ZodType<TInput>,
  id: string,
  payload: TInput,
  scalar: ColMap,
  links: ColMap = {},
): Promise<AirtableRecord> {
  const validated = schema.parse(payload) as Record<string, unknown>;
  const cols = toColumns(validated, scalar, links);
  const sql = getSql();

  // An all-undefined payload PATCHes {} in Airtable — a successful no-op. It
  // must not become an empty SET clause, which is a syntax error.
  if (Object.keys(cols).length === 0) {
    const [row] = await sql`select * from ${sql(table)} where id = ${id}`;
    if (!row) throw new Error(`[db] ${table} record ${id} not found`);
    return toRecord(row);
  }

  const [row] = await sql`
    update ${sql(table)} set ${sql(cols)} where id = ${id} returning *
  `;
  // Airtable's .update() threw on a missing id; preserve that.
  if (!row) throw new Error(`[db] ${table} record ${id} not found`);
  return toRecord(row);
}

async function deleteRow(table: string, id: string): Promise<{ id: string }> {
  const sql = getSql();
  const [row] = await sql`delete from ${sql(table)} where id = ${id} returning id`;
  if (!row) throw new Error(`[db] ${table} record ${id} not found`);
  return { id: String(row.id) };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export const createClient = (payload: ClientWrite) =>
  createRow("clients", ClientWriteSchema, payload, CLIENT_COLS);

export const createProject = (payload: ProjectWrite) =>
  createRow("projects", ProjectWriteSchema, payload, PROJECT_COLS, PROJECT_LINKS);

export const createInvoice = (payload: InvoiceWrite) =>
  createRow("invoices", InvoiceWriteSchema, payload, INVOICE_COLS, INVOICE_LINKS);

export const createExpense = (payload: ExpenseWrite) =>
  createRow("expenses", ExpenseWriteSchema, payload, EXPENSE_COLS);

export const updateInvoice = (id: string, payload: InvoiceWrite) =>
  updateRow("invoices", InvoiceWriteSchema, id, payload, INVOICE_COLS, INVOICE_LINKS);

export const updateProject = (id: string, payload: ProjectWrite) =>
  updateRow("projects", ProjectWriteSchema, id, payload, PROJECT_COLS, PROJECT_LINKS);

export const updateExpense = (id: string, payload: ExpenseWrite) =>
  updateRow("expenses", ExpenseWriteSchema, id, payload, EXPENSE_COLS);

export const deleteProject = (id: string) => deleteRow("projects", id);

export const deleteExpense = (id: string) => deleteRow("expenses", id);

export const createLead = (payload: LeadWrite) =>
  createRow("leads", LeadWriteSchema, payload, LEAD_COLS);

export const updateLead = (id: string, payload: LeadWrite) =>
  updateRow("leads", LeadWriteSchema, id, payload, LEAD_COLS);

export const createTask = (payload: TaskWrite) =>
  createRow("tasks", TaskWriteSchema, payload, TASK_COLS, TASK_LINKS);

export const updateTask = (id: string, payload: TaskWrite) =>
  updateRow("tasks", TaskWriteSchema, id, payload, TASK_COLS, TASK_LINKS);

export const createIdea = (payload: IdeaWrite) =>
  createRow("ideas", IdeaWriteSchema, payload, IDEA_COLS);

export const updateIdea = (id: string, payload: IdeaWrite) =>
  updateRow("ideas", IdeaWriteSchema, id, payload, IDEA_COLS);

// Same table and schema as updateProject; kept as a distinct export because
// actions.ts imports it by name.
export const updateProjectMeta = (id: string, payload: ProjectWrite) =>
  updateRow("projects", ProjectWriteSchema, id, payload, PROJECT_COLS, PROJECT_LINKS);

// ─── Task claiming ──────────────────────────────────────────────────────────
//
// Airtable had no atomic compare-and-set, so this used to be a read-write-verify
// dance resolved by last-writer-wins. Postgres evaluates the `status = 'Pending'`
// predicate under a row lock, so exactly one concurrent caller can match and the
// whole race disappears.

export type ClaimResult =
  | { ok: true; task: AirtableRecord }
  | { ok: false; reason: "not-pending" | "lost-race" };

export async function claimTask(
  taskId: string,
  terminalId: string,
): Promise<ClaimResult> {
  const sql = getSql();

  const rows = await sql`
    update tasks
       set status = 'In Progress', picked_up_by = ${terminalId}
     where id = ${taskId} and status = 'Pending'
   returning *
  `;

  if (rows.length === 1) {
    const { id, ...fields } = shapeTask(rows[0]);
    return { ok: true, task: { id: String(id), fields } };
  }

  // Distinguish "exists but not Pending" from "no such row". Airtable's .find()
  // threw for a missing id and nothing catches it, so preserve the throw.
  const [current] = await sql`select 1 from tasks where id = ${taskId}`;
  if (!current) throw new Error(`[db] tasks record ${taskId} not found`);
  // "lost-race" is now unreachable — it described an artefact of Airtable's
  // last-writer-wins update. The union member stays for API compatibility.
  return { ok: false, reason: "not-pending" };
}
