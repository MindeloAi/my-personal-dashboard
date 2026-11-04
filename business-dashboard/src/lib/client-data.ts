// One client's money, for the client file: billed, paid, owed, received by
// month, paid by project and how long they take to pay. Pure; the caller
// passes only this client's invoices, projects and payments (see linksFor).
// Display only: the database stays the source of truth for every figure.
// Checked by scripts/client-data.test.ts.
import type { Invoice, Project } from "./db";
import { paidOn } from "./record-graph";

type Pay = { invoiceId: string; amount: number; paidAt: string };
const DAY = 86_400_000;

export function clientMoney({ projects, invoices, payments, cutover }: { projects: Project[]; invoices: Invoice[]; payments: Pay[]; cutover: string }) {
  const issued = invoices.filter((i) => i.Status !== "Draft" && i.Status !== "Void");
  const billed = issued.reduce((s, i) => s + (i.Amount ?? 0), 0);
  const paid = issued.reduce((s, i) => s + paidOn(i), 0);

  // Money in by month: ledger payments, plus invoices paid in full before the ledger began.
  const months = new Map<string, number>();
  const add = (date: string, amount: number) => months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + amount);
  const ids = new Set(issued.map((i) => i.id));
  const withPayments = new Set(payments.map((p) => p.invoiceId));
  for (const p of payments) if (ids.has(p.invoiceId)) add(p.paidAt, p.amount);
  for (const i of issued)
    if (i.Status === "Paid" && i["Paid Date"] && i["Paid Date"] < cutover.slice(0, 10) && !withPayments.has(i.id))
      add(i["Paid Date"], i.Amount ?? 0);
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([label, v]) => ({ label, paid: v }));

  const name = new Map(projects.map((p) => [p.id, p.Name]));
  const perProject = new Map<string, number>();
  for (const i of issued) {
    const v = paidOn(i);
    if (v <= 0) continue;
    const n = name.get(i.Project?.[0] ?? "") ?? "No project";
    perProject.set(n, (perProject.get(n) ?? 0) + v);
  }
  const byProject = [...perProject].map(([n, value]) => ({ name: n, value })).sort((a, b) => b.value - a.value);

  const spans = issued
    .filter((i) => i.Status === "Paid" && i["Issue Date"] && i["Paid Date"])
    .map((i) => (Date.parse(i["Paid Date"]!) - Date.parse(i["Issue Date"]!)) / DAY);
  const avgDaysToPay = spans.length ? Math.round(spans.reduce((s, d) => s + d, 0) / spans.length) : null;

  return { billed, paid, owed: Math.max(0, billed - paid), byMonth, byProject, avgDaysToPay };
}
