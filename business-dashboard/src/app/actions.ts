"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, createClient } from "@/lib/auth";
import { format } from "date-fns";
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
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
  type ClientWrite,
} from "@/lib/airtable";

export async function markInvoicePaid(invoiceId: string) {
  await requireAdmin();
  await updateInvoice(invoiceId, {
    Status: "Paid",
    "Paid Date": format(new Date(), "yyyy-MM-dd"),
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

export async function createInvoiceAction(data: InvoiceWrite) {
  await requireAdmin();
  await createInvoice(data);
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
  // Revenue/profit metrics require Status "Paid" + a Paid Date to both be
  // set (see hero-cards.tsx etc.) — stamp today's date if the caller is
  // flipping to Paid without supplying one, so an invoice never goes
  // "Paid" but invisible to those calculations.
  const payload =
    data.Status === "Paid" && !data["Paid Date"]
      ? { ...data, "Paid Date": format(new Date(), "yyyy-MM-dd") }
      : data;
  await updateInvoice(id, payload);
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

// ─── Session ────────────────────────────────────────────────────────────────

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
