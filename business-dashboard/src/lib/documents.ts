// Deals and documents (migration 022): the rules, with no database. Shared by
// the dashboard pages, documents-db.ts and, from Phase 2, the connector.
// Checked by scripts/documents.test.ts.

export const DOC_TYPES = ["proposal", "quote", "service_agreement", "care_plan", "change_request", "invoice", "sop", "receipt"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  proposal: "Proposal",
  quote: "Quote",
  service_agreement: "Service agreement",
  care_plan: "Care plan",
  change_request: "Change request",
  invoice: "Invoice",
  sop: "SOP",
  receipt: "Receipt",
};

export const DOC_STATUSES = ["draft", "finalised", "sent", "accepted", "signed", "declined", "void"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  finalised: "Finalised",
  sent: "Sent",
  accepted: "Accepted",
  signed: "Signed",
  declined: "Declined",
  void: "Void",
};

export const PAYEES = ["michael", "zane", "company"] as const;
export type Payee = (typeof PAYEES)[number];
export const PAYEE_LABEL: Record<Payee, string> = { michael: "Michael", zane: "Zane", company: "Company account" };

export const ATTACHABLE = ["client", "project", "invoice", "document", "expense"] as const;
export type Attachable = (typeof ATTACHABLE)[number];

export const FILE_KINDS = ["signed_copy", "proof_of_payment", "asset", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  signed_copy: "Signed copy",
  proof_of_payment: "Proof of payment",
  asset: "Asset",
  other: "Other",
};

export type Section = { key: string; heading: string; body: string };
export type ScheduleLine = { label: string; amount: number; trigger: string };
export type CarePlan = {
  monthlyAmount: number;
  minimumMonths: number;
  noticeDays: number;
  inclusions: string[];
  exclusions: string[];
};

export const REFERENCE_RE = /^[A-Z0-9]{2,8}-\d{4}-\d{2}$/;

const FILLER = new Set(["THE", "AND", "LIMITED", "LTD", "CO", "COMPANY", "INC"]);

/** A short code from a client name: "Island Bites" → "IB", "Acme" → "ACME". */
export function suggestPrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(" ").filter((w) => w && !FILLER.has(w));
  if (words.length === 0) return "CL";
  if (words.length === 1) return words[0].slice(0, 4).padEnd(2, "X");
  return words.map((w) => w[0]).join("").slice(0, 4);
}

/** The next free engagement code for a prefix in a year: IB-2026-01, IB-2026-02… */
export function nextReference(prefix: string, year: number, taken: string[]): string {
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (p.length < 2) throw new Error("A reference prefix needs at least two letters or digits");
  const stem = `${p}-${year}-`;
  const used = taken.filter((t) => t.startsWith(stem)).map((t) => Number(t.slice(stem.length))).filter(Number.isInteger);
  const n = Math.max(0, ...used) + 1;
  if (n > 99) throw new Error(`${stem}99 is the last reference for this prefix and year`);
  return `${stem}${String(n).padStart(2, "0")}`;
}

/** Why a payment schedule is wrong, or null. Compared in cents so 0.1 + 0.2 adds up. */
export function scheduleProblem(total: number | null, lines: ScheduleLine[]): string | null {
  if (lines.length === 0) return null;
  if (lines.some((l) => !l.label.trim() || !l.trigger.trim())) return "Every payment needs a label and when it falls due";
  if (lines.some((l) => !(l.amount > 0))) return "Every payment must be more than zero";
  // Invoices from deals are matched to payment lines by label (documents-db createInvoiceFromDeal).
  const labels = lines.map((l) => l.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return "Every payment needs a different label";
  if (total == null) return "Set the total price before splitting it into payments";
  const cents = (n: number) => Math.round(n * 100);
  const sum = lines.reduce((s, l) => s + cents(l.amount), 0);
  if (sum !== cents(total)) return `Payments add up to ${(sum / 100).toFixed(2)}, not the total of ${total.toFixed(2)}`;
  return null;
}

/** Where a document can go from each status. Signed and void are final. */
export const TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  draft: ["finalised", "void"],
  finalised: ["sent", "draft", "void"],
  sent: ["accepted", "declined", "signed", "draft", "void"],
  accepted: ["signed", "draft", "void"],
  declined: ["draft", "void"],
  signed: [],
  void: [],
};
export const canMove = (from: DocStatus, to: DocStatus) => TRANSITIONS[from].includes(to);

// A fact a draft still needs, written into its text as {{missing: client address}}.
const MISSING_RE = /\{\{\s*missing:\s*([^}]+?)\s*\}\}/g;

/** Every missing fact named in the sections, once each, in order. Finalising is blocked while any remain. */
export function missingFacts(sections: Section[]): string[] {
  const out = new Set<string>();
  for (const s of sections) for (const m of `${s.heading}\n${s.body}`.matchAll(MISSING_RE)) out.add(m[1]);
  return [...out];
}

/** Replace sections by key in place; keys not already there are appended. A key given twice: last wins. */
export function mergeSections(current: Section[], changes: Section[]): Section[] {
  const byKey = new Map(changes.map((c) => [c.key, c]));
  const have = new Set(current.map((s) => s.key));
  return [...current.map((s) => byKey.get(s.key) ?? s), ...[...byKey.values()].filter((c) => !have.has(c.key))];
}
