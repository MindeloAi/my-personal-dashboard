"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, createClient } from "@/lib/auth";
import { today } from "@/lib/subscriptions";
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

export async function markInvoicePaid(invoiceId: string) {
  await requireAdmin();
  await updateInvoice(invoiceId, {
    Status: "Paid",
    "Paid Date": today(),
  });
  revalidatePath("/", "layout");
}

export async function updateProjectStatus(
  projectId: string,
  status: "Lead" | "In Progress" | "Review" | "Done" | "Cancelled",
) {
  await requireAdmin();
  await updateProject(projectId, { Status: status });
  revalidatePath("/", "layout");
}

// Revenue/profit metrics require Status "Paid" + a Paid Date to both be set
// (see hero-cards.tsx etc.), so an invoice saved as Paid without one gets
// today's date rather than going "Paid" but invisible to those calculations.
function withPaidDate(data: InvoiceWrite): InvoiceWrite {
  return data.Status === "Paid" && !data["Paid Date"] ? { ...data, "Paid Date": today() } : data;
}

export async function createInvoiceAction(data: InvoiceWrite) {
  await requireAdmin();
  await createInvoice(withPaidDate(data));
  revalidatePath("/", "layout");
}

export async function createExpenseAction(data: ExpenseWrite) {
  await requireAdmin();
  await createExpense(data);
  revalidatePath("/", "layout");
}

export async function createProjectAction(data: ProjectWrite) {
  await requireAdmin();
  await createProject(data);
  revalidatePath("/", "layout");
}

export async function updateExpenseAction(id: string, data: ExpenseWrite) {
  await requireAdmin();
  await updateExpense(id, data);
  revalidatePath("/", "layout");
}

export async function updateInvoiceAction(id: string, data: InvoiceWrite) {
  await requireAdmin();
  await updateInvoice(id, withPaidDate(data));
  revalidatePath("/", "layout");
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

// ─── Session ────────────────────────────────────────────────────────────────

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
