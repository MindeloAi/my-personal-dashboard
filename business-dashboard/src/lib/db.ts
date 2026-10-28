import postgres from "postgres";
import { z } from "zod";
import type { Holder, Founder, PaymentMethod, SplitRule } from "@/lib/ledger";
import { effectiveStatus, type EffectiveStatus } from "@/lib/invoices";

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

// ─── Concurrency gate ─────────────────────────────────────────────────────────
//
// Supabase's TRANSACTION pooler (:6543) jams when postgres.js queues a query
// onto a connection that is still busy: the queued query never returns, and
// the pool stays dead until the server instance is recycled. Measured against
// production on 2026-10-22 with max 8: 17 parallel queries fine, the 18th
// hangs; on a warm pool, 8 succeed and every later query hangs forever
// (max_pipeline: 1 does not help; the session pooler is unaffected). The old
// dashboard never sent more than 8 at once, so it never hit this. The ledger
// pages do, and /admin returned 504s.
//
// So no query is handed to postgres.js until a connection is free: at most
// POOL_MAX in flight, the rest wait here in FIFO order. 100 parallel queries
// through this gate completed against production. Only real queries (tagged
// templates) and transactions take a slot; sql(table) / sql(cols) helpers are
// fragments, not queries, and pass straight through.
const POOL_MAX = 8;

