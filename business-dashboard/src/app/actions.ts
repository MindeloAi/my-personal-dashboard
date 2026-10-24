"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, createClient } from "@/lib/auth";
import {
  updateInvoice,
  updateProject,
  updateExpense,
  createInvoice,
  createExpense,
  createProject,
  deleteProject,
  deleteExpense,
  createLead,
  updateLead,
  deleteLead,
  createClient as createClientRow,
  updateClient,
  deleteClient,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
  type ClientWrite,
  type SubscriptionWrite,
} from "@/lib/airtable";
import {
  getCutoverDate,
  ledgerErrorMessage,
  recordPayment,
  deletePayment,
  markPayoutPaidOut,
  undoPayoutPaidOut,
  createTransfer,
  deleteTransfer,
  createCashCount,
  deleteLatestCashCount,
  reimburseExpense,
  undoReimburseExpense,
  getClientById,
} from "@/lib/db";
import { HOLDERS, PAYMENT_METHODS } from "@/lib/ledger";
import { z } from "zod";
import { today } from "@/lib/subscriptions";
import { suggestPromises, type SuggestResult } from "@/lib/suggest";
import {
  BAD_LINK,
  CalendarDay,
  MAX_LINE,
  MAX_QUOTE,
  MAX_SUGGESTIONS,
  MAX_TEXT,
  MAX_WHAT,
  WEB_LINK,
  badLink,
  textTooLong,
} from "@/lib/timeline";
import {
  TimelineConflictError,
  getOpenPromises,
  saveEntry,
  createPromise,
  updatePromise,
  closePromise,
  reopenPromise,
  replacePromise,
  deletePromise,
  updateEntry,
  deleteEntry,
} from "@/lib/timeline-db";

// Ledger-era actions return { error } instead of throwing for a business-rule
// rejection: Next redacts thrown messages in production, and "That is TT$500
// more than is owed" is exactly what the user needs to see. Anything else
// (auth, bugs) still throws.
export type ActionResult = { error?: string };

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (err) {
    const message = ledgerErrorMessage(err);
    if (message) return { error: message };
    throw err;
  }
  revalidatePath("/", "layout");
  return {};
}

const Holder = z.enum(HOLDERS);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Money = z.number().positive().finite();

// Paid is reached only by recording payments (on_payment_insert). No form may
// set it directly, or the invoice would close without payouts or cash.
function rejectDirectPaid(data: InvoiceWrite) {
  if (data.Status === "Paid") throw new Error("Paid is set by recording a payment");
}

// Shares are agreed per invoice: both set and totalling 100%, both left alone
// (undefined), or both cleared (null). Stored as fractions. The create form
// insists on them; drafts raised elsewhere (subscriptions) may omit them, and
// the payment trigger refuses any payment until they are set.
function checkShares(data: InvoiceWrite): string | null {
  const m = data["Michael Bonus Share"];
  const zs = data["Zane Bonus Share"];
  if (m === zs && (m === undefined || m === null)) return null;
  if (m == null || zs == null) return "Set both bonus shares.";
  if (Math.round((m + zs) * 10000) !== 10000) return "Bonus shares must total 100%.";
  return null;
}

// On an edit that does not touch the paid-with fields (e.g. a reimbursed
// expense, whose source is frozen) there is nothing to check.
async function checkExpensePaidWith(data: ExpenseWrite, partial = false): Promise<string | null> {
  if (partial && data["Paid From"] === undefined && data["Paid Personally By"] === undefined) return null;
  if (!data.Date || data.Date < (await getCutoverDate())) return null;
  if (data["Paid From"] || data["Paid Personally By"]) return null;
  return "Choose what this expense was paid with.";
}

export async function updateProjectStatus(
  projectId: string,
  status: "Lead" | "In Progress" | "Review" | "Done" | "Cancelled",
) {
  await requireAdmin();
  await updateProject(projectId, { Status: status });
  revalidatePath("/", "layout");
}

