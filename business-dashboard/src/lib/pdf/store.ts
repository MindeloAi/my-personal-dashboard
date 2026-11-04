// Gathers what a document's PDF shows, renders it, and keeps the file.
//
// A finalised version is rendered once and stored at document/<id>/v<N>.pdf, so
// it reprints identically even after the deal, client or bank details change.
// If that first render failed (e.g. Storage was down), the next request renders
// it from the frozen sections plus today's linked data, and stores that.
import { getSql } from "../db";
import { getPayeeAccount, setVersionPdf } from "../documents-db";
import type { Section } from "../documents";
import { uploadBytes } from "../storage";
import { renderDocumentPdf, type PdfData } from "./document-pdf";

// Dates on a PDF are the day in Trinidad, as in activity-list.tsx.
const trinidadDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Port_of_Spain" }).format(d);

/** `version` 0 = the current draft. Null when the document or version does not exist. */
export async function loadPdfData(documentId: string, version: number): Promise<PdfData | null> {
  const sql = getSql();
  const [doc] = await sql`
    select d.*, p.name as project_name,
           -- A lead has no client record yet, so its own name and contact stand in.
           coalesce(c.name, l.name) as client_name, coalesce(c.company, l.business_name) as company,
           coalesce(c.email, l.email) as email, coalesce(c.phone, l.phone_whatsapp) as phone,
           dl.reference, dl.price_total, dl.currency, dl.payment_schedule, dl.care_plan,
           i.invoice_number, i.issue_date, i.due_date, i.amount
      from documents d
      left join projects p on p.id = d.project_id
      left join clients c on c.id = coalesce(d.client_id, p.client_id)
      left join leads l on l.id = p.lead_id and c.id is null
      left join deals dl on dl.id = d.deal_id
      left join invoices i on i.id = d.invoice_id
     where d.id = ${documentId}`;
  if (!doc) return null;
  let title = doc.title as string;
  let sections = doc.draft as Section[];
  let date = trinidadDay(new Date());
  if (version > 0) {
    const [v] = await sql`select * from document_versions where document_id = ${documentId} and version = ${version}`;
    if (!v) return null;
    title = v.title;
    sections = v.sections;
    date = trinidadDay(new Date(v.finalised_at));
  }
  const bank = doc.type === "invoice" && doc.payee ? await getPayeeAccount(doc.payee) : null;
  const day = (x: unknown) => (x ? String(x instanceof Date ? x.toISOString() : x).slice(0, 10) : null);
  // A receipt shows its payment, and what had been paid on the invoice up to and including it.
  const [pay] = doc.type === "receipt" && doc.payment_id
    ? await sql`
        select p.amount, p.paid_at, p.method,
               (select sum(q.amount) from payments q
                 where q.invoice_id = p.invoice_id and (q.paid_at, q.created_at) <= (p.paid_at, p.created_at)) as paid_to_date
          from payments p where p.id = ${doc.payment_id}`
    : [];
  if (doc.type === "receipt" && !pay) throw new Error("The payment for this receipt was deleted");
  return {
    type: doc.type,
    title,
    reference: doc.reference ?? null,
    version,
    date,
    client: doc.client_name != null ? { name: doc.client_name, company: doc.company, email: doc.email, phone: doc.phone } : null,
    projectName: doc.project_name ?? null,
    sections,
    deal: doc.reference
      ? {
          priceTotal: doc.price_total == null ? null : Number(doc.price_total),
          currency: doc.currency,
          paymentSchedule: (doc.payment_schedule ?? []).map((l: { label: string; amount: unknown; trigger: string }) => ({ ...l, amount: Number(l.amount) })),
          carePlan: doc.care_plan,
        }
      : null,
    invoice: doc.invoice_id
      ? { number: doc.invoice_number, issueDate: day(doc.issue_date), dueDate: day(doc.due_date), amount: doc.amount == null ? null : Number(doc.amount) }
      : null,
    receipt: pay
      ? {
          number: doc.receipt_number ?? null,
          paidAt: day(pay.paid_at)!,
          method: pay.method ?? null,
          amount: Number(pay.amount),
          invoiceNumber: doc.invoice_number ?? null,
          invoiceTotal: Number(doc.amount ?? 0),
          paidToDate: Number(pay.paid_to_date),
        }
      : null,
    bank: bank && { accountName: bank.accountName, bankName: bank.bankName, branch: bank.branch, accountNumber: bank.accountNumber, accountType: bank.accountType },
  };
}

/** The Storage path of a finalised version's PDF, rendering and storing it first if needed. */
export async function ensurePdf(documentId: string, version: number): Promise<string> {
  const sql = getSql();
  const [v] = await sql`select pdf_path from document_versions where document_id = ${documentId} and version = ${version}`;
  if (!v) throw new Error(`Document ${documentId} has no version ${version}`);
  if (v.pdf_path) return v.pdf_path;
  const data = await loadPdfData(documentId, version);
  if (!data) throw new Error(`Document ${documentId} has no version ${version}`);
  const path = `document/${documentId}/v${version}.pdf`;
  // false = a previous attempt stored the file but failed before recording it. Same frozen version, so keep that file.
  await uploadBytes(path, await renderDocumentPdf(data), "application/pdf");
  await setVersionPdf(documentId, version, path);
  return path;
}