function gated(raw: Sql): Sql {
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    active--;
    waiting.shift()?.();
  };
  const run = <T>(start: () => PromiseLike<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const go = () => {
        active++;
        Promise.resolve()
          .then(start)
          .then(resolve, reject)
          .finally(release);
      };
      if (active < POOL_MAX) go();
      else waiting.push(go);
    });

  return new Proxy(raw, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args);
      const isQuery = Array.isArray(args[0]) && "raw" in (args[0] as object);
      return isQuery ? run(() => result as PromiseLike<unknown>) : result;
    },
    get(target, prop, receiver) {
      if (prop === "begin") {
        return (...args: unknown[]) => run(() => (target.begin as (...a: unknown[]) => PromiseLike<unknown>)(...args));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function getSql(): Sql {
  if (_sql) return _sql;
  // Reuse across dev hot-reloads so we don't leak a pool per edit.
  if (process.env.NODE_ENV !== "production" && globalThis.__dashboardSql) {
    _sql = globalThis.__dashboardSql;
    return _sql;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingAirtableEnvError(["DATABASE_URL"]);

  _sql = gated(postgres(url, {
    // Supabase's transaction pooler cannot hold prepared statements between
    // queries. Everything here uses the simple/extended protocol without named
    // statements, so no session state may be relied on: no SET, no LISTEN, no
    // advisory locks. Adding any of those would work in dev (direct connection)
    // and fail intermittently in production.
    prepare: false,
    // Must match POOL_MAX: the gate above keeps in-flight queries at or below it.
    max: POOL_MAX,
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
  }));

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
  Subscription: z.array(z.string()).optional(),
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
  // Founder ledger (migration 011). Fractions 0..1 that total 1, or both unset.
  "Michael Bonus Share": z.number().optional(),
  "Zane Bonus Share": z.number().optional(),
  // Sum of payments recorded since cutover. Read-only, computed by the query.
  "Paid So Far": z.number().optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// The single source of recurring revenue (migration 007). `Amount` is what is
// charged EACH period — lib/subscriptions.ts divides by Frequency to reach MRR.
// A subscription may hang off a client, a project, both, or neither.
export const SubscriptionSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Client: z.array(z.string()).optional(),
  Project: z.array(z.string()).optional(),
  Amount: z.number().optional(),
  Frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  Status: z.enum(["Active", "Paused", "Cancelled"]).optional(),
  "Start Date": z.string().optional(),
  "End Date": z.string().optional(),
  Notes: z.string().optional(),
  Created: z.string().optional(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

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
  // The TTD figure. Every expense total on the dashboard sums this and only
  // this — "USD Amount" below is audit metadata and is never totalled.
  Amount: z.number().optional(),
  Date: z.string().optional(),
  Recurring: z.boolean().optional(),
  Notes: z.string().optional(),
  "USD Amount": z.number().optional(),
  Reference: z.string().optional(),
  // Founder ledger (migration 011). Who paid: a business cash holder, or a
  // founder personally (then owed back until reimbursed).
  "Paid From": z.enum(["mikey", "zane", "business"]).optional(),
  "Paid Personally By": z.enum(["michael", "zane"]).optional(),
  "Reimbursed At": z.string().optional(),
  "Reimbursed From": z.enum(["mikey", "zane", "business"]).optional(),
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
    // Nullable so an edit can clear it: "" fails the enum/number check and
    // undefined is a no-op in toColumns; null is written as NULL.
    .nullable()
    .optional(),
  "Total Value": z.number().nullable().optional(),
  "Recurring Amount": z.number().optional(),
  "Recurring Frequency": z.enum(["monthly", "quarterly", "yearly"]).optional(),
  "Deposit Percentage": z.number().nullable().optional(),
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
  Subscription: z.array(z.string()).optional(),
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
  "Michael Bonus Share": z.number().min(0).max(1).nullable().optional(),
  "Zane Bonus Share": z.number().min(0).max(1).nullable().optional(),
});
export type InvoiceWrite = z.infer<typeof InvoiceWriteSchema>;

export const SubscriptionWriteSchema = z.object({
  Name: z.string().optional(),
  Client: z.array(z.string()).optional(),
  Project: z.array(z.string()).optional(),
  Amount: z.number().optional(),
  Frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  Status: z.enum(["Active", "Paused", "Cancelled"]).optional(),
  "Start Date": z.string().optional(),
  "End Date": z.string().optional(),
  Notes: z.string().optional(),
});
export type SubscriptionWrite = z.infer<typeof SubscriptionWriteSchema>;

export const ExpenseWriteSchema = z.object({
  Name: z.string().optional(),
  Category: z
    .enum(["Software", "Subcontractors", "Hosting", "Hardware", "Marketing", "Other"])
    .optional(),
  Amount: z.number().optional(),
  Date: z.string().optional(),
  Recurring: z.boolean().optional(),
  Notes: z.string().optional(),
  "USD Amount": z.number().optional(),
  Reference: z.string().optional(),
  // "" clears (toColumns). Reimbursement is written only by reimburseExpense().
  "Paid From": z.enum(["mikey", "zane", "business", ""]).optional(),
  "Paid Personally By": z.enum(["michael", "zane", ""]).optional(),
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
  "Michael Bonus Share": "michael_bonus_share",
  "Zane Bonus Share": "zane_bonus_share",
};
// `Client` is stored when written. Reads coalesce it with the project's client,
// reproducing Airtable's lookup semantics when it is null.
const INVOICE_LINKS: ColMap = {
  Project: "project_id",
  Client: "client_id",
  Subscription: "subscription_id",
};

const SUBSCRIPTION_COLS: ColMap = {
  Name: "name",
  Amount: "amount",
  Frequency: "frequency",
  Status: "status",
  "Start Date": "start_date",
  "End Date": "end_date",
  Notes: "notes",
};
const SUBSCRIPTION_LINKS: ColMap = { Client: "client_id", Project: "project_id" };

const EXPENSE_COLS: ColMap = {
  Name: "name",
  Category: "category",
  Amount: "amount",
  Date: "date",
  Recurring: "recurring",
  Notes: "notes",
  "USD Amount": "usd_amount",
  Reference: "reference",
  "Paid From": "paid_from",
  "Paid Personally By": "paid_personally_by",
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
    Subscription: link(r.subscription_id),
    "Michael Bonus Share": r.michael_bonus_share,
    "Zane Bonus Share": r.zane_bonus_share,
    "Paid So Far": r.paid_so_far,
  };
}

function shapeSubscription(r: Row) {
  return {
    id: String(r.id),
    Name: r.name,
    Client: link(r.client_id),
    Project: link(r.project_id),
    Amount: r.amount,
    Frequency: r.frequency,
    Status: r.status,
    "Start Date": r.start_date,
    "End Date": r.end_date,
    Notes: r.notes,
    Created: r.created,
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
    "USD Amount": r.usd_amount,
    Reference: r.reference,
    "Paid From": r.paid_from,
    "Paid Personally By": r.paid_personally_by,
    "Reimbursed At": r.reimbursed_at,
    "Reimbursed From": r.reimbursed_from,
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
    select i.*, coalesce(i.client_id, p.client_id) as effective_client_id,
           (select coalesce(sum(amount), 0) from payments where invoice_id = i.id) as paid_so_far
      from invoices i
      left join projects p on p.id = i.project_id
     order by i.sort_key asc, i.id asc
  `;
  return parseRows("Invoices", rows, shapeInvoice, InvoiceSchema);
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const sql = getSql();
  const rows = await sql`select * from subscriptions order by sort_key asc, id asc`;
  return parseRows("Subscriptions", rows, shapeSubscription, SubscriptionSchema);
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

export const updateClient = (id: string, payload: ClientWrite) =>
  updateRow("clients", ClientWriteSchema, id, payload, CLIENT_COLS);

// Every FK into clients is ON DELETE SET NULL (schema.sql:11), so this detaches
// projects and invoices rather than deleting them. The caller MUST warn first —
// see clients-list.tsx.
export const deleteClient = (id: string) => deleteRow("clients", id);

export const createProject = (payload: ProjectWrite) =>
  createRow("projects", ProjectWriteSchema, payload, PROJECT_COLS, PROJECT_LINKS);

export const createInvoice = (payload: InvoiceWrite) =>
  createRow("invoices", InvoiceWriteSchema, payload, INVOICE_COLS, INVOICE_LINKS);

export const createExpense = (payload: ExpenseWrite) =>
  createRow("expenses", ExpenseWriteSchema, payload, EXPENSE_COLS);

export const createSubscription = (payload: SubscriptionWrite) =>
  createRow("subscriptions", SubscriptionWriteSchema, payload,
    SUBSCRIPTION_COLS, SUBSCRIPTION_LINKS);

export const updateSubscription = (id: string, payload: SubscriptionWrite) =>
  updateRow("subscriptions", SubscriptionWriteSchema, id, payload,
    SUBSCRIPTION_COLS, SUBSCRIPTION_LINKS);

// invoices.subscription_id is ON DELETE SET NULL, so past invoices survive and
// keep their money on the books — they simply stop being attributable to a
// retainer. The UI warns with the exact count first. See subscriptions-list.tsx.
export const deleteSubscription = (id: string) => deleteRow("subscriptions", id);

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

// Nothing in the schema references leads, so a delete orphans nothing.
export const deleteLead = (id: string) => deleteRow("leads", id);

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

// ─── Admin profiles (auth) ────────────────────────────────────────────────────
//
// Read-only lookup used by requireAdmin() in lib/auth.ts. Rows are created only by
// scripts/seed-admins.mjs via the service role key; nothing in the app writes here.

export type AdminProfile = { id: string; email: string };

export async function getAdminProfile(userId: string): Promise<AdminProfile | null> {
  const sql = getSql();
  const [row] = await sql`
    select id, email from profiles where id = ${userId} and role = 'admin'
  `;
  return row ? { id: String(row.id), email: String(row.email) } : null;
}

// ─── Founder ledger (migration 011) ───────────────────────────────────────────
//
// Every money figure here is read from a view or written by the
// on_payment_insert() trigger. Nothing below does arithmetic on money.
//
// Writes that the database can reject for a business reason (overpaying, a
// date before cutover, missing bonus shares, a locked invoice) raise P0001 with
// a plain-English message. ledgerErrorMessage() lets an action hand that text
// to the user, since Next redacts thrown errors in production.

export function ledgerErrorMessage(err: unknown): string | null {
  const e = err as { code?: string; message?: string };
  return e?.code === "P0001" && e.message ? e.message : null;
}

export type Payout = {
  id: string;
  number: string;
  founder: Founder;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceNotes: string | null;
  invoiceAmount: number | null;
  client: string | null;
  project: string | null;
  paymentId: string;
  /** The whole collection this payout was split from. */
  paymentAmount: number;
  paidAt: string;
  base: number;
  bonus: number;
  total: number;
  status: "due" | "paid_out";
  paidOutAt: string | null;
  paidFrom: Holder | null;
  createdBy: string | null;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  receivedBy: Holder;
  method: string | null;
  note: string | null;
  createdBy: string | null;
};

export type CashMovement = {
  id: string;
  movedAt: string;
  kind: "opening" | "transfer";
  fromLoc: Holder | null;
  toLoc: Holder | null;
  amount: number;
  note: string | null;
  createdBy: string | null;
  /** The collection this transfer moves on (migration 016), if any. */
  paymentId: string | null;
};

/** One payment and where its money should end up (the collections view, migration 016). */
export type Collection = {
  paymentId: string;
  invoiceId: string;
  paidAt: string;
  amount: number;
  receivedBy: Holder;
  method: string | null;
  note: string | null;
  createdBy: string | null;
  invoiceNumber: string | null;
  invoiceNotes: string | null;
  client: string | null;
  project: string | null;
  michaelPayout: number;
  zanePayout: number;
  businessShare: number;
  /** Zane still to hand to Mikey. */
  handoverDue: number;
  /** Business share not in the safe yet. */
  businessDue: number;
};

export type CashCheckRow = {
  location: Holder;
  countedAt: string | null;
  counted: number | null;
  /** Expected balance AS AT the count date. */
  expected: number | null;
  variance: number | null;
  expectedNow: number;
};

export type Ledger = {
  cutover: string;
  rule: SplitRule;
  cash: { total: number } & Record<Holder, number>;
  cashCheck: CashCheckRow[];
  owedToUs: { total: number; count: number };
  owedToFounders: Record<Founder, number>;
  founderPay: { founder: Founder; month: string; due: number; paidOut: number; total: number }[];
  payouts: Payout[];
  payments: Payment[];
  movements: CashMovement[];
  collections: Collection[];
  /** Totals across every collection. giveZane / mikeyKeeps are payouts still due. */
  toSort: { received: number; handover: number; business: number; giveZane: number; mikeyKeeps: number };
  /** This calendar month, counted from cutover at the earliest. */
  month: { payments: number; expenses: number; payoutsPaidOut: number; net: number };
  /** What the founders would earn if every unpaid invoice (overdue at full value) were paid today. */
  projection: {
    /** total = base + bonus still to come; dueNow = payouts created but not paid out; outlook = both. */
    michael: { base: number; bonus: number; total: number; dueNow: number; outlook: number };
    zane: { base: number; bonus: number; total: number; dueNow: number; outlook: number };
    /** Bonus pool on invoices whose shares are not set yet; belongs to nobody until they are. */
    unassignedBonus: number;
    invoicesWithoutShares: number;
    invoices: {
      invoiceId: string;
      invoiceNumber: string | null;
      dueDate: string | null;
      overdue: boolean;
      remaining: number;
      /** Base plus bonus, from the view; the bonus part is 0 while shares are unset. */
      michael: number;
      zane: number;
      unassignedBonus: number;
    }[];
  };
};

const str = (v: unknown) => (v == null ? null : String(v));

export async function getCutoverDate(): Promise<string> {
  const sql = getSql();
  const [row] = await sql`select cutover_date from ledger_settings`;
  return String(row.cutover_date);
}

const shapeRule = (r: Row): SplitRule => ({
  version: Number(r.version),
  effectiveFrom: String(r.effective_from),
  bonusPoolPct: Number(r.bonus_pool_pct),
  michaelBasePct: Number(r.michael_base_pct),
  zaneBasePct: Number(r.zane_base_pct),
});

/** What every page's create-invoice / create-expense forms need. */
export async function getLedgerBasics(today: string): Promise<{ cutover: string; rule: SplitRule }> {
  const sql = getSql();
  const [[rule], cutover] = await Promise.all([
    sql`select * from split_rules where effective_from <= ${today} order by effective_from desc limit 1`,
    getCutoverDate(),
  ]);
  return { cutover, rule: shapeRule(rule) };
}

export async function getLedger(today: string): Promise<Ledger> {
  const sql = getSql();
  const monthStart = today.slice(0, 8) + "01";
  const [
    basics,
    [cash],
    cashCheck,
    owed,
    owedFounders,
    founderPay,
    payouts,
    payments,
    movements,
    [month],
    projectionRows,
    [projected],
    collections,
    [toSort],
  ] = await Promise.all([
    getLedgerBasics(today),
    sql`select * from business_cash`,
    sql`select * from cash_check`,
    sql`select total from owed_to_us`,
    sql`select * from owed_to_founders`,
    sql`select * from founder_pay order by month desc, founder`,
    sql`
      select po.*, i.invoice_number, i.notes as invoice_notes, i.amount as invoice_amount,
             pm.paid_at, pm.amount as payment_amount,
             coalesce(nullif(c.company, ''), c.name) as client, pr.name as project
        from payouts po
        join invoices i on i.id = po.invoice_id
        join payments pm on pm.id = po.payment_id
        left join projects pr on pr.id = i.project_id
        left join clients c on c.id = coalesce(i.client_id, pr.client_id)
       order by po.number desc`,
    sql`select * from payments order by paid_at desc, created_at desc`,
    sql`select * from cash_movements order by moved_at desc, created_at desc`,
    sql`
      select m.*, m.payments - m.expenses - m.payouts as net
        from ledger_settings s,
        lateral (select greatest(${monthStart}::date, s.cutover_date) as since) w,
        lateral (select
          (select coalesce(sum(amount), 0) from payments
            where paid_at between w.since and ${today}) as payments,
          (select coalesce(sum(amount), 0) from expenses
            where date between w.since and ${today}) as expenses,
          (select coalesce(sum(total), 0) from payouts
            where status = 'paid_out' and paid_out_at between w.since and ${today}) as payouts
        ) m`,
    sql`select * from founder_projection order by due_date nulls last, invoice_number`,
    sql`
      select t.*, t.michael_total + t.michael_due as michael_outlook, t.zane_total + t.zane_due as zane_outlook from (
      select coalesce(sum(michael_base), 0) as michael_base, coalesce(sum(michael_bonus), 0) as michael_bonus,
             coalesce(sum(zane_base), 0) as zane_base, coalesce(sum(zane_bonus), 0) as zane_bonus,
             coalesce(sum(unassigned_bonus), 0) as unassigned,
             count(*) filter (where unassigned_bonus > 0) as without_shares,
             coalesce(sum(michael_total), 0) as michael_total,
             coalesce(sum(zane_total), 0) as zane_total,
             (select coalesce(sum(total), 0) from payouts where status = 'due' and founder = 'michael') as michael_due,
             (select coalesce(sum(total), 0) from payouts where status = 'due' and founder = 'zane') as zane_due
        from founder_projection) t`,
    sql`select * from collections order by paid_at desc, invoice_number`,
    sql`
      select (select coalesce(sum(amount), 0) from payments) as received,
             (select coalesce(sum(handover_due), 0) from collections) as handover,
             (select coalesce(sum(business_due), 0) from collections) as business,
             coalesce(sum(total) filter (where founder = 'zane'), 0)    as give_zane,
             coalesce(sum(total) filter (where founder = 'michael'), 0) as mikey_keeps
        from payouts where status = 'due'`,
  ]);

  const owedTo =Object.fromEntries(owedFounders.map((r) => [r.founder, Number(r.owed)]));

  return {
    ...basics,
    cash: {
      total: Number(cash.total),
      mikey: Number(cash.mikey),
      zane: Number(cash.zane),
      business: Number(cash.business),
    },
    cashCheck: cashCheck.map((r) => ({
      location: r.location as Holder,
      countedAt: str(r.counted_at),
      counted: r.counted == null ? null : Number(r.counted),
      expected: r.expected == null ? null : Number(r.expected),
      variance: r.variance == null ? null : Number(r.variance),
      expectedNow: Number(r.expected_now),
    })),
    owedToUs: { total: Number(owed[0]?.total ?? 0), count: owed.length },
    owedToFounders: { michael: owedTo.michael ?? 0, zane: owedTo.zane ?? 0 },
    founderPay: founderPay.map((r) => ({
      founder: r.founder as Founder,
      month: String(r.month).slice(0, 7), // "YYYY-MM", same key as payout.paidAt.slice(0, 7)
      due: Number(r.due),
      paidOut: Number(r.paid_out),
      total: Number(r.total),
    })),
    payouts: payouts.map((r) => ({
      id: String(r.id),
      number: String(r.number),
      founder: r.founder as Founder,
      invoiceId: String(r.invoice_id),
      invoiceNumber: str(r.invoice_number),
      invoiceNotes: str(r.invoice_notes),
      invoiceAmount: r.invoice_amount == null ? null : Number(r.invoice_amount),
      client: str(r.client),
      project: str(r.project),
      paymentId: String(r.payment_id),
      paymentAmount: Number(r.payment_amount),
      paidAt: String(r.paid_at),
      base: Number(r.base),
      bonus: Number(r.bonus),
      total: Number(r.total),
      status: r.status as Payout["status"],
      paidOutAt: str(r.paid_out_at),
      paidFrom: str(r.paid_from) as Holder | null,
      createdBy: str(r.created_by),
    })),
    payments: payments.map((r) => ({
      id: String(r.id),
      invoiceId: String(r.invoice_id),
      amount: Number(r.amount),
      paidAt: String(r.paid_at),
      receivedBy: r.received_by as Holder,
      method: str(r.method),
      note: str(r.note),
      createdBy: str(r.created_by),
    })),
    movements: movements.map((r) => ({
      id: String(r.id),
      movedAt: String(r.moved_at),
      kind: r.kind as CashMovement["kind"],
      fromLoc: str(r.from_loc) as Holder | null,
      toLoc: str(r.to_loc) as Holder | null,
      amount: Number(r.amount),
      note: str(r.note),
      createdBy: str(r.created_by),
      paymentId: str(r.payment_id),
    })),
    collections: collections.map((r) => ({
      paymentId: String(r.payment_id),
      invoiceId: String(r.invoice_id),
      paidAt: String(r.paid_at),
      amount: Number(r.amount),
      receivedBy: r.received_by as Holder,
      method: str(r.method),
      note: str(r.note),
      createdBy: str(r.created_by),
      invoiceNumber: str(r.invoice_number),
      invoiceNotes: str(r.invoice_notes),
      client: str(r.client),
      project: str(r.project),
      michaelPayout: Number(r.michael_payout),
      zanePayout: Number(r.zane_payout),
      businessShare: Number(r.business_share),
      handoverDue: Number(r.handover_due),
      businessDue: Number(r.business_due),
    })),
    toSort: {
      received: Number(toSort.received),
      handover: Number(toSort.handover),
      business: Number(toSort.business),
      giveZane: Number(toSort.give_zane),
      mikeyKeeps: Number(toSort.mikey_keeps),
    },
    month: {
      payments: Number(month.payments),
      expenses: Number(month.expenses),
      payoutsPaidOut: Number(month.payouts),
      net: Number(month.net),
    },
    projection: {
      michael: {
        base: Number(projected.michael_base),
        bonus: Number(projected.michael_bonus),
        total: Number(projected.michael_total),
        dueNow: Number(projected.michael_due),
        outlook: Number(projected.michael_outlook),
      },
      zane: {
        base: Number(projected.zane_base),
        bonus: Number(projected.zane_bonus),
        total: Number(projected.zane_total),
        dueNow: Number(projected.zane_due),
        outlook: Number(projected.zane_outlook),
      },
      unassignedBonus: Number(projected.unassigned),
      invoicesWithoutShares: Number(projected.without_shares),
      invoices: projectionRows.map((r) => ({
        invoiceId: String(r.invoice_id),
        invoiceNumber: str(r.invoice_number),
        dueDate: str(r.due_date),
        overdue: r.status === "Overdue" || (r.due_date != null && String(r.due_date) < today),
        remaining: Number(r.remaining),
        michael: Number(r.michael_total),
        zane: Number(r.zane_total),
        unassignedBonus: Number(r.unassigned_bonus),
      })),
    },
  };
}

export type PaymentInput = {
  invoiceId: string;
  amount: number;
  paidAt: string;
  receivedBy: Holder;
  method: PaymentMethod | null;
  note: string | null;
  /** Mark both new payouts paid out on paidAt, from this holder. Null leaves them due. */
  payOutFrom: Holder | null;
  createdBy: string;
};

/**
 * One transaction: insert the payment (the trigger validates it, creates the
 * payouts and closes the invoice when fully paid), then optionally pay out
 * those payouts straight away.
 */
export async function recordPayment(p: PaymentInput): Promise<{ id: string }> {
  const sql = getSql();
  const id = await sql.begin(async (tx) => {
    const [row] = await tx`
      insert into payments (invoice_id, amount, paid_at, received_by, method, note, created_by)
      values (${p.invoiceId}, ${p.amount}, ${p.paidAt}, ${p.receivedBy}, ${p.method}, ${p.note}, ${p.createdBy})
      returning id`;
    if (p.payOutFrom) {
      await tx`
        update payouts
           set status = 'paid_out', paid_out_at = ${p.paidAt}, paid_from = ${p.payOutFrom}
         where payment_id = ${row.id}`;
    }
    return String(row.id);
  });
  return { id };
}

/**
 * Re-divide the bonus pool of every payment on an invoice (migration 017).
 * Due payouts change in place; a founder already paid out gets a correction
 * payout, negative if he must pay some back.
 */
export async function changeBonusShares(invoiceId: string, michaelShare: number, createdBy: string): Promise<void> {
  const sql = getSql();
  await sql`select change_bonus_shares(${invoiceId}, ${michaelShare}, ${createdBy})`;
}

/** Correction. Its payouts go with it; a Paid invoice reopens as Sent. */
export async function deletePayment(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`delete from payments where id = ${id} returning id`;
  if (!row) throw new Error(`[db] payment ${id} not found`);
}

export async function markPayoutPaidOut(id: string, paidOutAt: string, paidFrom: Holder): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update payouts set status = 'paid_out', paid_out_at = ${paidOutAt}, paid_from = ${paidFrom}
     where id = ${id} returning id`;
  if (!row) throw new Error(`[db] payout ${id} not found`);
}

/** Correction: back to due. */
export async function undoPayoutPaidOut(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update payouts set status = 'due', paid_out_at = null, paid_from = null
     where id = ${id} returning id`;
  if (!row) throw new Error(`[db] payout ${id} not found`);
}

export async function createTransfer(t: {
  movedAt: string;
  fromLoc: Holder;
  toLoc: Holder;
  amount: number;
  note: string | null;
  createdBy: string;
  paymentId?: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    insert into cash_movements (moved_at, kind, from_loc, to_loc, amount, note, created_by, payment_id)
    values (${t.movedAt}, 'transfer', ${t.fromLoc}, ${t.toLoc}, ${t.amount}, ${t.note}, ${t.createdBy}, ${t.paymentId ?? null})`;
}

/** Correction. Transfers only: the opening balance is fixed. */
export async function deleteTransfer(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`delete from cash_movements where id = ${id} and kind = 'transfer' returning id`;
  if (!row) throw new Error(`[db] transfer ${id} not found`);
}

export async function createCashCount(c: {
  countedAt: string;
  location: Holder;
  amount: number;
  note: string | null;
  createdBy: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    insert into cash_counts (counted_at, location, amount, note, created_by)
    values (${c.countedAt}, ${c.location}, ${c.amount}, ${c.note}, ${c.createdBy})`;
}

/** Correction: removes a holder's most recent count, revealing the one before. */
export async function deleteLatestCashCount(location: Holder): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    delete from cash_counts where id = (
      select id from cash_counts where location = ${location}
       order by counted_at desc, created_at desc limit 1)
    returning id`;
  if (!row) throw new Error(`[db] no count for ${location}`);
}

export async function reimburseExpense(id: string, reimbursedAt: string, from: Holder): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update expenses set reimbursed_at = ${reimbursedAt}, reimbursed_from = ${from}
     where id = ${id} and paid_personally_by is not null returning id`;
  if (!row) throw new Error(`[db] expense ${id} was not paid personally`);
}

/** Correction: owed to the founder again. */
export async function undoReimburseExpense(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update expenses set reimbursed_at = null, reimbursed_from = null where id = ${id} returning id`;
  if (!row) throw new Error(`[db] expense ${id} not found`);
}

// ---------------------------------------------------------------------------
// Accounts export (docs/superpowers/specs/2026-10-23-accounts-export-design.md)
// ---------------------------------------------------------------------------

export type AccountsExport = {
  from: string;
  to: string;
  today: string;
  cutover: string;
  income: {
    date: string;
    invoiceNumber: string | null;
    client: string | null;
    project: string | null;
    amount: number;
    method: string | null;
    receivedBy: string | null;
    note: string | null;
    source: "Ledger" | "Before ledger";
  }[];
  expenses: {
    date: string;
    name: string;
    category: string | null;
    amount: number;
    usdAmount: number | null;
    paidFrom: string | null;
    paidPersonallyBy: string | null;
    reimbursedAt: string | null;
    reimbursedFrom: string | null;
    recurring: boolean;
    reference: string | null;
    notes: string | null;
  }[];
  founderPay: {
    number: string;
    founder: string;
    invoiceNumber: string | null;
    paymentDate: string;
    base: number;
    bonus: number;
    total: number;
    status: "due" | "paid_out";
    paidOutAt: string | null;
    paidFrom: string | null;
  }[];
  cashMovements: {
    date: string;
    kind: "opening" | "transfer";
    from: string | null;
    to: string | null;
    amount: number;
    note: string | null;
  }[];
  invoices: {
    invoiceNumber: string | null;
    client: string | null;
    project: string | null;
    type: string | null;
    issueDate: string | null;
    dueDate: string | null;
    amount: number;
    paidSoFar: number;
    status: EffectiveStatus;
    paidDate: string | null;
  }[];
  /** Each pot's balance as at `to`, by the same flows as cash_by_location. */
  cashAtEnd: Record<Holder, number>;
  /** Not period-based: what clients owe right now. */
  owedToUsNow: number;
};

/** Everything the accounts export needs for one inclusive date range. Read-only. */
export async function getAccountsExport(from: string, to: string, today: string): Promise<AccountsExport> {
  const sql = getSql();
  return sql.begin("read only", async (tx) => {
    const [{ cutover_date }] = await tx`select cutover_date from ledger_settings`;
    const cutover = String(cutover_date);
    // Company first: it is what the dashboard lists clients by.
    const client = tx`coalesce(nullif(c.company, ''), c.name)`;
    const income = await tx`
      select p.paid_at as date, i.invoice_number, ${client} as client, pr.name as project,
             p.amount, p.method, p.received_by, p.note, 'Ledger' as source
        from payments p
        left join invoices i on i.id = p.invoice_id
        left join clients c on c.id = i.client_id
        left join projects pr on pr.id = i.project_id
       where p.paid_at between ${from} and ${to}
      union all
      select i.paid_date, i.invoice_number, ${client}, pr.name,
             i.amount, i.payment_method, null, null, 'Before ledger'
        from invoices i
        left join clients c on c.id = i.client_id
        left join projects pr on pr.id = i.project_id
       where i.status = 'Paid' and i.paid_date between ${from} and ${to} and i.paid_date < ${cutover}
         and not exists (select 1 from payments p where p.invoice_id = i.id)
       order by 1, 2`;
    const expenses = await tx`
      select date, name, category, amount, usd_amount, paid_from, paid_personally_by,
             reimbursed_at, reimbursed_from, recurring, reference, notes
        from expenses where date between ${from} and ${to}
       order by date, sort_key`;
    const founderPay = await tx`
      select po.number, po.founder, i.invoice_number, pm.paid_at, po.base, po.bonus, po.total,
             po.status, po.paid_out_at, po.paid_from
        from payouts po
        join payments pm on pm.id = po.payment_id
        left join invoices i on i.id = po.invoice_id
       where pm.paid_at between ${from} and ${to}
       order by pm.paid_at, po.number`;
    const cashMovements = await tx`
      select moved_at, kind, from_loc, to_loc, amount, note
        from cash_movements where moved_at between ${from} and ${to}
       order by moved_at, created_at`;
    const invoices = await tx`
      select i.invoice_number, ${client} as client, pr.name as project, i.invoice_type, i.issue_date,
             i.due_date, i.amount, i.status, i.paid_date,
             coalesce(p.paid, case when i.status = 'Paid' then i.amount else 0 end) as paid_so_far
        from invoices i
        left join clients c on c.id = i.client_id
        left join projects pr on pr.id = i.project_id
        left join (select invoice_id, sum(amount) as paid from payments group by invoice_id) p
          on p.invoice_id = i.id
       where i.issue_date between ${from} and ${to}
       order by i.issue_date, i.invoice_number`;
    const cash = await tx`
      select l.location, coalesce(sum(f.amount), 0) as balance
        from (values ('mikey'), ('zane'), ('business')) l(location)
        left join cash_flows f on f.location = l.location and f.on_date <= ${to}
       group by l.location`;
    const [owed] = await tx`select coalesce(sum(remaining), 0) as total from owed_to_us`;

    return {
      from,
      to,
      today,
      cutover,
      income: income.map((r) => ({
        date: String(r.date),
        invoiceNumber: str(r.invoice_number),
        client: str(r.client),
        project: str(r.project),
        amount: Number(r.amount ?? 0),
        method: str(r.method),
        receivedBy: str(r.received_by),
        note: str(r.note),
        source: r.source as "Ledger" | "Before ledger",
      })),
      expenses: expenses.map((r) => ({
        date: String(r.date),
        name: String(r.name ?? ""),
        category: str(r.category),
        amount: Number(r.amount ?? 0),
        usdAmount: r.usd_amount == null ? null : Number(r.usd_amount),
        paidFrom: str(r.paid_from),
        paidPersonallyBy: str(r.paid_personally_by),
        reimbursedAt: str(r.reimbursed_at),
        reimbursedFrom: str(r.reimbursed_from),
        recurring: !!r.recurring,
        reference: str(r.reference),
        notes: str(r.notes),
      })),
      founderPay: founderPay.map((r) => ({
        number: String(r.number),
        founder: String(r.founder),
        invoiceNumber: str(r.invoice_number),
        paymentDate: String(r.paid_at),
        base: Number(r.base),
        bonus: Number(r.bonus),
        total: Number(r.total),
        status: r.status as "due" | "paid_out",
        paidOutAt: str(r.paid_out_at),
        paidFrom: str(r.paid_from),
      })),
      cashMovements: cashMovements.map((r) => ({
        date: String(r.moved_at),
        kind: r.kind as "opening" | "transfer",
        from: str(r.from_loc),
        to: str(r.to_loc),
        amount: Number(r.amount),
        note: str(r.note),
      })),
      invoices: invoices.map((r) => ({
        invoiceNumber: str(r.invoice_number),
        client: str(r.client),
        project: str(r.project),
        type: str(r.invoice_type),
        issueDate: str(r.issue_date),
        dueDate: str(r.due_date),
        amount: Number(r.amount ?? 0),
        paidSoFar: Number(r.paid_so_far ?? 0),
        // Same derivation as the dashboard, so Overdue matches what the Finance tab shows.
        status: effectiveStatus({ Status: str(r.status) ?? undefined, "Due Date": str(r.due_date) ?? undefined } as Invoice),
        paidDate: str(r.paid_date),
      })),
      cashAtEnd: Object.fromEntries(cash.map((r) => [String(r.location), Number(r.balance)])) as Record<Holder, number>,
      owedToUsNow: Number(owed.total),
    };
  });
}
