"use server";

import { revalidatePath } from "next/cache";
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
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
} from "@/lib/airtable";

export async function markInvoicePaid(invoiceId: string) {
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
  await updateProject(projectId, { Status: status });
  revalidatePath("/", "layout");
}

export async function createInvoiceAction(data: InvoiceWrite) {
  await createInvoice(data);
  revalidatePath("/", "layout");
}

export async function createExpenseAction(data: ExpenseWrite) {
  await createExpense(data);
  revalidatePath("/", "layout");
}

export async function createProjectAction(data: ProjectWrite) {
  await createProject(data);
  revalidatePath("/", "layout");
}

export async function updateExpenseAction(id: string, data: ExpenseWrite) {
  await updateExpense(id, data);
  revalidatePath("/", "layout");
}

export async function updateInvoiceAction(id: string, data: InvoiceWrite) {
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
  await updateProject(id, data);
  revalidatePath("/", "layout");
}

export async function deleteProjectAction(id: string) {
  await deleteProject(id);
  revalidatePath("/", "layout");
}

export async function deleteExpenseAction(id: string) {
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
  await createLead(data);
  revalidatePath("/", "layout");
}

export async function updateLeadStatusAction(
  id: string,
  status: "New" | "Contacted" | "Proposal Sent" | "Won" | "Lost",
) {
  await updateLead(id, { Status: status });
  revalidatePath("/", "layout");
}
