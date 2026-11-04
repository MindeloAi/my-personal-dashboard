// pdf.test.tsx — renders each template from made-up data. No database.
//   bun scripts/pdf.test.tsx           (writes the PDFs to $PDF_OUT, default ./tmp-pdf, for a visual check)
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderDocumentPdf, type PdfData } from "../src/lib/pdf/document-pdf";

const out = process.env.PDF_OUT ?? "tmp-pdf";
mkdirSync(out, { recursive: true });

const base: PdfData = {
  type: "proposal",
  title: "Website for Island Bites",
  reference: "IB-2026-01",
  version: 1,
  date: "2026-11-04",
  client: { name: "Andrea Example", company: "Island Bites", email: "andrea@example.com", phone: null, address: null, signatoryName: null, signatoryTitle: null },
  projectName: "Island Bites website",
  sections: [
    { key: "summary", heading: "Summary", body: "A fast five-page site with pickup ordering.\n\nBuilt to be found on Google." },
    { key: "scope", heading: "What we will deliver", body: "- Five pages\n- Pickup ordering\n- Google Business setup" },
    { key: "empty", heading: "Skipped", body: "" },
  ],
  deal: {
    priceTotal: 6500,
    currency: "TTD",
    paymentSchedule: [
      { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
      { label: "Payment 2", amount: 3250, trigger: "On handover" },
    ],
    carePlan: { monthlyAmount: 800, minimumMonths: 3, noticeDays: 30, inclusions: ["Hosting"], exclusions: [] },
  },
  invoice: null,
  bank: null,
  receipt: null,
};

const receipt: PdfData = {
  ...base, type: "receipt", title: "Receipt: INV-0042 2026-11-04", deal: null,
  sections: [{ key: "notes", heading: "Notes", body: "Thank you for your payment." }],
  invoice: { number: "INV-0042", issueDate: "2026-11-01", dueDate: "2026-11-15", amount: 6500 },
  receipt: { number: "RCT-0001", paidAt: "2026-11-04", method: "Bank", amount: 3250, invoiceNumber: "INV-0042", invoiceTotal: 6500, paidToDate: 3250 },
};

const docs: Record<string, PdfData> = {
  proposal: base,
  quote: { ...base, type: "quote", title: "Quote", sections: [
    { key: "items", heading: "Items", body: "Website build | 5,000\nOrdering | 1,500" },
    { key: "terms", heading: "Terms", body: "Valid for 30 days." },
  ] },
  invoice: {
    ...base, type: "invoice", title: "Invoice: Payment 1", deal: null,
    sections: [
      { key: "items", heading: "Items", body: "Payment 1 (IB-2026-01) | 3250.00" },
      { key: "notes", heading: "Notes", body: "On acceptance." },
    ],
    invoice: { number: "INV-0042", issueDate: "2026-11-04", dueDate: "2026-11-18", amount: 3250 },
    bank: { accountName: "Example Name", bankName: "Example Bank", branch: "Port of Spain", accountNumber: "123456", accountType: "Chequing" },
  },
  draft: { ...base, version: 0 },
  receipt,
  // The last payment: the balance reads "Paid in full". A draft has no number yet.
  receiptFull: { ...receipt, version: 0, receipt: { ...receipt.receipt!, number: null, method: null, paidToDate: 6500 } },
  // A long unbroken URL in an item, a schedule label and prose must wrap, not run into the amounts.
  overflow: { ...base, type: "quote", title: "Quote with long links", sections: [
    { key: "items", heading: "Items", body: `Hosting at https://example.com/a/very/long/path/that/never/breaks/for/anything/at/all/and/then/keeps/going/further | 1,200\nSetup | 300` },
    { key: "notes", heading: "Notes", body: "See https://example.com/another/very/long/link/with/no/spaces/anywhere/in/it/at/all for details." },
  ], deal: { ...base.deal!, paymentSchedule: [
    { label: "Deposit per https://example.com/terms/payment/schedule/version/two/final", amount: 3250, trigger: "On acceptance" },
    { label: "Balance", amount: 3250, trigger: "On handover" },
  ] } },
  // 30 payment lines: the schedule breaks across pages with its heading kept on its rows.
  longSchedule: { ...base, title: "Retainer for Island Bites", deal: { ...base.deal!, priceTotal: 30000, paymentSchedule:
    Array.from({ length: 30 }, (_, i) => ({ label: `Month ${i + 1}`, amount: 1000, trigger: `Start of month ${i + 1}` })) } },
  // Own items and a deal with no schedule: no second money table, the care plan line stays.
  quoteNoSchedule: { ...base, type: "quote", title: "Quote without schedule", sections: [
    { key: "items", heading: "Items", body: "Website build | 5,000\nOrdering | 1,500" },
  ], deal: { ...base.deal!, paymentSchedule: [] } },
  // An invoice with no amount yet (a preview) shows the items sum.
  invoiceNoAmount: {
    ...base, type: "invoice", title: "Invoice preview", deal: null, version: 0,
    sections: [{ key: "items", heading: "Items", body: "Design | 1,000\nBuild | 2,000" }],
    invoice: { number: null, issueDate: null, dueDate: null, amount: null }, bank: null,
  },
};

// The three signed types, for a client with full legal details.
const legal: PdfData["client"] = {
  name: "Andrea Example", company: "Island Bites Limited", email: "andrea@example.com", phone: null,
  address: "12 Ariapita Avenue, Woodbrook, Port of Spain", signatoryName: "Andrea Example", signatoryTitle: "Director",
};
const clauses = (n: number) => Array.from({ length: n }, (_, i) => ({
  key: `c${i}`, heading: `${i + 1}. Clause`,
  body: "Each side keeps the other's confidential information private and uses it only for this work. This continues after the agreement ends.",
}));
Object.assign(docs, {
  "phase3-service_agreement": { ...base, type: "service_agreement", title: "Service agreement", client: legal,
    sections: [{ key: "scope", heading: "Scope", body: "- Five pages\n- Pickup ordering" }, ...clauses(12)] },
  "phase3-change_request": { ...base, type: "change_request", title: "Change request IB-2026-01-CR1", reference: "IB-2026-01-CR1", client: legal, sections: [
    { key: "added", heading: "What is being added", body: "A gift card page and a newsletter signup." },
    { key: "items", heading: "Items", body: "Gift card page | 1,200\nNewsletter signup | 450" },
    { key: "approval", heading: "Approval", body: "The total is added to the final payment." },
  ] },
  "phase3-care_plan": { ...base, type: "care_plan", title: "Care plan for Island Bites", client: legal,
    deal: { ...base.deal!, carePlan: { ...base.deal!.carePlan!, monthlyAmount: 750 } },
    sections: [{ key: "included", heading: "What is included", body: "- Hosting\n- Monthly updates" }, ...clauses(3)] },
  // A lead has no legal details: the signature lines are left blank.
  agreementLead: { ...base, type: "service_agreement", title: "Agreement for a lead", version: 0 },
} satisfies Record<string, PdfData>);

for (const [name, data] of Object.entries(docs)) {
  const pdf = await renderDocumentPdf(data);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", `${name} is a PDF`);
  assert.ok(pdf.length > 5_000, `${name} has content (${pdf.length} bytes)`);
  writeFileSync(`${out}/${name}.pdf`, pdf);
}
console.log(`All pdf checks pass. Look at ${out}/*.pdf`);
