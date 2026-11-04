// Every tool the Claude connector exposes, as plain functions (tested without
// HTTP in scripts/connector-tools.test.ts; served by app/api/mcp/route.ts).
//
// This list is the safety boundary: there is no dev database, so Claude can do
// exactly these things and nothing else. No tool deletes, runs SQL, records a
// payment, touches founder pay or splits, or returns bank details.
import { z } from "zod";
import { createClientAndProject, findRecords, getClientContext } from "../connector-db";
import {
  DocumentRuleError,
  createDocument,
  createInvoiceFromDeal,
  createReceiptForPayment,
  finaliseDocument,
  getDealByProject,
  getDocument,
  getEntityActivity,
  listDocuments,
  saveDeal,
  saveDraftSections,
  setDocumentPayee,
  setDocumentStatus,
} from "../documents-db";
import { DOC_STATUSES, DOC_TYPES, PAYEES } from "../documents";
import { DEFAULT_SECTIONS } from "../doc-templates";
import { getProject } from "../db";
import { ensurePdf } from "../pdf/store";

export const DASHBOARD = "https://mindelo.site";
const docUrl = (id: string) => `${DASHBOARD}/admin/documents/${id}`;
const pdfUrl = (id: string, version?: number) => `${docUrl(id)}/pdf${version ? `?version=${version}` : ""}`;

const id = z.uuid();
// No .transform() anywhere in a tool's input: MCP publishes each input as JSON
// Schema, and zod cannot express a transform there. Rounding happens in run().
const money = z.number().nonnegative();
const cents = (n: number) => Math.round(n * 100) / 100;
const Section = z.object({ key: z.string().trim().min(1), heading: z.string().trim().min(1), body: z.string() });
const ScheduleLine = z.object({ label: z.string().trim().min(1), amount: money, trigger: z.string().trim().min(1) });
const CarePlan = z.object({
  monthlyAmount: money,
  minimumMonths: z.number().int().nonnegative(),
  noticeDays: z.number().int().nonnegative(),
  inclusions: z.array(z.string().trim().min(1)),
  exclusions: z.array(z.string().trim().min(1)),
});

