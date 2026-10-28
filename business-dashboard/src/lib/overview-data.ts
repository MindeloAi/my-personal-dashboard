// Pure calculations behind the Overview charts. No React, so scripts can check
// them. Revenue follows the rule every other dashboard chart uses: a Paid
// invoice's full amount, counted in the month of its Paid Date.
import type { Client, Project, Invoice, Expense, Lead, Ledger } from "@/lib/db";
import { isOverdue } from "@/lib/invoices";

export type Slice = { name: string; value: number };
export type MonthRow = { month: string; revenue: number; expenses: number; profit: number; revenueToDate: number };

const monthKey = (iso: string) => iso.slice(0, 7);
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Last `count` calendar months ending with the one holding `todayIso` (YYYY-MM-DD). */
export function monthlyMoney(invoices: Invoice[], expenses: Expense[], todayIso: string, count = 12): MonthRow[] {
  const [y, m] = todayIso.split("-").map(Number);
  const keys = Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const rows = new Map(keys.map((k) => [k, { revenue: 0, expenses: 0 }]));
  let before = 0;
  for (const inv of invoices) {
    if (inv.Status !== "Paid" || !inv["Paid Date"]) continue;
    const k = monthKey(inv["Paid Date"]);
    const row = rows.get(k);
    if (row) row.revenue += inv.Amount ?? 0;
    else if (k < keys[0]) before += inv.Amount ?? 0;
  }
  for (const exp of expenses) {
    if (!exp.Date) continue;
    const row = rows.get(monthKey(exp.Date));
    if (row) row.expenses += exp.Amount ?? 0;
  }
  let toDate = before;
  return keys.map((k) => {
    const r = rows.get(k)!;
    toDate += r.revenue;
    const [ky, km] = k.split("-").map(Number);
    return {
      month: MONTH_LABEL.format(new Date(Date.UTC(ky, km - 1, 1))),
      revenue: r.revenue,
      expenses: r.expenses,
      profit: r.revenue - r.expenses,
      revenueToDate: toDate,
    };
  });
}

function clientOf(inv: Invoice, projectClient: Map<string, string | undefined>) {
  return inv.Client?.[0] ?? (inv.Project?.[0] ? projectClient.get(inv.Project[0]) : undefined);
}

function names(clients: Client[], projects: Project[]) {
  const projectClient = new Map(projects.map((p) => [p.id, p.Client?.[0]]));
  const clientName = new Map(clients.map((c) => [c.id, c.Company || c.Name || "Unnamed client"]));
  return (inv: Invoice) => {
    const id = clientOf(inv, projectClient);
    return (id && clientName.get(id)) || "No client";
  };
}

const sortDesc = (m: Map<string, number>): Slice[] =>
  [...m].map(([name, value]) => ({ name, value })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value);

/** Keep the top `keep`, fold the rest into "Other" so a chart never needs a ninth colour. */
export function topWithOther(slices: Slice[], keep: number): Slice[] {
  if (slices.length <= keep + 1) return slices;
  const other = slices.slice(keep).reduce((s, x) => s + x.value, 0);
  return [...slices.slice(0, keep), { name: "Other", value: other }];
}

/** Unpaid balance on every Sent or Overdue invoice, by client. Sums to ledger.owedToUs.total. */
export function owedByClient(invoices: Invoice[], projects: Project[], clients: Client[]): Slice[] {
  const nameOf = names(clients, projects);
  const m = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.Status !== "Sent" && inv.Status !== "Overdue") continue;
    const left = (inv.Amount ?? 0) - (inv["Paid So Far"] ?? 0);
    m.set(nameOf(inv), (m.get(nameOf(inv)) ?? 0) + left);
  }
  return sortDesc(m);
}

/** Paid revenue by client, all time. */
export function revenueByClient(invoices: Invoice[], projects: Project[], clients: Client[]): Slice[] {
  const nameOf = names(clients, projects);
  const m = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.Status !== "Paid") continue;
    m.set(nameOf(inv), (m.get(nameOf(inv)) ?? 0) + (inv.Amount ?? 0));
  }
  return sortDesc(m);
}

/** Paid revenue by the linked project's service type, all time. */
export function revenueByService(invoices: Invoice[], projects: Project[]): Slice[] {
  const type = new Map(projects.map((p) => [p.id, p["Service Type"] ?? "Unspecified"]));
  const m = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.Status !== "Paid") continue;
    const t = (inv.Project?.[0] && type.get(inv.Project[0])) || "Unspecified";
    m.set(t, (m.get(t) ?? 0) + (inv.Amount ?? 0));
  }
  return sortDesc(m);
}

export const LEAD_STAGES = ["New", "Contacted", "Proposal Sent", "Won", "Lost"] as const;

/** Number of leads at each stage, in pipeline order (empty stages kept, so the funnel reads left to right). */
export function leadsByStage(leads: Lead[]): Slice[] {
  return LEAD_STAGES.map((stage) => ({ name: stage, value: leads.filter((l) => l.Status === stage).length }));
}

/** Where the money physically is right now. Sums to ledger.cash.total. */
export function moneyHeld(cash: Ledger["cash"]): Slice[] {
  return [
    { name: "Business cash (safe)", value: cash.business },
    { name: "Zane", value: cash.zane },
    { name: "Mikey", value: cash.mikey },
  ];
}

/** Outstanding invoices split into overdue and not yet due. */
export function owedSplit(invoices: Invoice[], now = new Date()) {
  let overdue = 0, overdueCount = 0, notDue = 0, notDueCount = 0;
  for (const inv of invoices) {
    if (inv.Status !== "Sent" && inv.Status !== "Overdue") continue;
    const left = (inv.Amount ?? 0) - (inv["Paid So Far"] ?? 0);
    if (isOverdue(inv, now)) { overdue += left; overdueCount++; } else { notDue += left; notDueCount++; }
  }
  return { overdue, overdueCount, notDue, notDueCount };
}
