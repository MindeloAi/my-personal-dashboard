// Pure rules for document templates: the sections a new document starts with,
// item lines on quotes and invoices, money and dates. No database, no React;
// the PDF layout is lib/pdf/document-pdf.tsx.
import type { DocType, Section } from "./documents";

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
};

/** One item per line, written `description | amount`. Blank lines are skipped. */
export function parseItems(body: string): { items: Item[]; bad: string[] } {
  const items: Item[] = [];
  const bad: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf("|");
    const description = bar < 0 ? "" : line.slice(0, bar).trim();
    const amount = bar < 0 ? NaN : Number(line.slice(bar + 1).replace(/TT\$|\$|,|\s/g, ""));
    if (!description || !Number.isFinite(amount) || amount < 0) bad.push(line);
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
