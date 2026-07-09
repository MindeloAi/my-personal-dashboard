"use server";

import { revalidatePath } from "next/cache";
import { readFile } from "fs/promises";
import path from "path";
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
  getLead,
  getProject,
  createTask,
  updateTask,
  claimTask,
  createIdea,
  updateIdea,
  updateProjectMeta,
  LeadWriteSchema,
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
  type TaskWrite,
  type IdeaWrite,
  type ClaimResult,
} from "@/lib/airtable";
import {
  generateInvoiceNumber,
  getAgencyConfig,
  addDaysISO,
} from "@/lib/invoice-format";
import { complete, MissingAnthropicEnvError } from "@/lib/anthropic";

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
  // Revenue/profit metrics require Status "Paid" + a Paid Date to both be
  // set (see hero-cards.tsx etc.) — stamp today's date if the caller is
  // flipping to Paid without supplying one, so an invoice never goes
  // "Paid" but invisible to those calculations.
  const payload =
    data.Status === "Paid" && !data["Paid Date"]
      ? { ...data, "Paid Date": format(new Date(), "yyyy-MM-dd") }
      : data;
  await updateInvoice(id, payload);
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

// ─── Automations (executed in-app) ─────────────────────────────────────────────
//
// These run the work directly rather than queuing a Task: the AI ones call
// Claude and write the result back to Airtable. Each returns a structured
// { ok, message } so the launcher can show a graceful toast — server actions
// redact thrown error messages in production, so we never throw for expected
// failures (e.g. a missing API key).

// Turn an unexpected error into a user-facing message. Known typed errors carry
// a helpful message; anything else is logged and reported generically.
function automationError(err: unknown): string {
  if (err instanceof MissingAnthropicEnvError) return err.message;
  console.error("[automation] action failed:", err);
  return "Automation failed. Check the server logs.";
}

