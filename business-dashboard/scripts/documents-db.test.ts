// documents-db.test.ts — acceptance checks for migration 022 and documents-db.ts.
//
// Runs against the THROWAWAY database from plan Task 1 (container docs-pg,
// port 55433). It deletes rows, so it refuses anything that is not localhost.
//
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts

import postgres from "postgres";
import {
  addAttachment,
  createInvoiceFromDeal,
  createDocument,
  createReceiptForPayment,
  deleteAttachment,
  finaliseDocument,
  getClientActivity,
  getDealByProject,
  getDocument,
  getEntityActivity,
  getPayeeAccounts,
  listAttachments,
  listDocuments,
  saveDeal,
  saveDraftSections,
  savePayeeAccount,
  setDocumentPayee,
  setDocumentStatus,
  setVersionPdf,
  DocumentRuleError,
} from "../src/lib/documents-db";
import { closeDb } from "../src/lib/db";
import { loadPdfData } from "../src/lib/pdf/store";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const ME = "founder@example.com";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
async function rejects(name: string, fn: () => Promise<unknown>, re: RegExp) {
  try {
    await fn();
    check(name, false, "did not throw");
  } catch (e) {
    check(name, re.test(String((e as Error).message)), String((e as Error).message));
  }
}

async function reset() {
  // activity and document_versions are protected by triggers; disable them for the wipe only.
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`alter table document_versions disable trigger document_versions_frozen`;
    await tx`delete from activity`;
    await tx`delete from attachments`;
    await tx`delete from document_versions`;
    await tx`delete from documents`;
    await tx`delete from deals`;
    await tx`delete from payments where invoice_id in (select i.id from invoices i join projects p on p.id = i.project_id where p.name like 'TEST %')`;
    await tx`delete from invoices where project_id in (select id from projects where name like 'TEST %')`;
    await tx`delete from payee_accounts`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`delete from expenses where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
    await tx`alter table document_versions enable trigger document_versions_frozen`;
  });
}

try {
  await reset();
  const [client] = await sql`insert into clients (name, company) values ('TEST Andrea', 'TEST Island Bites') returning id`;
  const [project] = await sql`insert into projects (name, client_id) values ('TEST Site', ${client.id}) returning id`;
  const clientId = String(client.id);
  const projectId = String(project.id);

  // Deals
  const deal = await saveDeal({
    projectId,
    reference: "IB-2026-01",
    scope: ["Five pages", "Pickup ordering"],
    priceTotal: 6500,
    paymentSchedule: [
      { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
      { label: "Payment 2", amount: 3250, trigger: "On handover" },
    ],
    carePlan: { monthlyAmount: 800, minimumMonths: 3, noticeDays: 30, inclusions: ["Hosting"], exclusions: ["New features"] },
    deadline: "2026-12-19",
    goals: null,
    notes: null,
    payeeDefault: null,
  }, ME);
  check("deal saved", deal.reference === "IB-2026-01" && deal.priceTotal === 6500);
  const again = await saveDeal({ ...deal, projectId, notes: "She asked about a gallery" }, ME);
  check("saving the same project updates, not duplicates", again.id === deal.id && again.notes === "She asked about a gallery");
  check("getDealByProject", (await getDealByProject(projectId))?.id === deal.id);
  await rejects("schedule that does not add up is refused", () =>
    saveDeal({ ...deal, projectId, paymentSchedule: [{ label: "P1", amount: 100, trigger: "x" }] }, ME), /add up/);
  await rejects("bad reference is refused", () => saveDeal({ ...deal, projectId, reference: "nope" }, ME), /reference/i);
  const [second] = await sql`insert into projects (name, client_id) values ('TEST Second', ${client.id}) returning id`;
  await rejects("a reference used by another deal is refused", () =>
    saveDeal({ ...deal, projectId: String(second.id) }, ME), /already used/);

  // Documents
  const doc = await createDocument({
    type: "proposal",
    title: "Proposal IB-2026-01",
    clientId,
    projectId,
    dealId: deal.id,
    invoiceId: null,
    sections: [
      { key: "intro", heading: "Introduction", body: "For {{missing: client address}}" },
      { key: "fees", heading: "Fees", body: "TT$6,500" },
    ],
  }, ME);
  check("document created as draft v0", doc.status === "draft" && doc.currentVersion === 0);
  await rejects("finalising with a missing fact is refused", () => finaliseDocument(doc.id, ME), /client address/);

  await saveDraftSections(doc.id, [{ key: "intro", heading: "Introduction", body: "For 1 Main Street" }], ME);
  const v1 = await finaliseDocument(doc.id, ME);
  check("finalise makes v1", v1.version === 1);
  let full = await getDocument(doc.id);
  check("document is finalised at v1", full?.status === "finalised" && full.currentVersion === 1 && full.versions.length === 1);

  await setDocumentStatus(doc.id, "sent", ME);
  await saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "TT$6,000" }], ME);
  full = await getDocument(doc.id);
  check("editing a sent document returns it to draft and keeps v1", full?.status === "draft" && full.versions[0].sections[1].body === "TT$6,500");
  await finaliseDocument(doc.id, ME);
  full = await getDocument(doc.id);
  check("second finalise makes v2", full?.currentVersion === 2 && full.versions.length === 2);

  await rejects("versions cannot be edited in the database", () =>
    sql`update document_versions set title = 'x' where document_id = ${doc.id}`, /cannot be changed/);
  await rejects("versions cannot be deleted", () =>
    sql`delete from document_versions where document_id = ${doc.id}`, /cannot be deleted/);
  await rejects("draft to sent is refused (must finalise)", async () => {
    const d2 = await createDocument({ type: "quote", title: "Q", clientId, projectId, dealId: null, invoiceId: null, sections: [] }, ME);
    await setDocumentStatus(d2.id, "sent", ME);
  }, /cannot go from draft to sent/);

  // Attachments: a signed copy on a sent document marks it signed
  await setDocumentStatus(doc.id, "sent", ME);
  await rejects("signed cannot be set directly", () => setDocumentStatus(doc.id, "signed", ME), /signed copy/);
  const att = await addAttachment({
    entityType: "document", entityId: doc.id, storagePath: `document/${doc.id}/a1`,
    filename: "signed.pdf", contentType: "application/pdf", size: 1234, kind: "signed_copy",
  }, ME);
  full = await getDocument(doc.id);
  check("signed copy marks the document signed", full?.status === "signed");
  await rejects("signed document cannot be edited", () =>
    saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "x" }], ME), /signed/);
  await rejects("a signed document cannot be changed in the database", () =>
    sql`update documents set title = 'x' where id = ${doc.id}`, /cannot be changed/);
  await rejects("a signed document cannot be moved to another project", () =>
    sql`update documents set project_id = ${second.id} where id = ${doc.id}`, /cannot be changed/);
  await rejects("a signed document's payee cannot change", () =>
    sql`update documents set payee = 'zane' where id = ${doc.id}`, /cannot be changed/);
  {
    // Deleting a linked record still works: ON DELETE SET NULL may clear the link.
    const [p] = await sql`insert into projects (name, client_id) values ('TEST Gone', ${clientId}) returning id`;
    const [d] = await sql`insert into documents (type, title, project_id, status, created_by, updated_by)
                          values ('sop', 'TEST signed', ${p.id}, 'signed', ${ME}, ${ME}) returning id`;
    await sql`delete from projects where id = ${p.id}`;
    const [after] = await sql`select project_id from documents where id = ${d.id}`;
    check("deleting a project clears a signed document's link instead of failing", after.project_id === null);
  }
  check("listAttachments finds it", (await listAttachments("document", [doc.id])).length === 1);
  const removedPath = await deleteAttachment(att.id, ME);
  check("deleteAttachment returns the storage path", removedPath === `document/${doc.id}/a1`);
  await addAttachment({
    entityType: "project", entityId: projectId, storagePath: `project/${projectId}/a2`,
    filename: "brief.pdf", contentType: "application/pdf", size: 10, kind: "other",
  }, ME);
  check("attaching a file logs against the owning record", (await getEntityActivity("project", projectId)).length >= 1);

  // Invoices from the deal (Task 3, phase 2)
  const inv = await createInvoiceFromDeal({ projectId, line: 1, payee: "michael", dueDate: null }, ME);
  const [invRow] = await sql`select amount, status, invoice_type, issue_date, due_date, invoice_number from invoices where id = ${inv.invoiceId}`;
  check("invoice drafted from schedule line 1", Number(invRow.amount) === 3250 && invRow.status === "Draft" && invRow.invoice_type === "deposit" && invRow.invoice_number === null);
  const daysToDue = (new Date(invRow.due_date).getTime() - new Date(invRow.issue_date).getTime()) / 86_400_000;
  check("due 14 days after issue", daysToDue === 14, String(daysToDue));
  check("invoice document carries the payee and the link", inv.document.type === "invoice" && inv.document.payee === "michael" && inv.document.invoiceId === inv.invoiceId && inv.document.title === "Invoice: Payment 1");
  await rejects("the same schedule line cannot be invoiced twice", () =>
    createInvoiceFromDeal({ projectId, line: 1, payee: "michael", dueDate: null }, ME), /already/);
  await rejects("a line that does not exist is refused", () =>
    createInvoiceFromDeal({ projectId, line: 9, payee: "zane", dueDate: null }, ME), /line 9/);
  await rejects("finalising without bank details is refused", () => finaliseDocument(inv.document.id, ME), /Bank details/);
  await savePayeeAccount({ payee: "michael", accountName: "TEST Account", bankName: "TEST Bank", branch: null, accountNumber: "000", accountType: null }, ME);
  check("bank details saved", (await getPayeeAccounts()).length === 1);
  const invV1 = await finaliseDocument(inv.document.id, ME);
  const [sentRow] = await sql`select status, invoice_number from invoices where id = ${inv.invoiceId}`;
  check("finalising the invoice document issues the invoice", invV1.version === 1 && sentRow.status === "Sent" && /^INV-\d{4,}$/.test(sentRow.invoice_number), JSON.stringify(sentRow));
  check("issuing is logged on the invoice", (await getEntityActivity("invoice", inv.invoiceId)).some((a) => a.action === "sent"));
  await rejects("payee cannot change once finalised", () => setDocumentPayee(inv.document.id, "zane", ME), /draft/);

  const inv2 = await createInvoiceFromDeal({ projectId, line: 2, payee: "zane", dueDate: "2027-01-31" }, ME);
  await setDocumentPayee(inv2.document.id, "michael", ME);
  check("payee can change on a draft", (await getDocument(inv2.document.id))?.payee === "michael");
  await saveDraftSections(inv2.document.id, [{ key: "items", heading: "Items", body: "Handover | 1" }], ME);
  await rejects("items that do not add up to the invoice are refused", () => finaliseDocument(inv2.document.id, ME), /add up/);

  check("setVersionPdf records the path once", (await setVersionPdf(inv.document.id, 1, "document/x/v1.pdf")) === true);
  check("a second setVersionPdf is a no-op", (await setVersionPdf(inv.document.id, 1, "document/x/other.pdf")) === false);

  // Review fixes (Task 3b)
  await saveDraftSections(inv.document.id, [{ key: "notes", heading: "Notes", body: "Thank you." }], ME);
  await finaliseDocument(inv.document.id, ME);
  const sentLogs = (await getEntityActivity("invoice", inv.invoiceId)).filter((a) => a.action === "sent").length;
  check("re-finalising v2 of a Sent invoice does not log a second sent", sentLogs === 1, String(sentLogs));
  await setDocumentStatus(inv.document.id, "void", ME);
  await rejects("voiding the document does not free its line while the invoice is live", () =>
    createInvoiceFromDeal({ projectId, line: 1, payee: "michael", dueDate: null }, ME), /already/);
  {
    const loose = async (status: string | null, sections: { key: string; heading: string; body: string }[]) => {
      const [i] = await sql`insert into invoices (project_id, amount, status) values (${projectId}, 100, ${status}) returning id`;
      const d = await createDocument({ type: "invoice", title: "TEST loose", clientId: null, projectId: null, dealId: null, invoiceId: String(i.id), payee: "michael", sections }, ME);
      return d.id;
    };
    const items = [{ key: "items", heading: "Items", body: "Thing | 100" }];
    await rejects("an invoice that is Void is refused", async () => finaliseDocument(await loose("Void", items), ME), /void/);
    await rejects("an invoice with no status is refused", async () => finaliseDocument(await loose(null, items), ME), /Set the invoice's status in Finance first/);
    await rejects("an invoice document needs an Items section", async () =>
      finaliseDocument(await loose("Draft", [{ key: "notes", heading: "Notes", body: "Hi" }]), ME), /needs an Items section/);
    const q = await createDocument({ type: "quote", title: "TEST quote", clientId: null, projectId: null, dealId: null, invoiceId: null,
      sections: [{ key: "items", heading: "Items", body: "Hosting |" }] }, ME);
    await rejects("a quote with a bad item line is refused", () => finaliseDocument(q.id, ME), /description \| amount/);
  }

  // Lists and activity
  check("listDocuments by client", (await listDocuments({ clientId })).length === 4);
  const feed = await getClientActivity(clientId);
  check("activity recorded against the client", feed.length >= 6 && feed.every((a) => a.actor === ME));
  await rejects("activity is append-only", () => sql`delete from activity`, /append-only/);

  // Receipts (Task 14). Payments are test setup only: the app never writes them.
  {
    const [ri] = await sql`
      insert into invoices (project_id, amount, status, invoice_number, michael_bonus_share, zane_bonus_share)
      values (${projectId}, 1000, 'Sent', 'INV-9001', 0.5, 0.5) returning id`;
    const [p1] = await sql`insert into payments (invoice_id, amount, paid_at, received_by, method) values (${ri.id}, 400, '2026-11-01', 'business', 'Bank') returning id`;
    const [p2] = await sql`insert into payments (invoice_id, amount, paid_at, received_by) values (${ri.id}, 600, '2026-11-02', 'business') returning id`;
    const paymentsBefore = await sql`select id, invoice_id, amount, paid_at, received_by, method, note from payments order by id`;
    const r1 = await createReceiptForPayment(String(p1.id), ME);
    check("receipt drafted for a payment", r1.type === "receipt" && r1.paymentId === String(p1.id) && r1.invoiceId === String(ri.id)
      && r1.clientId === clientId && r1.title === "Receipt: INV-9001 2026-11-01" && r1.receiptNumber === null, JSON.stringify(r1));
    await rejects("a second live receipt for the same payment is refused", () => createReceiptForPayment(String(p1.id), ME), /already exists/);
    await rejects("a receipt cannot be made through createDocument", () =>
      createDocument({ type: "receipt", title: "TEST r", clientId, projectId: null, dealId: null, invoiceId: null, sections: [] }, ME), /recorded payment/);
    await finaliseDocument(r1.id, ME);
    check("finalising gives RCT-0001", (await getDocument(r1.id))?.receiptNumber === "RCT-0001");
    const r2 = await createReceiptForPayment(String(p2.id), ME);
    await finaliseDocument(r2.id, ME);
    check("the next payment's receipt is RCT-0002", (await getDocument(r2.id))?.receiptNumber === "RCT-0002");
    await saveDraftSections(r1.id, [{ key: "notes", heading: "Notes", body: "Thanks again." }], ME);
    await finaliseDocument(r1.id, ME);
    const again = await getDocument(r1.id);
    check("re-finalising keeps the number", again?.receiptNumber === "RCT-0001" && again.currentVersion === 2);
    await rejects("the receipt number cannot be changed by SQL", () => sql`update documents set receipt_number = 'RCT-0999' where id = ${r1.id}`, /already has its number/);
    await rejects("the payment link cannot be repointed once void", async () => {
      await setDocumentStatus(r2.id, "void", ME);
      await sql`update documents set payment_id = ${p1.id} where id = ${r2.id}`;
    }, /cannot be changed/);
    const r3 = await createReceiptForPayment(String(p2.id), ME);
    check("after voiding, a new receipt for the payment is allowed", r3.paymentId === String(p2.id) && r3.id !== r2.id);
    const pdf1 = (await loadPdfData(r1.id, 1))?.receipt;
    check("receipt PDF data: first payment, paid to date counts only up to it", pdf1?.number === "RCT-0001" && pdf1.amount === 400
      && pdf1.paidToDate === 400 && pdf1.invoiceTotal === 1000 && pdf1.method === "Bank" && pdf1.paidAt === "2026-11-01", JSON.stringify(pdf1));
    const pdf3 = (await loadPdfData(r3.id, 0))?.receipt;
    check("receipt PDF data: last payment reaches the invoice total", pdf3?.paidToDate === 1000 && pdf3.number === null && pdf3.invoiceNumber === "INV-9001", JSON.stringify(pdf3));
    const paymentsAfter = await sql`select id, invoice_id, amount, paid_at, received_by, method, note from payments order by id`;
    check("no documents-db function wrote a payment", JSON.stringify(paymentsAfter) === JSON.stringify(paymentsBefore));
    await rejects("no receipt for a payment that does not exist", () => createReceiptForPayment("00000000-0000-4000-8000-000000000000", ME), /No recorded payment/);
    // A receipt whose invoice has no amount cannot be finalised (set up by blanking the amount after the payment).
    const [ni] = await sql`
      insert into invoices (project_id, amount, status, invoice_number, michael_bonus_share, zane_bonus_share)
      values (${projectId}, 500, 'Sent', 'INV-9002', 0.5, 0.5) returning id`;
    const [pn] = await sql`insert into payments (invoice_id, amount, paid_at, received_by) values (${ni.id}, 100, '2026-11-03', 'business') returning id`;
    const rn = await createReceiptForPayment(String(pn.id), ME);
    // Test setup only: the lock trigger stops the app blanking an invoice's amount once it has payments.
    await sql.begin(async (tx) => {
      await tx`alter table invoices disable trigger invoices_lock_after_payment`;
      await tx`update invoices set amount = null where id = ${ni.id}`;
      await tx`alter table invoices enable trigger invoices_lock_after_payment`;
    });
    await rejects("a receipt for an invoice with no amount is refused", () => finaliseDocument(rn.id, ME), /The invoice has no amount/);
    // A receipt whose payment was deleted cannot produce PDF figures.
    await sql`delete from payments where id = ${pn.id}`;
    await rejects("PDF data for a receipt whose payment was deleted throws", () => loadPdfData(rn.id, 0), /deleted/);
  }

  // Receipts on expenses (Task 15)
  {
    const [e] = await sql`insert into expenses (name, amount) values ('TEST Hosting', 120) returning id`;
    const file = (entityId: string) => ({ entityType: "expense" as const, entityId, storagePath: `expense/${entityId}/x`, filename: "slip.jpg", contentType: "image/jpeg", size: 10, kind: "proof_of_payment" as const });
    await addAttachment(file(String(e.id)), ME);
    check("a file attaches to an expense", (await listAttachments("expense", [String(e.id)])).length === 1);
    check("attaching is logged on the expense", (await getEntityActivity("expense", String(e.id))).some((a) => a.action === "attached"));
    await rejects("a file cannot attach to a made-up expense", () => addAttachment(file("00000000-0000-4000-8000-000000000000"), ME), /no longer exists/);
  }

  check("DocumentRuleError is exported", typeof DocumentRuleError === "function");
} finally {
  await reset();
  await sql.end();
  await closeDb();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll documents-db checks pass");
process.exit(failures ? 1 : 0);