export async function createInvoiceAction(data: InvoiceWrite): Promise<ActionResult> {
  await requireAdmin();
  rejectDirectPaid(data);
  const bad = checkShares(data);
  if (bad) return { error: bad };
  return run(() => createInvoice(data));
}

export async function createExpenseAction(data: ExpenseWrite): Promise<ActionResult> {
  await requireAdmin();
  const bad = await checkExpensePaidWith(data);
  if (bad) return { error: bad };
  return run(() => createExpense(data));
}

export async function createProjectAction(data: ProjectWrite) {
  await requireAdmin();
  await createProject(data);
  revalidatePath("/", "layout");
}

export async function updateExpenseAction(id: string, data: ExpenseWrite): Promise<ActionResult> {
  await requireAdmin();
  const bad = await checkExpensePaidWith(data, true);
  if (bad) return { error: bad };
  return run(() => updateExpense(id, data));
}

// The edit form never sends Status for an invoice that is already Paid, and the
// database locks amount and shares once a payment exists.
export async function updateInvoiceAction(id: string, data: InvoiceWrite): Promise<ActionResult> {
  await requireAdmin();
  rejectDirectPaid(data);
  const bad = checkShares(data);
  if (bad) return { error: bad };
  return run(() => updateInvoice(id, data));
}

export async function updateProjectAction(id: string, data: ProjectWrite) {
  await requireAdmin();
  await updateProject(id, data);
  revalidatePath("/", "layout");
}

export async function deleteProjectAction(id: string) {
  await requireAdmin();
  await deleteProject(id);
  revalidatePath("/", "layout");
}

export async function deleteExpenseAction(id: string) {
  await requireAdmin();
  await deleteExpense(id);
  revalidatePath("/", "layout");
}

// ─── Leads ──────────────────────────────────────────────────────────────────

// Public intake form submission. New leads default to Status "New".
export async function submitIntakeAction(data: LeadWrite) {
  await createLead({ Status: "New", ...data });
  revalidatePath("/", "layout");
}

export async function createLeadAction(data: LeadWrite) {
  await requireAdmin();
  await createLead(data);
  revalidatePath("/", "layout");
}

export async function updateLeadStatusAction(
  id: string,
  status: "New" | "Contacted" | "Proposal Sent" | "Won" | "Lost",
) {
  await requireAdmin();
  await updateLead(id, { Status: status });
  revalidatePath("/", "layout");
}

export async function updateLeadAction(id: string, data: LeadWrite) {
  await requireAdmin();
  await updateLead(id, data);
  revalidatePath("/", "layout");
}

export async function deleteLeadAction(id: string) {
  await requireAdmin();
  await deleteLead(id);
  revalidatePath("/", "layout");
}

// ─── Clients ────────────────────────────────────────────────────────────────

export async function createClientAction(data: ClientWrite) {
  await requireAdmin();
  await createClientRow(data);
  revalidatePath("/", "layout");
}

export async function updateClientAction(id: string, data: ClientWrite) {
  await requireAdmin();
  await updateClient(id, data);
  revalidatePath("/", "layout");
}

