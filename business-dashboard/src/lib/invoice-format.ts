// Pure, framework-agnostic invoice formatting helpers.
//
// Ported from the Vantage Node automation (`automations/invoiceGenerator.js`):
//   - generateInvoiceNumber() → INV-YYYYMMDD-XXXX
//   - en-TT currency / date formatting
//   - a plain-text invoice body
//
// The one deliberate change from the original: NOTHING about the agency is
// hard-coded here. The Vantage script baked in "Vantage Media Marketing", its
// business IDs, phone numbers and Diego Martin address. This module reads all
// of that from `AgencyConfig` (env-backed by default) so the same code mints
// invoices for whichever agency is running the dashboard.

const TT_LOCALE = "en-TT";

export type AgencyConfig = {
  name: string;
  businessId?: string;
  businessNumber?: string;
  phone?: string;
  address?: string;
  /** Human-readable payment terms, e.g. "Net 14". */
  paymentTerms: string;
  /** Days until payment is due, used for the footer line + due-date math. */
  paymentDueDays: number;
};

/**
 * Default agency config, sourced from environment variables so the agency
 * identity is configuration, not source. All have safe fallbacks so the build
 * never depends on env being present.
 */
export function getAgencyConfig(): AgencyConfig {
  const dueDaysRaw = process.env.AGENCY_PAYMENT_DUE_DAYS;
  const dueDays = dueDaysRaw && Number.isFinite(Number(dueDaysRaw))
    ? Number(dueDaysRaw)
    : 14;
  return {
    name: process.env.AGENCY_NAME ?? "Your Agency",
    businessId: process.env.AGENCY_BUSINESS_ID,
    businessNumber: process.env.AGENCY_BUSINESS_NUMBER,
    phone: process.env.AGENCY_PHONE,
    address: process.env.AGENCY_ADDRESS,
    paymentTerms: process.env.AGENCY_PAYMENT_TERMS ?? `Net ${dueDays}`,
    paymentDueDays: dueDays,
  };
}

/**
 * Sequential-style invoice number: `INV-YYYYMMDD-XXXX`.
 * The dashboard's `createInvoice` does NOT mint these — `Invoice Number` is a
 * manual field on `InvoiceWriteSchema` — so callers must generate it here.
 */
export function generateInvoiceNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${date}-${suffix}`;
}

/** TT-dollar amount with thousands separators and 2 decimals, e.g. `TT$ 1,500.00`. */
export function formatTTCurrency(amount: number | null | undefined): string {
  const value =
    typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return `TT$ ${value.toLocaleString(TT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Long-form en-TT date, e.g. `05 March 2026`. Returns "N/A" for empty/invalid. */
export function formatTTDate(value?: string | Date | null): string {
  if (!value) return "N/A";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(TT_LOCALE, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Add `days` to a date and return an ISO `YYYY-MM-DD` string. */
export function addDaysISO(value: string | Date, days: number): string {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type InvoiceDetails = {
  invoiceNumber: string;
  client: string;
  amount: number;
  projectName?: string;
  projectId?: string;
  invoiceType?: string;
  issueDate?: string | Date;
  dueDate?: string | Date;
  notes?: string;
};

/**
 * Render a plain-text invoice body suitable for Telegram review or a PDF/email
 * step. Mirrors the layout of the Vantage script but with the agency block
 * driven by `AgencyConfig`.
 */
export function buildInvoiceBody(
  details: InvoiceDetails,
  agency: AgencyConfig = getAgencyConfig(),
): string {
  const issue = details.issueDate ?? new Date();
  const due =
    details.dueDate ?? addDaysISO(issue, agency.paymentDueDays);

  const lines: string[] = [];
  const rule = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

  lines.push(rule);
  lines.push(`     ${agency.name.toUpperCase()}`);
  lines.push("        Invoice");
  lines.push(rule);
  if (agency.businessId) lines.push(`Business ID:   ${agency.businessId}`);
  if (agency.businessNumber) lines.push(`Business #:    ${agency.businessNumber}`);
  if (agency.businessId || agency.businessNumber) lines.push(rule);
  lines.push(`Invoice No:    ${details.invoiceNumber}`);
  lines.push(`Invoice Date:  ${formatTTDate(issue)}`);
  if (details.projectId) lines.push(`Project ID:    ${details.projectId}`);
  lines.push("");
  lines.push("BILL TO");
  lines.push(rule);
  lines.push(`Client:        ${details.client}`);
  lines.push("");
  lines.push("PROJECT DETAILS");
  lines.push(rule);
  if (details.projectName) lines.push(`Project:       ${details.projectName}`);
  if (details.invoiceType) lines.push(`Type:          ${details.invoiceType}`);
  lines.push(`Due Date:      ${formatTTDate(due)}`);
  lines.push("");
  lines.push("AMOUNT DUE");
  lines.push(rule);
  lines.push(`Total:         ${formatTTCurrency(details.amount)}`);
  if (details.notes) {
    lines.push("");
    lines.push("NOTES");
    lines.push(rule);
    lines.push(details.notes);
  }
  lines.push("");
  lines.push(
    `Payment due within ${agency.paymentDueDays} days of invoice date (${agency.paymentTerms}).`,
  );
  lines.push(`Thank you for choosing ${agency.name}.`);
  lines.push(rule);
  const contact = [agency.address, agency.phone ? `📞 ${agency.phone}` : null]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);

  return lines.join("\n").trim();
}
