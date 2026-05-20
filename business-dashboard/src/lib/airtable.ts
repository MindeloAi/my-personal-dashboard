import Airtable from "airtable";
import { z } from "zod";

// ─── Lazy client ──────────────────────────────────────────────────────────────
//
// Airtable is only constructed when a fetch / mutation actually runs.
// This keeps `import "@/lib/airtable"` side-effect free, so the dashboard
// page can be statically analyzed for build / page-data without env vars.

export class MissingAirtableEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing Airtable env vars: ${missing.join(", ")}. ` +
        `Set them in .env.local (dev) or Railway service variables (deploy).`,
    );
    this.name = "MissingAirtableEnvError";
  }
}

let _base: Airtable.Base | null = null;

function getBase(): Airtable.Base {
  if (_base) return _base;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const missing: string[] = [];
  if (!apiKey) missing.push("AIRTABLE_API_KEY");
  if (!baseId) missing.push("AIRTABLE_BASE_ID");
  if (missing.length > 0) throw new MissingAirtableEnvError(missing);
  _base = new Airtable({ apiKey }).base(baseId!);
  return _base;
}

// ─── Read schemas ─────────────────────────────────────────────────────────────

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
  Status: z
    .enum(["Draft", "Sent", "Paid", "Overdue", "Void"])
    .optional(),
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
// Strict per-table input shapes. Validated *before* any Airtable mutation —
// so an invalid payload throws locally and never reaches the network.
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

// ─── Read helpers ─────────────────────────────────────────────────────────────

function parseRecord<T>(
  table: string,
  record: Airtable.Record<Airtable.FieldSet>,
  schema: z.ZodType<T>,
): T | null {
  const result = schema.safeParse({ id: record.id, ...record.fields });
  if (result.success) return result.data;
  console.warn("[airtable] dropped record", {
    table,
    id: record.id,
    issues: result.error.issues,
  });
  return null;
}

async function fetchAll<T>(
  table: string,
  schema: z.ZodType<T>,
  opts: Airtable.SelectOptions<Airtable.FieldSet> = {},
): Promise<T[]> {
  const records = await getBase()(table).select(opts).all();
  return records
    .map((r) => parseRecord(table, r, schema))
    .filter((r): r is T => r !== null);
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export const getClients = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Clients", ClientSchema, opts);

export const getProjects = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Projects", ProjectSchema, opts);

export const getInvoices = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Invoices", InvoiceSchema, opts);

export const getExpenses = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Expenses", ExpenseSchema, opts);

export const getMilestones = (
  opts?: Airtable.SelectOptions<Airtable.FieldSet>,
) => fetchAll("Milestones", MilestoneSchema, opts);

export const getLeads = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Leads", LeadSchema, opts);

export const getTasks = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Tasks", TaskSchema, opts);

// Tasks still available to claim (Status = Pending). Used by the task queue
// so terminals only attempt to claim work nobody has picked up yet.
export const getOpenTasks = (
  opts: Airtable.SelectOptions<Airtable.FieldSet> = {},
) =>
  fetchAll("Tasks", TaskSchema, {
    filterByFormula: "{Status} = 'Pending'",
    ...opts,
  });

export const getIdeas = (opts?: Airtable.SelectOptions<Airtable.FieldSet>) =>
  fetchAll("Ideas", IdeaSchema, opts);

// ─── Single-record reads (by id) ───────────────────────────────────────────────
// Used by the in-app automations, which operate on one chosen record.

export async function getLead(id: string): Promise<Lead | null> {
  return parseRecord("Leads", await getBase()("Leads").find(id), LeadSchema);
}

export async function getProject(id: string): Promise<Project | null> {
  return parseRecord("Projects", await getBase()("Projects").find(id), ProjectSchema);
}

export async function getClientById(id: string): Promise<Client | null> {
  return parseRecord("Clients", await getBase()("Clients").find(id), ClientSchema);
}

// ─── Write helpers ────────────────────────────────────────────────────────────
//
// Validate input first. Return the raw record (id + fields) without re-parsing
// through the read schema, so a successful Airtable write is never reported
// as a failure due to an unexpected response field.

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function createRecord<TInput>(
  table: string,
  schema: z.ZodType<TInput>,
  payload: TInput,
): Promise<AirtableRecord> {
  const fields = schema.parse(payload) as Airtable.FieldSet;
  const record = await getBase()(table).create(fields);
  return { id: record.id, fields: record.fields as Record<string, unknown> };
}

async function updateRecord<TInput>(
  table: string,
  schema: z.ZodType<TInput>,
  id: string,
  payload: TInput,
): Promise<AirtableRecord> {
  const fields = schema.parse(payload) as Airtable.FieldSet;
  const record = await getBase()(table).update(id, fields);
  return { id: record.id, fields: record.fields as Record<string, unknown> };
}

async function deleteRecord(table: string, id: string): Promise<{ id: string }> {
  const record = await getBase()(table).destroy(id);
  return { id: record.id };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export const createClient = (payload: ClientWrite) =>
  createRecord("Clients", ClientWriteSchema, payload);

export const createProject = (payload: ProjectWrite) =>
  createRecord("Projects", ProjectWriteSchema, payload);

export const createInvoice = (payload: InvoiceWrite) =>
  createRecord("Invoices", InvoiceWriteSchema, payload);

export const createExpense = (payload: ExpenseWrite) =>
  createRecord("Expenses", ExpenseWriteSchema, payload);

export const updateInvoice = (id: string, payload: InvoiceWrite) =>
  updateRecord("Invoices", InvoiceWriteSchema, id, payload);

export const updateProject = (id: string, payload: ProjectWrite) =>
  updateRecord("Projects", ProjectWriteSchema, id, payload);

export const updateExpense = (id: string, payload: ExpenseWrite) =>
  updateRecord("Expenses", ExpenseWriteSchema, id, payload);

export const deleteProject = (id: string) => deleteRecord("Projects", id);

export const deleteExpense = (id: string) => deleteRecord("Expenses", id);

export const createLead = (payload: LeadWrite) =>
  createRecord("Leads", LeadWriteSchema, payload);

export const updateLead = (id: string, payload: LeadWrite) =>
  updateRecord("Leads", LeadWriteSchema, id, payload);

export const createTask = (payload: TaskWrite) =>
  createRecord("Tasks", TaskWriteSchema, payload);

export const updateTask = (id: string, payload: TaskWrite) =>
  updateRecord("Tasks", TaskWriteSchema, id, payload);

export const createIdea = (payload: IdeaWrite) =>
  createRecord("Ideas", IdeaWriteSchema, payload);

export const updateIdea = (id: string, payload: IdeaWrite) =>
  updateRecord("Ideas", IdeaWriteSchema, id, payload);

// Project metadata (repo / deploy / host / stack) lives on the same Projects
// table; reuse the Project write schema so the extra fields validate too.
export const updateProjectMeta = (id: string, payload: ProjectWrite) =>
  updateRecord("Projects", ProjectWriteSchema, id, payload);

// ─── Task claiming ──────────────────────────────────────────────────────────
//
// Airtable has no atomic compare-and-set, so claiming uses read-write-verify:
//   1. read the row; bail if it isn't Pending
//   2. write Status="In Progress" + Picked Up By=terminalId
//   3. re-read; the terminal whose write landed last owns "Picked Up By"
// Under a concurrent double-claim the last writer wins and every other caller
// re-reads a different terminal id, so exactly one caller gets `{ ok: true }`.

export type ClaimResult =
  | { ok: true; task: AirtableRecord }
  | { ok: false; reason: "not-pending" | "lost-race" };

export async function claimTask(
  taskId: string,
  terminalId: string,
): Promise<ClaimResult> {
  const tasks = getBase()("Tasks");

  const current = await tasks.find(taskId);
  if (current.fields["Status"] !== "Pending") {
    return { ok: false, reason: "not-pending" };
  }

  await tasks.update(taskId, {
    Status: "In Progress",
    "Picked Up By": terminalId,
  });

  const verified = await tasks.find(taskId);
  if (verified.fields["Picked Up By"] === terminalId) {
    return {
      ok: true,
      task: {
        id: verified.id,
        fields: verified.fields as Record<string, unknown>,
      },
    };
  }
  return { ok: false, reason: "lost-race" };
}