// Detaches linked projects and invoices (ON DELETE SET NULL). The UI warns with
// exact counts before calling this.
export async function deleteClientAction(id: string) {
  await requireAdmin();
  await deleteClient(id);
  revalidatePath("/", "layout");
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

// Start date is required: without it a subscription is never live and has no
// billing anchor. Create must send one; an edit may omit it but never clear it.
export async function createSubscriptionAction(data: SubscriptionWrite) {
  await requireAdmin();
  if (!data["Start Date"]) throw new Error("Start date is required");
  await createSubscription(data);
  revalidatePath("/", "layout");
}

export async function updateSubscriptionAction(id: string, data: SubscriptionWrite) {
  await requireAdmin();
  if (data["Start Date"] === "") throw new Error("Start date is required");
  await updateSubscription(id, data);
  revalidatePath("/", "layout");
}

// invoices.subscription_id is ON DELETE SET NULL, so invoices already raised
// survive and keep counting as revenue — they just stop being attributable to a
// retainer, which resets nothing but the derived schedule. The UI warns first.
export async function deleteSubscriptionAction(id: string) {
  await requireAdmin();
  await deleteSubscription(id);
  revalidatePath("/", "layout");
}

// ─── Founder ledger ─────────────────────────────────────────────────────────
//
// Every write stamps the signed-in founder's email. All money arithmetic is in
// the database (migration 011); these validate shape and pass through.

const PaymentForm = z.object({
  invoiceId: z.string().uuid(),
  amount: Money,
  paidAt: Day,
  receivedBy: Holder,
  method: z.enum(PAYMENT_METHODS).nullable(),
  note: z.string().nullable(),
  /** "Pay out founders now": both payouts paid out on paidAt from this holder. */
  payOutFrom: Holder.nullable(),
});

export async function recordPaymentAction(input: z.infer<typeof PaymentForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = PaymentForm.parse(input);
  return run(() => recordPayment({ ...p, createdBy: admin.email }));
}

export async function deletePaymentAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => deletePayment(id));
}

export async function markPayoutPaidOutAction(id: string, paidOutAt: string, paidFrom: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => markPayoutPaidOut(id, Day.parse(paidOutAt), Holder.parse(paidFrom)));
}

export async function undoPayoutPaidOutAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => undoPayoutPaidOut(id));
}

const TransferForm = z
  .object({ movedAt: Day, fromLoc: Holder, toLoc: Holder, amount: Money, note: z.string().nullable() })
  .refine((t) => t.fromLoc !== t.toLoc, "From and to must differ");

export async function recordTransferAction(input: z.infer<typeof TransferForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = TransferForm.parse(input);
  return run(() => createTransfer({ ...t, createdBy: admin.email }));
}

export async function deleteTransferAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => deleteTransfer(id));
}

const CountForm = z.object({
  countedAt: Day,
  location: Holder,
  amount: z.number().min(0).finite(),
  note: z.string().nullable(),
});

export async function recordCashCountAction(input: z.infer<typeof CountForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const c = CountForm.parse(input);
  return run(() => createCashCount({ ...c, createdBy: admin.email }));
}

export async function deleteLatestCashCountAction(location: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => deleteLatestCashCount(Holder.parse(location)));
}

export async function reimburseExpenseAction(id: string, reimbursedAt: string, from: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => reimburseExpense(id, Day.parse(reimbursedAt), Holder.parse(from)));
}

export async function undoReimburseExpenseAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => undoReimburseExpense(id));
}

// ─── Client timeline ────────────────────────────────────────────────────────

const INVALID = "That request was not valid.";

// A stale suggestion (the promise changed while the dialog was open) comes back
// as { error } so the dialog can show it; Next would redact a thrown message.
async function runTimeline(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof TimelineConflictError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: INVALID };
    throw err;
  }
  revalidatePath("/", "layout");
  return {};
}

