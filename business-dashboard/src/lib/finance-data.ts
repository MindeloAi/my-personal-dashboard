// Shapes the Finance Summary and subpage charts. Ledger totals arrive already
// summed by SQL (getFinanceHistory); this file only lays them out by month and
// does the invoice, expense and subscription groupings the Overview also uses.
// No React, so scripts/finance-data.test.ts can check it.
import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Client, Project, Invoice, Expense, Subscription, FinanceHistory, Ledger } from "@/lib/db";
import { isOverdue } from "@/lib/invoices";
import { isActive, monthlyAmount, nextInvoiceDate, periodMonths } from "@/lib/subscriptions";
import { names, OTHER, revenueByClient, topWithOther, type RecordTable, type Slice } from "@/lib/overview-data";
import { FOUNDER_LABEL, HOLDER_LABEL } from "@/lib/ledger";

export type Row = { label: string; key: string } & Record<string, number | string>;
type Money = (n: number) => string;

const LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const DAY_LABEL = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = (key: string) => LABEL.format(new Date(`${key}-01T00:00:00Z`));
export const dayLabel = (iso: string) => DAY_LABEL.format(new Date(`${iso}T00:00:00Z`));

/** The last `count` month keys ("YYYY-MM") ending with today's month. */
export function lastMonths(todayIso: string, count = 12): string[] {
  const [y, m] = todayIso.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1)).toISOString().slice(0, 7));
}

/** One row per month, filled by `fill(key)`, labelled "Oct 26". */
const byMonth = (keys: string[], fill: (key: string) => Record<string, number>): Row[] =>
  keys.map((key) => ({ key, label: monthLabel(key), ...fill(key) }));

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const inMonth = (iso: string | undefined, key: string) => !!iso && iso.slice(0, 7) === key;
const issued = (i: Invoice) => i.Status === "Sent" || i.Status === "Overdue" || i.Status === "Paid";

export const EXPENSE_CATEGORIES = ["Software", "Subcontractors", "Hosting", "Hardware", "Marketing", "Other"] as const;

export type FinanceData = ReturnType<typeof buildFinance>;

