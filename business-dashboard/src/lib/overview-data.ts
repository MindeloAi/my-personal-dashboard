// Pure calculations behind the Overview charts. No React, so scripts can check
// them. Revenue follows the rule every other dashboard chart uses: a Paid
// invoice's full amount, counted in the month of its Paid Date.
import type { Client, Project, Invoice, Expense, Lead, Ledger } from "@/lib/db";
import { isOverdue } from "@/lib/invoices";

export type Slice = { name: string; value: number };
export type MonthRow = { key: string; month: string; revenue: number; expenses: number; profit: number; revenueToDate: number };

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
      key: k,
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

export function names(clients: Client[], projects: Project[]) {
  const projectClient = new Map(projects.map((p) => [p.id, p.Client?.[0]]));
  const clientName = new Map(clients.map((c) => [c.id, c.Company || c.Name || "Unnamed client"]));
  return (inv: Invoice) => {
    const id = clientOf(inv, projectClient);
    return (id && clientName.get(id)) || "No client";
  };
}

const sortDesc = (m: Map<string, number>): Slice[] =>
  [...m].map(([name, value]) => ({ name, value })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value);

/** Name of the slice that folds the smaller items together. */
export const OTHER = "Everything else";

/** Keep the top `keep`, fold the rest into OTHER so a chart never needs a ninth colour. */
export function topWithOther(slices: Slice[], keep: number): Slice[] {
  if (slices.length <= keep + 1) return slices;
  const other = slices.slice(keep).reduce((s, x) => s + x.value, 0);
  return [...slices.slice(0, keep), { name: OTHER, value: other }];
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

// ── The records behind each chart mark ─────────────────────────────────────
// Every chart point, bar and slice opens the rows that produced it, using the
// same rules as the totals above, so a row list always adds up to its mark.

export type RecordTable = { columns: string[]; rows: string[][] };
type Money = (n: number) => string;

export type Records = {
  /** Paid invoices and expenses in a month (MonthRow.key). */
  month(key: string): RecordTable;
  /** Paid invoices in a month only. */
  paidIn(key: string): RecordTable;
  /** Unpaid invoices for a client name, or every client outside `shown` for OTHER. */
  owedBy(name: string, shown?: string[]): RecordTable;
  /** Paid invoices for a client name, or every client outside `shown` for OTHER. */
  paidBy(name: string, shown: string[]): RecordTable;
  /** Paid invoices of a service type, or of every type outside `shown` for OTHER. */
  service(type: string, shown: string[]): RecordTable;
  /** Leads at a stage. */
  leads(stage: string): RecordTable;
  /** Payments and transfers that put money with a holder. */
  held(slice: string): RecordTable;
};

export function buildRecords(
  { invoices, expenses, projects, clients, leads, ledger }:
  { invoices: Invoice[]; expenses: Expense[]; projects: Project[]; clients: Client[]; leads: Lead[]; ledger: Ledger },
  money: Money,
): Records {
  const nameOf = names(clients, projects);
  const project = new Map(projects.map((p) => [p.id, p]));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const INV = ["Invoice", "Client · project", "Date", "Amount", "Status", "Notes"];
  const row = (i: Invoice, date: string | undefined, amount = i.Amount ?? 0) => [
    i["Invoice Number"] ?? "Draft",
    `${nameOf(i)}${i.Project?.[0] && project.get(i.Project[0]) ? " · " + project.get(i.Project[0])!.Name : ""}`,
    date ?? "",
    money(amount),
    i.Status ?? "",
    i.Notes ?? "",
  ];
  const paid = (pred: (i: Invoice) => boolean): RecordTable => ({
    columns: INV,
    rows: invoices
      .filter((i) => i.Status === "Paid" && pred(i))
      .sort((a, b) => (b["Paid Date"] ?? "").localeCompare(a["Paid Date"] ?? ""))
      .map((i) => row(i, i["Paid Date"])),
  });
  const inMonth = (key: string) => (i: Invoice) => !!i["Paid Date"] && monthKey(i["Paid Date"]) === key;
  const serviceOf = (i: Invoice) => (i.Project?.[0] && project.get(i.Project[0])?.["Service Type"]) || "Unspecified";
  const HOLDER = { "Business cash (safe)": "business", Zane: "zane", Mikey: "mikey" } as const;

  return {
    month(key) {
      const exp = expenses.filter((e) => e.Date && monthKey(e.Date) === key);
      return {
        columns: ["Type", ...INV],
        rows: [
          ...paid(inMonth(key)).rows.map((r) => ["Revenue", ...r]),
          ...exp.map((e) => ["Expense", e.Name, e.Category ?? "", e.Date ?? "", money(-(e.Amount ?? 0)), "", ""]),
        ],
      };
    },
    paidIn: (key) => paid(inMonth(key)),
    owedBy: (name, shown = []) => ({
      columns: [...INV.slice(0, 2), "Due", "Still owed", "Status", "Notes"],
      rows: invoices
        .filter((i) => (i.Status === "Sent" || i.Status === "Overdue") && (name === OTHER ? !shown.includes(nameOf(i)) : nameOf(i) === name))
        .map((i) => {
          const r = row(i, i["Due Date"], (i.Amount ?? 0) - (i["Paid So Far"] ?? 0));
          r[4] = isOverdue(i) ? "Overdue" : "Sent";
          return r;
        }),
    }),
    paidBy: (name, shown) => paid((i) => (name === OTHER ? !shown.includes(nameOf(i)) : nameOf(i) === name)),
    service: (type, shown) => paid((i) => (type === OTHER ? !shown.includes(serviceOf(i)) : serviceOf(i) === type)),
    leads: (stage) => ({
      columns: ["Lead", "Business", "Service interest", "Budget", "Source"],
      rows: leads
        .filter((l) => l.Status === stage)
        .map((l) => [l.Name, l["Business Name"] ?? "", l["Service Interest"] ?? "", l["Budget Range"] ?? "", l.Source ?? ""]),
    }),
    held(slice) {
      const h = HOLDER[slice as keyof typeof HOLDER];
      const inv = (id: string) => invoiceById.get(id);
      return {
        columns: ["Date", "What", "Invoice", "Client", "Amount"],
        rows: [
          ...ledger.payments
            .filter((p) => p.receivedBy === h)
            .map((p) => [p.paidAt.slice(0, 10), "Collected", inv(p.invoiceId)?.["Invoice Number"] ?? "", inv(p.invoiceId) ? nameOf(inv(p.invoiceId)!) : "", money(p.amount)]),
          ...ledger.movements
            .filter((m) => m.toLoc === h || m.fromLoc === h)
            .map((m) => [
              m.movedAt.slice(0, 10),
              m.kind === "opening" ? "Opening balance" : m.toLoc === h ? `Received from ${m.fromLoc ?? "outside"}` : `Moved to ${m.toLoc ?? "outside"}`,
              m.note ?? "",
              "",
              money(m.toLoc === h ? m.amount : -m.amount),
            ]),
          // Mirrors cash_flows (migration 011): expenses count from cutover.
          ...expenses
            .filter((e) => e["Paid From"] === h && e.Date && e.Date >= ledger.cutover.slice(0, 10))
            .map((e) => [e.Date!, `Expense: ${e.Name}`, "", "", money(-(e.Amount ?? 0))]),
          ...expenses
            .filter((e) => e["Reimbursed From"] === h && e["Reimbursed At"])
            .map((e) => [e["Reimbursed At"]!.slice(0, 10), `Reimbursed: ${e.Name}`, "", "", money(-(e.Amount ?? 0))]),
          ...ledger.payouts
            .filter((p) => p.status === "paid_out" && p.paidFrom === h)
            .map((p) => [(p.paidOutAt ?? "").slice(0, 10), `Founder pay ${p.number} to ${p.founder}`, p.invoiceNumber ?? "", p.client ?? "", money(-p.total)]),
        ].sort((a, b) => b[0].localeCompare(a[0])),
      };
    },
  };
}