// A non-uuid string would reach Postgres as a raw cast error, so ids are checked here.
const Id = z.uuid();
const Kind = z.enum(["call", "meeting", "email", "message", "document"]);
const Dir = z.enum(["received", "sent", "both"]);
const Side = z.enum(["us", "client"]);
const Text = z.string().max(MAX_TEXT); // backstop; textTooLong gives the message
const SuggestionForm = z.object({
  action: z.enum(["new", "done", "replace"]),
  promiseId: Id.nullable(),
  owedBy: Side,
  what: z.string().min(1).max(MAX_WHAT),
  dueOn: CalendarDay.nullable(),
  quote: z.string().max(MAX_QUOTE),
});
const EntryFields = {
  occurredOn: CalendarDay,
  kind: Kind,
  direction: Dir,
  summary: z.string().min(1).max(MAX_LINE),
  people: z.string().max(MAX_LINE).nullable(),
  body: Text.nullable(),
  link: z.string().max(2000).regex(WEB_LINK, BAD_LINK).nullable(), // backstop; badLink gives the message
};
const EntryForm = z.object(EntryFields);
const SuggestForm = z.object({ clientId: Id, occurredOn: CalendarDay, kind: Kind, direction: Dir, text: Text });
const SaveEntryForm = z.object({ clientId: Id, ...EntryFields, suggestions: z.array(SuggestionForm).max(MAX_SUGGESTIONS) });
const PromiseFields = { owedBy: Side, what: z.string().min(1).max(MAX_WHAT), dueOn: CalendarDay.nullable() };
const PromiseForm = z.object(PromiseFields);
const CreatePromiseForm = z.object({ clientId: Id, entryId: Id.nullable(), ...PromiseFields });
const ClosePromiseForm = z.object({ status: z.enum(["done", "dropped"]), note: z.string().max(1000).nullable() });

// Reads and asks Claude; never writes. Failures come back as { ok: false, error }.
export async function suggestPromisesAction(input: z.infer<typeof SuggestForm>): Promise<SuggestResult> {
  await requireAdmin();
  const tooLong = typeof input?.text === "string" ? textTooLong(input.text) : null;
  if (tooLong) return { ok: false, error: tooLong };
  const parsed = SuggestForm.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };
  const { clientId, ...rest } = parsed.data;
  const client = await getClientById(clientId);
  if (!client) return { ok: false, error: "That client no longer exists." };
  return suggestPromises({ ...rest, clientName: client.Company || client.Name, open: await getOpenPromises(clientId) });
}

export async function saveEntryAction(input: z.infer<typeof SaveEntryForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const tooLong = typeof input?.body === "string" ? textTooLong(input.body) : null;
  if (tooLong) return { error: tooLong };
  const notWeb = typeof input?.link === "string" ? badLink(input.link) : null;
  if (notWeb) return { error: notWeb };
  return runTimeline(() => saveEntry({ ...SaveEntryForm.parse(input), createdBy: admin.email }));
}

export async function createPromiseAction(input: z.infer<typeof CreatePromiseForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  return runTimeline(() => createPromise({ ...CreatePromiseForm.parse(input), createdBy: admin.email }));
}

export async function updatePromiseAction(id: string, input: z.infer<typeof PromiseForm>): Promise<ActionResult> {
  await requireAdmin();
  return runTimeline(() => updatePromise(Id.parse(id), PromiseForm.parse(input)));
}

export async function closePromiseAction(id: string, input: z.infer<typeof ClosePromiseForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  return runTimeline(() =>
    closePromise(Id.parse(id), { ...ClosePromiseForm.parse(input), closedOn: today(), closedBy: admin.email }),
  );
}

export async function reopenPromiseAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return runTimeline(() => reopenPromise(Id.parse(id)));
}

export async function replacePromiseAction(id: string, input: z.infer<typeof PromiseForm>): Promise<ActionResult> {
  const admin = await requireAdmin();
  return runTimeline(() =>
    replacePromise(Id.parse(id), { ...PromiseForm.parse(input), closedOn: today(), createdBy: admin.email }),
  );
}

export async function deletePromiseAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return runTimeline(() => deletePromise(Id.parse(id)));
}

export async function updateEntryAction(id: string, input: z.infer<typeof EntryForm>): Promise<ActionResult> {
  await requireAdmin();
  const notWeb = typeof input?.link === "string" ? badLink(input.link) : null;
  if (notWeb) return { error: notWeb };
  return runTimeline(() => updateEntry(Id.parse(id), EntryForm.parse(input)));
}

export async function deleteEntryAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  return runTimeline(() => deleteEntry(Id.parse(id)));
}

// ─── Session ────────────────────────────────────────────────────────────────

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
