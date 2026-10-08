import type { Invoice } from "@/lib/airtable";
import { today } from "@/lib/subscriptions";

/**
 * Single source of truth for "is this invoice overdue?"
 *
 * An invoice is overdue if either:
 *   - its stored Status is explicitly "Overdue" (manual override / future cron), or
 *   - its Status is "Sent" AND it has a Due Date in the past.
 *
 * Phase 6 cron is not implemented; deriving here means a `Sent` invoice that
 * passes its due date surfaces immediately on the dashboard without needing
 * Airtable to be re-tagged.
 */
export function isOverdue(invoice: Invoice, now: Date = new Date()): boolean {
  if (invoice.Status === "Overdue") return true;
  if (invoice.Status !== "Sent") return false;
  const dueStr = invoice["Due Date"];
  if (!dueStr) return false;
  // Overdue the day AFTER it falls due, not from midnight on the due date.
  return dueStr < today(now);
}

export type EffectiveStatus = "Paid" | "Overdue" | "Sent" | "Draft" | "Void";

export function effectiveStatus(invoice: Invoice, now?: Date): EffectiveStatus {
  if (isOverdue(invoice, now)) return "Overdue";
  return (invoice.Status ?? "Draft") as EffectiveStatus;
}