// Pull a JSON array out of a model response, tolerating ```json fences.
function extractJsonArray(raw: string): unknown[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  const parsed = JSON.parse(body.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

export async function draftProposalAction(
  leadId: string,
  opts: { scope?: string; tone?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  try {
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, message: "Lead not found." };

    const playbook = await readFile(
      path.join(process.cwd(), "proposals", "restaurant-playbook.md"),
      "utf8",
    );

    const system =
      "You draft website + AI-automation proposals for a Trinidad & Tobago digital agency. " +
      "Follow the playbook exactly: tiers, T&T context, TTD pricing, structure, and tone. " +
      "You ONLY draft — never send. Output just the proposal text: greeting by name + business, " +
      "what we understand they need, what we'd build (bullets), investment in TTD, timeline, and the next step. " +
      "Keep it warm, concrete, and short. If the lead's info is thin, draft your best version and note the gaps.";

    const leadCtx = [
      `Name: ${lead.Name ?? "—"}`,
      `Business: ${lead["Business Name"] ?? "—"}`,
      `Service Interest: ${lead["Service Interest"] ?? "—"}`,
      `Budget Range: ${lead["Budget Range"] ?? "—"}`,
      `Current Website: ${lead["Current Website"] ?? "—"}`,
      `Message: ${lead.Message ?? "—"}`,
      opts.scope ? `Extra scope / asks: ${opts.scope}` : "",
      `Tone: ${opts.tone ?? "professional"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const proposal = await complete({
      cachedSystem: playbook,
      system,
      user: `Draft a proposal for this lead:\n\n${leadCtx}`,
    });

    await updateLead(leadId, {
      "Proposal Draft": proposal,
      Status: "Proposal Sent",
      "Follow-up Date": addDaysISO(new Date(), 3),
    });
    revalidatePath("/dashboard");
    return { ok: true, message: "Proposal drafted — review it in the lead's row." };
  } catch (err) {
    return { ok: false, message: automationError(err) };
  }
}

export async function generateLeadsAction(opts: {
  niche: string;
  location?: string;
  count?: number;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const n = Math.min(Math.max(opts.count ?? 10, 1), 25);
    const system =
      "You research prospective B2B leads for a Trinidad & Tobago web / AI agency. " +
      "Return ONLY a JSON array (no prose, no code fences) of objects with the keys: " +
      "name, businessName, serviceInterest, budgetRange, message. " +
      "Use realistic Trinidad & Tobago businesses for the given niche and location. " +
      "`message` is a one-line note on why each is a fit.";

    const raw = await complete({
      system,
      user: `Generate ${n} prospective leads. Niche: ${opts.niche}. Location: ${opts.location ?? "Trinidad & Tobago"}.`,
      maxTokens: 8000,
    });

    let created = 0;
    for (const item of extractJsonArray(raw)) {
      const o = item as Record<string, unknown>;
      const candidate = {
        Name: typeof o.name === "string" ? o.name : undefined,
        "Business Name": typeof o.businessName === "string" ? o.businessName : undefined,
        "Service Interest": typeof o.serviceInterest === "string" ? o.serviceInterest : undefined,
        "Budget Range": typeof o.budgetRange === "string" ? o.budgetRange : undefined,
        Message: typeof o.message === "string" ? o.message : undefined,
        Source: "AI generate-leads",
        Status: "New" as const,
      };
      const result = LeadWriteSchema.safeParse(candidate);
      if (!result.success || !result.data.Name) continue;
      try {
        await createLead(result.data);
        created++;
      } catch (err) {
        console.warn("[generate-leads] failed to create a lead:", err);
      }
    }

    revalidatePath("/dashboard");
    if (created === 0) {
      return { ok: false, message: "No valid leads were generated. Try a more specific niche." };
    }
    return { ok: true, message: `Added ${created} lead${created === 1 ? "" : "s"} (Status: New).` };
  } catch (err) {
    return { ok: false, message: automationError(err) };
  }
}

export async function researchAction(opts: {
  topic: string;
  depth?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const deep = opts.depth === "deep";
    const system =
      "You are a research assistant for a small Trinidad & Tobago web / AI agency. " +
      "Produce a clear, well-structured research brief in Markdown: key findings, " +
      "opportunities, and recommended next steps. Be concrete and concise.";

    const result = await complete({
      system,
      user: `Research topic: ${opts.topic}. Depth: ${deep ? "deep dive" : "quick scan"}.`,
      maxTokens: deep ? 16000 : 8000,
    });

    await createIdea({
      Title: opts.topic,
      Description: `Research (${deep ? "deep dive" : "quick scan"})`,
      Notes: result,
      Category: "internal",
      Status: "Raw",
    });
    revalidatePath("/dashboard");
    return { ok: true, message: "Research saved to Ideas." };
  } catch (err) {
    return { ok: false, message: automationError(err) };
  }
}

export async function generateInvoiceAction(opts: {
  projectId: string;
  invoiceType?: "deposit" | "milestone" | "final" | "recurring" | "one_off";
  amount?: number;
  dueDate?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const project = await getProject(opts.projectId);
    if (!project) return { ok: false, message: "Project not found." };

    const today = new Date().toISOString().slice(0, 10);
    const agency = getAgencyConfig();
    const invoiceNumber = generateInvoiceNumber();
    const amount =
      opts.amount != null && Number.isFinite(opts.amount)
        ? opts.amount
        : project["Total Value"] ?? 0;
    const dueDate = opts.dueDate || addDaysISO(today, agency.paymentDueDays);

    await createInvoice({
      "Invoice Number": invoiceNumber,
      Project: [project.id],
      Client: project.Client,
      Amount: amount,
      "Invoice Type": opts.invoiceType,
      Status: "Sent",
      "Issue Date": today,
      "Due Date": dueDate,
      Notes: `Auto-generated ${invoiceNumber}`,
    });
    revalidatePath("/dashboard");
    return { ok: true, message: `Invoice ${invoiceNumber} created.` };
  } catch (err) {
    return { ok: false, message: automationError(err) };
  }
}
