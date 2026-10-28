// The Analytics gallery: chart forms beyond bars and lines. Pure, so
// scripts/gallery-data.test.ts can check it. Revenue here means Paid invoices
// by paid date, the rule the Overview charts use; the waterfall uses the
// ledger's collected figure and founder pay, summed by SQL.
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Client, Project, Invoice, Expense, Lead, FinanceHistory } from "@/lib/db";
import { names } from "@/lib/overview-data";

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const paidOf = (invoices: Invoice[]) => invoices.filter((i) => i.Status === "Paid" && i["Paid Date"]);

export type WaterfallStep = { label: string; base: number; value: number; kind: "total" | "down" };

/** One month: invoiced, collected, minus expenses, minus founder pay, left with the business. */
export function waterfall(month: string, invoices: Invoice[], expenses: Expense[], history: FinanceHistory): WaterfallStep[] {
  const invoiced = sum(invoices.filter((i) => ["Sent", "Overdue", "Paid"].includes(i.Status ?? "") && i["Issue Date"]?.startsWith(month)), (i) => i.Amount ?? 0);
  const collected = sum(history.collected.filter((c) => c.month === month), (c) => c.amount);
  const spent = sum(expenses.filter((e) => e.Date?.startsWith(month)), (e) => e.Amount ?? 0);
  const pay = sum(history.payouts.filter((p) => p.month === month), (p) => p.base + p.bonus);
  const kept = collected - spent - pay;
  // A falling step floats from what is left after it; never below zero on screen.
  return [
    { label: "Invoiced", base: 0, value: invoiced, kind: "total" },
    { label: "Collected", base: 0, value: collected, kind: "total" },
    { label: "Expenses", base: Math.max(collected - spent, 0), value: spent, kind: "down" },
    { label: "Founder pay", base: Math.max(kept, 0), value: pay, kind: "down" },
    { label: "Kept by the business", base: 0, value: kept, kind: "total" },
  ];
}

/** Leads, then the ones won, then those whose client was invoiced, then those whose client has paid. */
export function leadFunnel(leads: Lead[], invoices: Invoice[], projects: Project[]) {
  const projectClient = new Map(projects.map((p) => [p.id, p.Client?.[0]]));
  const clientOf = (i: Invoice) => i.Client?.[0] ?? (i.Project?.[0] ? projectClient.get(i.Project[0]) : undefined);
  const invoiced = new Set(invoices.filter((i) => ["Sent", "Overdue", "Paid"].includes(i.Status ?? "")).map(clientOf));
  const paid = new Set(invoices.filter((i) => i.Status === "Paid").map(clientOf));
  const won = leads.filter((l) => l.Status === "Won");
  const stage = (name: string, list: Lead[]) => ({ name, value: list.length, leads: list });
  return [
    stage("All leads", leads),
    stage("Won", won),
    stage("Invoiced", won.filter((l) => invoiced.has(l.Client?.[0]))),
    stage("Paid", won.filter((l) => paid.has(l.Client?.[0]))),
  ];
}

export type TreeNode = { name: string; value: number; children?: TreeNode[] };

/** Paid revenue as client boxes holding project boxes. */
export function revenueTree(invoices: Invoice[], projects: Project[], clients: Client[]): TreeNode[] {
  const nameOf = names(clients, projects);
  const projectName = new Map(projects.map((p) => [p.id, p.Name]));
  const byClient = new Map<string, Map<string, number>>();
  for (const i of invoices.filter((x) => x.Status === "Paid")) {
    const c = nameOf(i);
    const p = (i.Project?.[0] && projectName.get(i.Project[0])) || "No project";
    const m = byClient.get(c) ?? new Map<string, number>();
    m.set(p, (m.get(p) ?? 0) + (i.Amount ?? 0));
    byClient.set(c, m);
  }
  return [...byClient]
    .map(([name, m]) => ({ name, value: sum([...m.values()], (v) => v), children: [...m].map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Paid revenue by weekday (rows) and month (columns) of the paid date. */
export function paymentCalendar(invoices: Invoice[], months: string[]) {
  const cells = WEEKDAYS.map(() => months.map(() => ({ amount: 0, count: 0 })));
  for (const i of paidOf(invoices)) {
    const col = months.indexOf(i["Paid Date"]!.slice(0, 7));
    if (col < 0) continue;
    const row = (new Date(`${i["Paid Date"]}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first
    cells[row][col].amount += i.Amount ?? 0;
    cells[row][col].count += 1;
  }
  return cells;
}

/** Every paid invoice as (amount, days from issue to paid). */
export function sizeVsDays(invoices: Invoice[], clients: Client[], projects: Project[]) {
  const nameOf = names(clients, projects);
  return paidOf(invoices)
    .filter((i) => i["Issue Date"] && (i.Amount ?? 0) > 0)
    .map((i) => ({
      name: i["Invoice Number"] ?? "Invoice",
      client: nameOf(i),
      amount: i.Amount ?? 0,
      days: Math.max(differenceInCalendarDays(parseISO(i["Paid Date"]!), parseISO(i["Issue Date"]!)), 0),
    }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Running paid revenue through the year, this year against last; future months left empty. */
export function yearOnYear(invoices: Invoice[], todayIso: string) {
  const year = Number(todayIso.slice(0, 4));
  const thisMonth = Number(todayIso.slice(5, 7));
  const paid = paidOf(invoices);
  let a = 0, b = 0;
  return MONTHS.map((label, m) => {
    const key = (y: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
    b += sum(paid.filter((i) => i["Paid Date"]!.startsWith(key(year - 1))), (i) => i.Amount ?? 0);
    a += sum(paid.filter((i) => i["Paid Date"]!.startsWith(key(year))), (i) => i.Amount ?? 0);
    return { key: key(year), label, thisYear: m + 1 <= thisMonth ? a : (null as unknown as number), lastYear: b };
  });
}
