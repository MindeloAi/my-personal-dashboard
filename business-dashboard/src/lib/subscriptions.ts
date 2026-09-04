import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Invoice, Subscription } from "@/lib/db";

// ─── Recurring revenue maths ──────────────────────────────────────────────────
//
// Pure functions over already-fetched rows. No database, no `server-only`: the
// cron route, the dashboard cards and scripts/subscriptions.test.mjs all call
// the same code, which is the point — the number the reminder email quotes is
// the number the dashboard shows.
//
// Every date here is a bare "YYYY-MM-DD" string, because that is what db.ts's
// `date` parser returns (schema.sql insists on it). ISO dates in that form sort
// and compare correctly as strings, so `a <= b` is a valid date comparison and
// no parsing is needed for the range checks below.

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 } as const;
export type Frequency = keyof typeof FREQUENCY_MONTHS;

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: "/mo",
  quarterly: "/qtr",
  yearly: "/yr",
};

/** Months between invoices. Unset frequency is treated as monthly. */
function periodMonths(sub: Subscription): number {
  return FREQUENCY_MONTHS[(sub.Frequency ?? "monthly") as Frequency] ?? 1;
}

export function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Earning money right now: Active, and not past its end date.
 *
 * Deliberately NOT "has a linked project that is In Progress". That test is what
 * made MRR read $0 — a delivered project on a maintenance retainer is Done, and
 * a standalone retainer has no project at all.
 */
export function isActive(sub: Subscription, on = today()): boolean {
  if (sub.Status !== "Active") return false;
  const end = sub["End Date"];
  return !end || end >= on;
}

/** Monthly recurring revenue: each active subscription's amount, per month. */
export function mrr(subs: Subscription[], on = today()): number {
  return subs
    .filter((s) => isActive(s, on))
    .reduce((sum, s) => sum + (s.Amount ?? 0) / periodMonths(s), 0);
}

/** Invoices raised against one subscription, oldest issue date first. */
function issuedFor(sub: Subscription, invoices: Invoice[]): string[] {
  return invoices
    .filter(
      (i) =>
        i.Subscription?.[0] === sub.id &&
        // A voided invoice was never really billed, so it must not push the
        // schedule forward and hide a period that still needs invoicing.
        i.Status !== "Void" &&
        i["Issue Date"],
    )
    .map((i) => i["Issue Date"] as string)
    .sort();
}

/**
 * When the next invoice for this subscription is due.
 *
 * Derived from the last invoice actually issued against it, plus one period —
 * never stored. Raising an invoice early or late therefore re-anchors the
 * schedule instead of leaving a stored date to drift out of sync. A
 * subscription that has never been invoiced is due on its start date.
 *
 * Returns null when there is nothing to anchor to (no invoices, no start date).
 */
export function nextInvoiceDate(sub: Subscription, invoices: Invoice[]): string | null {
  const issued = issuedFor(sub, invoices);
  const last = issued[issued.length - 1];
  if (!last) return sub["Start Date"] ?? null;
  return format(addMonths(parseISO(last), periodMonths(sub)), "yyyy-MM-dd");
}

export type DueSubscription = {
  sub: Subscription;
  /** The date the invoice should have gone out. */
  due: string;
  /** 0 on the day it falls due, growing by one each day it is not invoiced. */
  daysOverdue: number;
};

/** Active subscriptions whose next invoice date has arrived, most overdue first. */
export function dueSubscriptions(
  subs: Subscription[],
  invoices: Invoice[],
  on = today(),
): DueSubscription[] {
  const out: DueSubscription[] = [];
  for (const sub of subs) {
    if (!isActive(sub, on)) continue;
    const due = nextInvoiceDate(sub, invoices);
    if (!due || due > on) continue;
    out.push({
      sub,
      due,
      daysOverdue: differenceInCalendarDays(parseISO(on), parseISO(due)),
    });
  }
  return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
