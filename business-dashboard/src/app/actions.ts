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
  createTask,
  updateTask,
  claimTask,
  createIdea,
  updateIdea,
  updateProjectMeta,
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
  type TaskWrite,
  type IdeaWrite,
  type ClaimResult,
} from "@/lib/airtable";

export async function markInvoicePaid(invoiceId: string) {
  await updateInvoice(invoiceId, {
    Status: "Paid",
    "Paid Date": format(new Date(), "yyyy-MM-dd"),
  });
  revalidatePath("/dashboard");
}

export async function updateProjectStatus(
  projectId: string,
  status: "Lead" | "In Progress" | "Review" | "Done" | "Cancelled",
) {
  await updateProject(projectId, { Status: status });
  revalidatePath("/dashboard");
}

export async function createInvoiceAction(data: InvoiceWrite) {
  await createInvoice(data);
  revalidatePath("/dashboard");
}

export async function createExpenseAction(data: ExpenseWrite) {
  await createExpense(data);
  revalidatePath("/dashboard");
}

export async function createProjectAction(data: ProjectWrite) {
  await createProject(data);
  revalidatePath("/dashboard");
}

export async function updateExpenseAction(id: string, data: ExpenseWrite) {
  await updateExpense(id, data);
  revalidatePath("/dashboard");
}

export async function updateInvoiceAction(id: string, data: InvoiceWrite) {
  await updateInvoice(id, data);
  revalidatePath("/dashboard");
}

export async function updateProjectAction(id: string, data: ProjectWrite) {
  await updateProject(id, data);
  revalidatePath("/dashboard");
}

export async function deleteProjectAction(id: string) {
  await deleteProject(id);
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(id: string) {
  await deleteExpense(id);
  revalidatePath("/dashboard");
}

// ─── Leads ──────────────────────────────────────────────────────────────────

// Public intake form submission. New leads default to Status "New".
export async function submitIntakeAction(data: LeadWrite) {
  await createLead({ Status: "New", ...data });
  revalidatePath("/dashboard");
}

export async function createLeadAction(data: LeadWrite) {
  await createLead(data);
  revalidatePath("/dashboard");
}

export async function updateLeadStatusAction(
  id: string,
  status: "New" | "Contacted" | "Proposal Sent" | "Won" | "Lost",
) {
  await updateLead(id, { Status: status });
  revalidatePath("/dashboard");
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function createTaskAction(data: TaskWrite) {
  await createTask(data);
  revalidatePath("/dashboard");
}

export async function claimTaskAction(
  taskId: string,
  terminalId: string,
): Promise<ClaimResult> {
  const result = await claimTask(taskId, terminalId);
  revalidatePath("/dashboard");
  return result;
}

// Return a claimed task to the pool: back to Pending, owner cleared.
export async function releaseTaskAction(taskId: string) {
  await updateTask(taskId, { Status: "Pending", "Picked Up By": "" });
  revalidatePath("/dashboard");
}

export async function updateTaskAction(id: string, data: TaskWrite) {
  await updateTask(id, data);
  revalidatePath("/dashboard");
}

// ─── Ideas ──────────────────────────────────────────────────────────────────

export async function createIdeaAction(data: IdeaWrite) {
  await createIdea(data);
  revalidatePath("/dashboard");
}

export async function updateIdeaAction(id: string, data: IdeaWrite) {
  await updateIdea(id, data);
  revalidatePath("/dashboard");
}

// ─── Projects (metadata) ──────────────────────────────────────────────────────

export async function updateProjectMetaAction(id: string, data: ProjectWrite) {
  await updateProjectMeta(id, data);
  revalidatePath("/dashboard");
}
