// Pure rules for document templates: the sections a new document starts with,
// item lines on quotes and invoices, money and dates. No database, no React;
// the PDF layout is lib/pdf/document-pdf.tsx.
import type { DocType, ScheduleLine, Section } from "./documents";

export type Item = { description: string; amount: number };

/** Days from issue to due on an invoice raised from a deal. */
export const INVOICE_DUE_DAYS = 14;

/**
 * What a new document starts with. Each {{missing: …}} marker blocks
 * finalising until it is written. Types not listed start empty.
 * Proposals and quotes get their price table from the deal, so no fees section.
 */
export const DEFAULT_SECTIONS: Partial<Record<DocType, Section[]>> = {
  proposal: [
    { key: "summary", heading: "Summary", body: "{{missing: summary}}" },
    { key: "goals", heading: "Goals", body: "{{missing: goals}}" },
    { key: "scope", heading: "What we will deliver", body: "{{missing: scope}}" },
    { key: "timeline", heading: "Timeline", body: "{{missing: timeline}}" },
    { key: "next_steps", heading: "Next steps", body: "{{missing: next steps}}" },
  ],
  quote: [
    { key: "items", heading: "Items", body: "{{missing: items}}" },
    { key: "terms", heading: "Terms", body: "{{missing: terms}}" },
  ],
  invoice: [
    { key: "items", heading: "Items", body: "{{missing: items}}" },
    { key: "notes", heading: "Notes", body: "" },
  ],
  // Clause wording is Mindelo's own, from the /doc skill's house-style.md.
  service_agreement: [
    {
      key: "parties",
      heading: "Parties",
      body: "This agreement is between MINDELOAI LIMITED, trading as Mindelo, of 4 Warren Street, Port of Spain, and {{missing: client registered name and address}}.",
    },
    { key: "scope", heading: "What we will deliver", body: "{{missing: scope}}" },
    { key: "price", heading: "Price and payment", body: "{{missing: price and payment schedule}}" },
    {
      key: "timeline",
      heading: "Timeline",
      body: "{{missing: timeline in weeks from the first payment}} Where a date depends on content, images, access or approval from the Client, it moves by the length of any delay in receiving it.",
    },
    {
      key: "changes",
      heading: "Changes to scope",
      body: "Additional work requested during the build is quoted in writing before it is started. No additional work is carried out, and no additional charge arises, until the Client has approved that quote in writing. Approved additions are added to the final payment. An instruction given verbally or by message is treated as a request, not an approval.",
    },
    {
      key: "client",
      heading: "What we need from you",
      body: "Access to the domain and hosting. Content, images and logos, with the right to use them. One named person who approves work.",
    },
    {
      key: "running_costs",
      heading: "Running costs",
      body: "Third-party accounts such as the domain, hosting and assistant services are opened in the Client's name and billed to the Client directly. Mindelo adds no markup and does not resell it.",
    },
    {
      key: "ownership",
      heading: "Ownership",
      body: "On receipt of the final payment in full, the Client owns the website, its content, its design and its code outright, together with the domain, hosting and other accounts held in the Client's name. Mindelo retains no rights over it and nothing is held back. Mindelo retains ownership of its own general tools, templates and methods used to produce the work, which are not specific to the Client.",
    },
    {
      key: "publication",
      heading: "Reference and publication",
      body: "Mindelo may describe the general nature of the work and its outcomes. Public use of the Client's name, logo or a quotation needs the Client's written approval.",
    },
    {
      key: "liability",
      heading: "Liability",
      body: "Mindelo's liability is limited to the total fees paid under this agreement. Mindelo is not liable for loss of profit, loss of business or indirect loss, and is not responsible for third-party services.",
    },
    {
      key: "termination",
      heading: "Ending this agreement",
      body: "Either party may end this agreement on fourteen days written notice. The first payment is not refundable once work has started. This agreement is governed by the laws of Trinidad and Tobago.",
    },
    { key: "payment_terms", heading: "Payment terms", body: "Each invoice is payable within fourteen days of issue." },
  ],
  care_plan: [
    {
      key: "included",
      heading: "What is included",
      body: [
        "Changes and updates whenever you need them, with no ticket system and no hours to count.",
        "Hosting and technical upkeep.",
        "Monitoring, backups and security updates.",
        "Your enquiry form kept working.",
        "Direct access by phone, email or WhatsApp, with a reply within one business day, from the same two people every time.",
      ].join("\n"),
    },
    {
      key: "excluded",
      heading: "What is not included",
      body: [
        "New builds such as a booking system, online shop, payments or customer portal.",
        "A set of new sections or a major redesign.",
        "Logo redesign.",
        "Professional photography or video.",
        "Paid advertising.",
        "These are quoted before we start.",
      ].join("\n"),
    },
    { key: "price", heading: "Price", body: "{{missing: monthly amount}}" },
    {
      key: "term",
      heading: "Term",
      body: "A minimum of three months, then month to month until either side gives thirty days notice.",
    },
    {
      key: "start",
      heading: "Start and billing",
      body: "Your care plan begins on the day your final payment is received. Each month is invoiced at its end, so the first invoice is issued one month after the care plan begins. Each invoice is payable within fourteen days of issue.",
    },
    {
      key: "ending",
      heading: "If it ends",
      body: "Everything stays with you. The accounts are in your name.",
    },
  ],
  change_request: [
    { key: "summary", heading: "What is being added", body: "{{missing: what is being added}}" },
    { key: "items", heading: "Items", body: "{{missing: items}}" },
    { key: "timeline", heading: "Effect on the timeline", body: "{{missing: effect on the timeline}}" },
    { key: "payment", heading: "Payment", body: "The amount above is added to the final payment of the project." },
    {
      key: "approval",
      heading: "Approval",
      body: "No additional work is carried out, and no additional charge arises, until you approve this change in writing. Sign below or reply by email to approve it.",
    },
  ],
};