export function buildFinance(
  { invoices, expenses, projects, clients, subscriptions, history, ledger }:
  { invoices: Invoice[]; expenses: Expense[]; projects: Project[]; clients: Client[]; subscriptions: Subscription[]; history: FinanceHistory; ledger: Ledger },
  todayIso: string,
) {
  const months = lastMonths(todayIso);
  const ledgerMonths = months.filter((k) => k >= ledger.cutover.slice(0, 7));
  const nameOf = names(clients, projects);
  const serviceOf = new Map(projects.map((p) => [p.id, p["Service Type"] ?? "Unspecified"]));
  const service = (i: Invoice) => (i.Project?.[0] && serviceOf.get(i.Project[0])) || "Unspecified";
  const collectedIn = (key: string, source?: string) =>
    sum(history.collected.filter((c) => c.month === key && (!source || c.source === source)), (c) => c.amount);
  const spentIn = (key: string, category?: string) =>
    sum(expenses.filter((e) => inMonth(e.Date, key) && (!category || (e.Category ?? "Other") === category)), (e) => e.Amount ?? 0);

  // Revenue by service type per month: top five types, the rest as OTHER.
  const paid = invoices.filter((i) => i.Status === "Paid" && i["Paid Date"]);
  const topServices = topWithOther(
    [...paid.reduce((m, i) => m.set(service(i), (m.get(service(i)) ?? 0) + (i.Amount ?? 0)), new Map<string, number>())]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    5,
  ).map((s) => s.name);
  const serviceBucket = (i: Invoice) => (topServices.includes(service(i)) ? service(i) : OTHER);

  // Unpaid invoices by how late they are.
  const ageOf = (i: Invoice) => {
    const due = i["Due Date"];
    if (!due || !isOverdue(i, parseISO(`${todayIso}T12:00:00`))) return "Not yet due";
    const late = differenceInCalendarDays(parseISO(todayIso), parseISO(due));
    return late <= 30 ? "1–30 days late" : late <= 60 ? "31–60 days late" : "60+ days late";
  };
  const unpaid = invoices.filter((i) => i.Status === "Sent" || i.Status === "Overdue");
  const remaining = (i: Invoice) => (i.Amount ?? 0) - (i["Paid So Far"] ?? 0);
  const AGES = ["Not yet due", "1–30 days late", "31–60 days late", "60+ days late"];

  // Recurring: what each subscription will bill this month and the next two.
  // A billing date already missed (not invoiced yet) is due now, so it counts
  // in this month.
  const ahead = lastMonths(format(addMonths(parseISO(todayIso), 2), "yyyy-MM-dd"), 3);
  const billing = subscriptions.flatMap((s) => {
    if (s.Status !== "Active") return [];
    const out: { sub: Subscription; date: string; late: boolean }[] = [];
    let d = nextInvoiceDate(s, invoices);
    while (d && d.slice(0, 7) <= ahead[2] && (!s["End Date"] || d <= s["End Date"])) {
      const late = d < todayIso;
      out.push({ sub: s, date: late && d.slice(0, 7) < ahead[0] ? `${ahead[0]}-01` : d, late });
      d = format(addMonths(parseISO(d), periodMonths(s)), "yyyy-MM-dd");
    }
    return out;
  });
  const endOf = (key: string) => format(addMonths(parseISO(`${key}-01`), 1).getTime() - 86400000, "yyyy-MM-dd");

  // Expenses by who paid.
  const payer = (e: Expense) =>
    e["Paid From"] ? "Paid from business cash"
      : e["Paid Personally By"] ? (e["Reimbursed At"] ? "Paid personally, reimbursed" : "Paid personally, still owed back")
      : "Not recorded (before the ledger)";

  const founderRows = (["michael", "zane"] as const).map((f) => {
    const rows = history.payouts.filter((p) => p.founder === f);
    return { key: f, label: FOUNDER_LABEL[f], base: sum(rows, (r) => r.base), bonus: sum(rows, (r) => r.bonus), paidOut: sum(rows, (r) => r.paidOut), due: sum(rows, (r) => r.due) };
  });

  const clientsTop = topWithOther(revenueByClient(invoices, projects, clients), 10);

  return {
    months,
    serviceSeries: topServices,
    // Summary
    collected: byMonth(months, (k) => ({ collected: collectedIn(k) })),
    invoicedVsCollected: byMonth(months, (k) => ({
      invoiced: sum(invoices.filter((i) => issued(i) && inMonth(i["Issue Date"], k)), (i) => i.Amount ?? 0),
      collected: collectedIn(k),
    })),
    ages: AGES.map((a) => ({ key: a, label: a, value: sum(unpaid.filter((i) => ageOf(i) === a), remaining) })),
    clientsTop,
    serviceByMonth: byMonth(months, (k) =>
      Object.fromEntries(topServices.map((s) => [s, sum(paid.filter((i) => inMonth(i["Paid Date"], k) && serviceBucket(i) === s), (i) => i.Amount ?? 0)]))),
    expensesByMonth: byMonth(months, (k) => Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, spentIn(k, c)]))),
    // Pie versions: totals over the same 12 months, and the payment split since the cutover.
    serviceTotals: topServices.map((t) => ({ name: t, value: sum(paid.filter((i) => months.includes(i["Paid Date"]!.slice(0, 7)) && serviceBucket(i) === t), (i) => i.Amount ?? 0) })).filter((x) => x.value > 0),
    expenseTotals: EXPENSE_CATEGORIES.map((c) => ({ name: c, value: sum(months, (k) => spentIn(k, c)) })).filter((x) => x.value > 0),
    splitTotals: [
      { name: "Business share", value: sum(history.split, (x) => x.business) },
      { name: "Michael", value: sum(history.split, (x) => x.michael) },
      { name: "Zane", value: sum(history.split, (x) => x.zane) },
    ].filter((x) => x.value > 0),
    profit: byMonth(months, (k) => ({ profit: collectedIn(k) - spentIn(k) })),
    split: byMonth(ledgerMonths, (k) => {
      const r = history.split.find((s) => s.month === k);
      return { business: r?.business ?? 0, michael: r?.michael ?? 0, zane: r?.zane ?? 0 };
    }),
    cash: [...new Set(history.cash.map((c) => c.day))].map((day) => ({
      key: day,
      label: dayLabel(day),
      ...Object.fromEntries(history.cash.filter((c) => c.day === day).map((c) => [c.location, c.balance])),
    })) as Row[],
    mrr: byMonth(months, (k) => ({ mrr: subscriptions.filter((s) => isActive(s, endOf(k))).reduce((t, s) => t + monthlyAmount(s), 0) })),
    daysToPaid: byMonth(months, (k) => {
      const xs = paid.filter((i) => inMonth(i["Paid Date"], k) && i["Issue Date"]);
      return { days: xs.length ? sum(xs, (i) => differenceInCalendarDays(parseISO(i["Paid Date"]!), parseISO(i["Issue Date"]!))) / xs.length : 0 };
    }),
    // Money received
    byCollector: byMonth(ledgerMonths, (k) => ({ mikey: collectedIn(k, "mikey"), zane: collectedIn(k, "zane"), business: collectedIn(k, "business") })),
    toSort: history.toSort.map((t) => ({ key: t.day, label: dayLabel(t.day), handover: t.handover, business: t.business })) as Row[],
    daysToSafe: byMonth(ledgerMonths, (k) => ({ days: history.daysToSafe.find((d) => d.month === k)?.days ?? 0 })),
    // Invoices
    byStatus: (["Draft", "Sent", "Overdue", "Paid", "Void"] as const).map((st) => {
      const xs = invoices.filter((i) => (st === "Overdue" ? i.Status !== "Paid" && isOverdue(i) : st === "Sent" ? i.Status === "Sent" && !isOverdue(i) : i.Status === st));
      return { key: st, label: `${st} (${xs.length})`, value: sum(xs, (i) => i.Amount ?? 0), count: xs.length };
    }),
    averageInvoice: byMonth(months, (k) => {
      const xs = invoices.filter((i) => issued(i) && inMonth(i["Issue Date"], k));
      return { average: xs.length ? sum(xs, (i) => i.Amount ?? 0) / xs.length : 0 };
    }),
    // Founder pay
    payoutsByMonth: byMonth(ledgerMonths, (k) => ({
      michael: sum(history.payouts.filter((p) => p.month === k && p.founder === "michael"), (p) => p.base + p.bonus),
      zane: sum(history.payouts.filter((p) => p.month === k && p.founder === "zane"), (p) => p.base + p.bonus),
    })),
    founders: founderRows as Row[],
    // Cash & safe
    intoSafe: byMonth(ledgerMonths, (k) => ({ amount: history.intoSafe.find((s) => s.month === k)?.amount ?? 0 })),
    counts: history.counts.map((c, i) => ({ key: String(i), label: `${dayLabel(c.day)} · ${HOLDER_LABEL[c.location]}`, variance: c.variance, counted: c.counted, expected: c.expected })) as Row[],
    // Expenses
    byCategory: EXPENSE_CATEGORIES.map((c) => ({ name: c, value: sum(expenses.filter((e) => (e.Category ?? "Other") === c), (e) => e.Amount ?? 0) })).filter((s) => s.value > 0),
    byPayer: ["Paid from business cash", "Paid personally, reimbursed", "Paid personally, still owed back", "Not recorded (before the ledger)"]
      .map((p) => ({ name: p, value: sum(expenses.filter((e) => payer(e) === p), (e) => e.Amount ?? 0) }))
      .filter((s) => s.value > 0),
    // Recurring
    recurringByClient: [...subscriptions.filter((s) => isActive(s, todayIso)).reduce((m, s) => {
      const c = clients.find((x) => x.id === s.Client?.[0]);
      const n = c ? c.Company || c.Name : s.Name;
      return m.set(n, (m.get(n) ?? 0) + monthlyAmount(s));
    }, new Map<string, number>())].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) as Slice[],
    expected: byMonth(ahead, (k) => ({ amount: sum(billing.filter((b) => b.date.slice(0, 7) === k), (b) => b.sub.Amount ?? 0) })),

    /** The records behind one mark. Each list sums to its mark. */
    records(money: Money) {
      const INV = ["Invoice", "Client", "Date", "Amount", "Status", "Notes"];
      const inv = (i: Invoice, date: string | undefined, amount = i.Amount ?? 0) =>
        [i["Invoice Number"] ?? "Draft", nameOf(i), date ?? "", money(amount), i.Status ?? "", i.Notes ?? ""];
      const exp = (e: Expense) => [e.Name, e.Category ?? "Other", e.Date ?? "", money(e.Amount ?? 0), payer(e)];
      const EXP = ["Expense", "Category", "Date", "Amount", "Paid by"];
      const monthKeyOf = (label: string) => months.find((k) => monthLabel(k) === label) ?? ahead.find((k) => monthLabel(k) === label) ?? "";
      const invoiceById = new Map(invoices.map((i) => [i.id, i]));
      const collectedRows = (key: string, source?: string): RecordTable => ({
        columns: ["Date", "Invoice", "Client", "Amount", "Received by", "Notes"],
        rows: [
          ...ledger.payments.filter((p) => p.paidAt.slice(0, 7) === key && (!source || p.receivedBy === source)).map((p) => {
            const i = invoiceById.get(p.invoiceId);
            return [p.paidAt.slice(0, 10), i?.["Invoice Number"] ?? "", i ? nameOf(i) : "", money(p.amount), HOLDER_LABEL[p.receivedBy], i?.Notes ?? ""];
          }),
          ...(source ? [] : invoices
            .filter((i) => i.Status === "Paid" && inMonth(i["Paid Date"], key) && i["Paid Date"]! < ledger.cutover.slice(0, 10)
              && !ledger.payments.some((p) => p.invoiceId === i.id))
            .map((i) => [i["Paid Date"]!, i["Invoice Number"] ?? "", nameOf(i), money(i.Amount ?? 0), "Before the ledger", i.Notes ?? ""])),
        ],
      });
      const issuedIn = (key: string): RecordTable => ({ columns: INV, rows: invoices.filter((i) => issued(i) && inMonth(i["Issue Date"], key)).map((i) => inv(i, i["Issue Date"])) });
      const spent = (key: string, category?: string): RecordTable => ({ columns: EXP, rows: expenses.filter((e) => inMonth(e.Date, key) && (!category || (e.Category ?? "Other") === category)).map(exp) });
      return {
        collected: (label: string) => collectedRows(monthKeyOf(label)),
        invoiced: (label: string) => issuedIn(monthKeyOf(label)),
        invoicedAndCollected: (label: string) => {
          const a = issuedIn(monthKeyOf(label)), b = collectedRows(monthKeyOf(label));
          return { columns: ["Type", "Ref", "Client", "Date", "Amount", "Notes"], rows: [
            ...a.rows.map((r) => ["Invoiced", r[0], r[1], r[2], r[3], r[5]]),
            ...b.rows.map((r) => ["Collected", r[1], r[2], r[0], r[3], r[5]]),
          ] };
        },
        age: (bucket: string): RecordTable => ({ columns: [...INV.slice(0, 2), "Due", "Still owed", "Status", "Notes"], rows: unpaid.filter((i) => ageOf(i) === bucket).map((i) => inv(i, i["Due Date"], remaining(i))) }),
        client: (name: string): RecordTable => {
          const shown = clientsTop.map((c) => c.name);
          return { columns: INV, rows: invoices.filter((i) => i.Status === "Paid" && (name === OTHER ? !shown.includes(nameOf(i)) : nameOf(i) === name)).map((i) => inv(i, i["Paid Date"])) };
        },
        serviceMonth: (label: string): RecordTable => ({
          columns: ["Service type", ...INV],
          rows: paid.filter((i) => inMonth(i["Paid Date"], monthKeyOf(label))).map((i) => [serviceBucket(i), ...inv(i, i["Paid Date"])]),
        }),
        spent: (label: string) => spent(monthKeyOf(label)),
        serviceType: (name: string): RecordTable => ({
          columns: INV,
          rows: paid.filter((i) => months.includes(i["Paid Date"]!.slice(0, 7)) && serviceBucket(i) === name).map((i) => inv(i, i["Paid Date"])),
        }),
        categoryInYear: (name: string): RecordTable => ({
          columns: EXP,
          rows: expenses.filter((e) => !!e.Date && months.includes(e.Date.slice(0, 7)) && (e.Category ?? "Other") === name).map(exp),
        }),
        splitPart: (name: string): RecordTable => {
          const part = (c: Ledger["collections"][number]) => (name === "Michael" ? c.michaelPayout : name === "Zane" ? c.zanePayout : c.businessShare);
          return {
            columns: ["Date", "Invoice", "Client", "Payment", name],
            rows: ledger.collections.map((c) => [c.paidAt.slice(0, 10), c.invoiceNumber ?? "", c.client ?? "", money(c.amount), money(part(c))]),
          };
        },
        profit: (label: string) => {
          const k = monthKeyOf(label), c = collectedRows(k);
          return { columns: ["Type", "Ref", "Client / category", "Date", "Amount"], rows: [
            ...c.rows.map((r) => ["Collected", r[1], r[2], r[0], r[3]]),
            ...expenses.filter((x) => inMonth(x.Date, k)).map((x) => ["Expense", x.Name, x.Category ?? "Other", x.Date ?? "", money(-(x.Amount ?? 0))]),
          ] };
        },
        split: (label: string): RecordTable => ({
          columns: ["Date", "Invoice", "Client", "Payment", "Business", "Michael", "Zane"],
          rows: ledger.collections.filter((c) => c.paidAt.slice(0, 7) === monthKeyOf(label)).map((c) => [
            c.paidAt.slice(0, 10), c.invoiceNumber ?? "", c.client ?? "", money(c.amount), money(c.businessShare), money(c.michaelPayout), money(c.zanePayout),
          ]),
        }),
        collector: (label: string) => {
          const t = collectedRows(monthKeyOf(label));
          return { ...t, rows: t.rows.filter((row) => row[4] !== "Before the ledger") };
        },
        status: (label: string): RecordTable => {
          const st = label.split(" (")[0];
          return { columns: INV, rows: invoices.filter((i) => (st === "Overdue" ? i.Status !== "Paid" && isOverdue(i) : st === "Sent" ? i.Status === "Sent" && !isOverdue(i) : i.Status === st)).map((i) => inv(i, i["Issue Date"])) };
        },
        payoutsMonth: (label: string): RecordTable => ({
          columns: ["Pay", "Founder", "Invoice", "Client", "Base", "Bonus", "Total", "Status"],
          rows: ledger.payouts.filter((p) => p.paidAt.slice(0, 7) === monthKeyOf(label)).map((p) => [
            p.number, FOUNDER_LABEL[p.founder], p.invoiceNumber ?? "", p.client ?? "", money(p.base), money(p.bonus), money(p.total), p.status === "paid_out" ? "Paid out" : "Due",
          ]),
        }),
        founder: (label: string): RecordTable => ({
          columns: ["Pay", "Invoice", "Client", "Base", "Bonus", "Total", "Status"],
          rows: ledger.payouts.filter((p) => FOUNDER_LABEL[p.founder] === label).map((p) => [
            p.number, p.invoiceNumber ?? "", p.client ?? "", money(p.base), money(p.bonus), money(p.total), p.status === "paid_out" ? "Paid out" : "Due",
          ]),
        }),
        intoSafe: (label: string): RecordTable => ({
          columns: ["Date", "From", "Note", "Amount"],
          rows: [
            ...ledger.movements.filter((m) => m.toLoc === "business" && m.kind === "transfer" && m.movedAt.slice(0, 7) === monthKeyOf(label))
              .map((m) => [m.movedAt.slice(0, 10), m.fromLoc ? HOLDER_LABEL[m.fromLoc] : "", m.note ?? "", money(m.amount)]),
            ...ledger.payments.filter((p) => p.receivedBy === "business" && p.paidAt.slice(0, 7) === monthKeyOf(label))
              .map((p) => [p.paidAt.slice(0, 10), "Client, paid straight to the safe", invoiceById.get(p.invoiceId)?.["Invoice Number"] ?? "", money(p.amount)]),
          ],
        }),
        category: (name: string): RecordTable => ({ columns: EXP, rows: expenses.filter((e) => (e.Category ?? "Other") === name).map(exp) }),
        payer: (name: string): RecordTable => ({ columns: EXP, rows: expenses.filter((e) => payer(e) === name).map(exp) }),
        recurringClient: (name: string): RecordTable => ({
          columns: ["Subscription", "Amount", "Per month", "Started"],
          rows: subscriptions.filter((s) => isActive(s, todayIso) && ((clients.find((c) => c.id === s.Client?.[0])?.Company || clients.find((c) => c.id === s.Client?.[0])?.Name || s.Name) === name))
            .map((s) => [s.Name, money(s.Amount ?? 0), money(monthlyAmount(s)), s["Start Date"] ?? ""]),
        }),
        expected: (label: string): RecordTable => ({
          columns: ["Subscription", "Due", "Amount"],
          rows: billing.filter((b) => b.date.slice(0, 7) === monthKeyOf(label)).map((b) => [b.sub.Name, b.late ? "Already due, not invoiced" : b.date, money(b.sub.Amount ?? 0)]),
        }),
        mrrMonth: (label: string): RecordTable => ({
          columns: ["Subscription", "Per month"],
          rows: subscriptions.filter((s) => isActive(s, endOf(monthKeyOf(label)))).map((s) => [s.Name, money(monthlyAmount(s))]),
        }),
        daysToPaid: (label: string): RecordTable => ({
          columns: ["Invoice", "Client", "Issued", "Paid", "Days"],
          rows: paid.filter((i) => inMonth(i["Paid Date"], monthKeyOf(label)) && i["Issue Date"]).map((i) => [
            i["Invoice Number"] ?? "", nameOf(i), i["Issue Date"]!, i["Paid Date"]!, String(differenceInCalendarDays(parseISO(i["Paid Date"]!), parseISO(i["Issue Date"]!))),
          ]),
        }),
      };
    },
  };
}