type Tool<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  run: (args: z.output<S>, actor: string) => Promise<unknown>;
};
/** Erased so the list is one type: callers always parse with `input` before `run`. */
export type AnyTool = Omit<Tool<z.ZodType>, "run"> & { run: (args: any, actor: string) => Promise<unknown> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const tool = <S extends z.ZodType>(t: Tool<S>): AnyTool => t as AnyTool;

export const TOOLS: AnyTool[] = [
  tool({
    name: "find",
    title: "Find records",
    description: "Search clients, leads, projects, deal references (like IB-2026-01) and document titles. Use before creating anything, so nothing is duplicated. A deal hit's id is its project id.",
    input: z.object({ query: z.string().min(2) }),
    run: ({ query }) => findRecords(query),
  }),
  tool({
    name: "get_client_context",
    title: "Everything about a client",
    description: "One client with their projects (each with its deal: what was offered, price, payment schedule, care plan, deadline), documents, invoices with amounts paid, recorded payments (ids for create_receipt), and recent activity. Read this before drafting anything for a client.",
    input: z.object({ clientId: id }),
    run: async ({ clientId }) => {
      const ctx = await getClientContext(clientId);
      if (!ctx) throw new DocumentRuleError("No client with that id. Use find.");
      return ctx;
    },
  }),
  tool({
    name: "get_deal",
    title: "Get a project's deal",
    description: "What was offered on one project: scope, price, payment schedule, care plan, deadline, goals, notes and default payee. Null if the project has no deal yet.",
    input: z.object({ projectId: id }),
    run: ({ projectId }) => getDealByProject(projectId),
  }),
  tool({
    name: "save_deal",
    title: "Create or update a project's deal",
    description: "Record what was offered on a project. Send only the fields that change; the rest are kept. A new deal needs a reference (CLIENT-YYYY-NN). Payment schedule amounts must add up to the price. Set payeeDefault only when a founder says who is being paid; never assume it.",
    input: z.object({
      projectId: id,
      reference: z.string().trim().optional(),
      scope: z.array(z.string().trim().min(1)).optional(),
      priceTotal: money.nullable().optional(),
      paymentSchedule: z.array(ScheduleLine).optional(),
      carePlan: CarePlan.nullable().optional(),
      deadline: z.iso.date().nullable().optional(),
      goals: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      payeeDefault: z.enum(PAYEES).nullable().optional(),
    }),
    run: async (a, actor) => {
      const current = await getDealByProject(a.projectId);
      const reference = a.reference ?? current?.reference;
      if (!reference) throw new DocumentRuleError("This project has no deal yet. Send a reference like IB-2026-01.");
      const pick = <K extends keyof typeof a>(k: K, fallback: unknown) => (a[k] === undefined ? fallback : a[k]);
      return saveDeal(
        {
          projectId: a.projectId,
          reference,
          scope: pick("scope", current?.scope ?? []) as string[],
          priceTotal: a.priceTotal != null ? cents(a.priceTotal) : (pick("priceTotal", current?.priceTotal ?? null) as number | null),
          paymentSchedule: (pick("paymentSchedule", current?.paymentSchedule ?? []) as z.output<typeof ScheduleLine>[])
            .map((l) => ({ ...l, amount: cents(l.amount) })),
          carePlan: ((c) => (c ? { ...c, monthlyAmount: cents(c.monthlyAmount) } : null))(
            pick("carePlan", current?.carePlan ?? null) as z.output<typeof CarePlan> | null),
          deadline: pick("deadline", current?.deadline ?? null) as string | null,
          goals: pick("goals", current?.goals ?? null) as string | null,
          notes: pick("notes", current?.notes ?? null) as string | null,
          payeeDefault: pick("payeeDefault", current?.payeeDefault ?? null) as (typeof PAYEES)[number] | null,
        },
        actor,
        "claude",
      );
    },
  }),
  tool({
    name: "create_client_and_project",
    title: "New client (or lead) with a project",
    description: "Create a client, or a lead when they have not agreed to work with us yet, plus one project and an empty deal with a fresh reference. Refuses a name that already exists: use find first.",
    input: z.object({
      name: z.string().trim().min(1),
      company: z.string().trim().nullable().default(null),
      // Trimmed, then checked; an empty string is allowed and stored as no email.
      email: z.string().trim().pipe(z.union([z.email(), z.literal("")])).nullable().default(null),
      phone: z.string().trim().nullable().default(null),
      asLead: z.boolean().default(false),
      projectName: z.string().trim().min(1),
    }),
    run: (a, actor) => createClientAndProject(a, actor, "claude"),
  }),
  tool({
    name: "list_documents",
    title: "List documents",
    description: "Documents filtered by client, project, type or status, newest first. Draft text is left out; use get_document for it.",
    input: z.object({
      clientId: id.optional(),
      projectId: id.optional(),
      type: z.enum(DOC_TYPES).optional(),
      status: z.enum(DOC_STATUSES).optional(),
    }),
    run: async (f) => (await listDocuments(f)).map(({ draft: _d, ...d }) => ({ ...d, url: docUrl(d.id) })), // eslint-disable-line @typescript-eslint/no-unused-vars
  }),
  tool({
    name: "get_document",
    title: "Get a document",
    description: "A document's draft sections (each with a key, so you can change one precisely), its frozen versions with PDF links, its payee if it is an invoice, and its history.",
    input: z.object({ documentId: id }),
    run: async ({ documentId }) => {
      const doc = await getDocument(documentId);
      if (!doc) throw new DocumentRuleError("No document with that id. Use find or list_documents.");
      return {
        ...doc,
        url: docUrl(doc.id),
        previewUrl: pdfUrl(doc.id),
        versions: doc.versions.map((v) => ({ ...v, pdfUrl: pdfUrl(doc.id, v.version) })),
        history: await getEntityActivity("document", doc.id, 20),
      };
    },
  }),
  tool({
    name: "save_draft",
    title: "Create a draft or change sections",
    description: "With documentId: replace the given sections (matched by key; new keys are added) and optionally the payee of an invoice. A finalised or sent document goes back to draft; its versions stay frozen. Without documentId: create a draft of a type, starting from the template's sections when none are given, linked to the project's client and deal. Write {{missing: what}} for any fact you do not have; it blocks finalising. Invoices are created with create_invoice_from_deal and receipts with create_receipt, not here.",
    input: z.object({
      documentId: id.optional(),
      type: z.enum(DOC_TYPES).optional(),
      title: z.string().trim().min(1).optional(),
      clientId: id.optional(),
      projectId: id.optional(),
      sections: z.array(Section).optional(),
      payee: z.enum(PAYEES).optional(),
    }),
    run: async (a, actor) => {
      if (a.documentId) {
        if (a.payee) await setDocumentPayee(a.documentId, a.payee, actor, "claude");
        if (a.sections?.length) await saveDraftSections(a.documentId, a.sections, actor, "claude");
        const doc = await getDocument(a.documentId);
        if (!doc) throw new DocumentRuleError("No document with that id");
        return { ...doc, url: docUrl(doc.id), previewUrl: pdfUrl(doc.id) };
      }
      if (!a.type || !a.title) throw new DocumentRuleError("A new draft needs a type and a title");
      if (a.type === "invoice") throw new DocumentRuleError("Invoices come from a payment line: use create_invoice_from_deal");
      if (a.type === "receipt") throw new DocumentRuleError("Receipts come from a recorded payment: use create_receipt");
      const project = a.projectId ? await getProject(a.projectId) : null;
      if (a.projectId && !project) throw new DocumentRuleError("No project with that id");
      const deal = a.projectId ? await getDealByProject(a.projectId) : null;
      const doc = await createDocument(
        {
          type: a.type,
          title: a.title,
          clientId: a.clientId ?? project?.Client?.[0] ?? null,
          projectId: a.projectId ?? null,
          dealId: deal?.id ?? null,
          invoiceId: null,
          sections: a.sections ?? DEFAULT_SECTIONS[a.type] ?? [],
        },
        actor,
        "claude",
      );
      return { ...doc, url: docUrl(doc.id), previewUrl: pdfUrl(doc.id) };
    },
  }),
  tool({
    name: "finalise_document",
    title: "Finalise a document",
    description: "Freeze the draft as the next numbered version and make its PDF. Only when a founder says to finalise. Refused while any {{missing: …}} remains. Finalising an invoice issues it: the invoice gets its INV number and counts as sent. The version can never be edited afterwards.",
    input: z.object({ documentId: id }),
    run: async ({ documentId }, actor) => {
      const v = await finaliseDocument(documentId, actor, "claude");
      try {
        await ensurePdf(documentId, v.version);
        return { version: v.version, pdfUrl: pdfUrl(documentId, v.version) };
      } catch (e) {
        console.error("[connector] PDF", e);
        return { version: v.version, pdfUrl: pdfUrl(documentId, v.version), pdfNote: "Version frozen. The PDF is made when the link is first opened." };
      }
    },
  }),
  tool({
    name: "set_status",
    title: "Mark sent, accepted, declined or void",
    description: "Record what happened to a finalised document. Signed is not set here: a founder attaches the signed copy in the dashboard. Only when a founder says it happened.",
    input: z.object({ documentId: id, status: z.enum(["sent", "accepted", "declined", "void"]) }),
    run: ({ documentId, status }, actor) => setDocumentStatus(documentId, status, actor, "claude"),
  }),
  tool({
    name: "create_invoice_from_deal",
    title: "Invoice a payment line",
    description: "Draft an invoice for one line of a project's payment schedule (line 1 is the first payment), with its invoice document. Needs the payee: always ask the founder who is being paid (Michael, Zane or the company account) first; never assume. Due 14 days after today unless dueDate is given. The invoice stays a draft until the document is finalised.",
    input: z.object({ projectId: id, line: z.number().int().min(1), payee: z.enum(PAYEES), dueDate: z.iso.date().nullable().default(null) }),
    run: async (a, actor) => {
      const r = await createInvoiceFromDeal(a, actor, "claude");
      return { invoiceId: r.invoiceId, document: { ...r.document, url: docUrl(r.document.id), previewUrl: pdfUrl(r.document.id) } };
    },
  }),
  tool({
    name: "create_receipt",
    title: "Receipt for a payment",
    description: "Draft a receipt for one recorded payment (ids are in get_client_context's payments). Payments themselves are recorded in the dashboard, never here. Finalise it to give it its RCT number and PDF.",
    input: z.object({ paymentId: id }),
    run: async ({ paymentId }, actor) => {
      const doc = await createReceiptForPayment(paymentId, actor, "claude");
      return { ...doc, url: docUrl(doc.id), previewUrl: pdfUrl(doc.id) };
    },
  }),
];