const cents = (n: number) => Math.round(n * 100);

/** A change request's total added to the deal: price and the LAST schedule line. Empty schedule: price only. */
export function applyChange(
  price: number | null,
  schedule: ScheduleLine[],
  amount: number,
): { price: number; schedule: ScheduleLine[] } {
  const add = (n: number) => (cents(n) + cents(amount)) / 100;
  const last = schedule.length - 1;
  return {
    price: add(price ?? 0),
    schedule: schedule.map((l, i) => (i === last ? { ...l, amount: add(l.amount) } : l)),
  };
}

/** First care-plan invoice: one month after the care plan begins, same day, clamped to month end. yyyy-mm-dd in and out. */
export function firstCareInvoice(startDay: string): string {
  const [y, m, d] = startDay.split("-").map(Number);
  // Day 0 of the month after next is the last day of next month.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** "<REF>-CR<n>" for the next change request, given existing refs/titles containing "<REF>-CR<k>". */
export function nextChangeRef(dealRef: string, existing: string[]): string {
  const re = new RegExp(`(?<![A-Z0-9])${dealRef.replace(/[^A-Za-z0-9]/g, "\\$&")}-CR(\\d+)`);
  const used = existing.map((e) => Number(e.match(re)?.[1] ?? 0));
  return `${dealRef}-CR${Math.max(0, ...used) + 1}`;
}

/** One item per line, written `description | amount`. Blank lines are skipped. */
export function parseItems(body: string): { items: Item[]; bad: string[] } {
  const items: Item[] = [];
  const bad: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf("|");
    const description = bar < 0 ? "" : line.slice(0, bar).trim();
    const text = bar < 0 ? "" : line.slice(bar + 1).replace(/TT\$|\$|,|\s/g, "");
    const amount = /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
    if (!description || Number.isNaN(amount)) bad.push(line);
    else items.push({ description, amount: Math.round(amount * 100) / 100 });
  }
  return { items, bad };
}

/** Why the items cannot be finalised, or null. `total` null skips the sum check. Compared in cents. */
export function itemsProblem(body: string, total: number | null): string | null {
  const { items, bad } = parseItems(body);
  if (bad.length) return `Each item line needs "description | amount": ${bad[0]}`;
  if (items.length === 0) return "Add at least one item";
  if (total == null) return null;
  const sum = items.reduce((s, i) => s + Math.round(i.amount * 100), 0);
  return sum === Math.round(total * 100)
    ? null
    : `Items add up to ${formatMoney(sum / 100)} but the total is ${formatMoney(total)}`;
}

export function formatMoney(n: number, currency = "TTD"): string {
  const prefix = currency === "TTD" ? "TT$" : `${currency} `;
  return prefix + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** invoices.invoice_type for line `index` (0-based) of a `count`-line payment schedule. */
export function invoiceTypeFor(index: number, count: number): "one_off" | "deposit" | "milestone" | "final" {
  if (count <= 1) return "one_off";
  if (index === 0) return "deposit";
  return index === count - 1 ? "final" : "milestone";
}

/** yyyy-mm-dd plus whole days, in UTC so the date never shifts. */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
