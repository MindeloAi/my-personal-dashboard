"use client";

import { useMemo } from "react";
import { SeriesChart, RankedBars, Donut, SERIES, PEOPLE_COLORS } from "./chart-kit";
import { buildFinance, dayLabel } from "@/lib/finance-data";
import { topWithOther } from "@/lib/overview-data";
import { today } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import type { Client, Project, Invoice, Expense, Subscription, FinanceHistory, Ledger } from "@/lib/db";

export type FinancePage = "summary" | "received" | "invoices" | "founder-pay" | "cash" | "expenses" | "recurring";

type Props = {
  page: FinancePage;
  invoices?: Invoice[];
  expenses?: Expense[];
  projects?: Project[];
  clients?: Client[];
  subscriptions?: Subscription[];
  history: FinanceHistory;
  ledger: Ledger;
};

const [BLUE, ORANGE, AQUA] = SERIES;
const HOLDER_SERIES = [
  { key: "business", name: "Business cash (safe)", color: BLUE },
  { key: "zane", name: "Zane", color: ORANGE },
  { key: "mikey", name: "Mikey", color: AQUA },
];

/** The charts for one Finance page, each with its explanation and records. */
export function FinanceCharts({ page, invoices = [], expenses = [], projects = [], clients = [], subscriptions = [], history, ledger }: Props) {
  const todayIso = today();
  const f = useMemo(
    () => buildFinance({ invoices, expenses, projects, clients, subscriptions, history, ledger }, todayIso),
    [invoices, expenses, projects, clients, subscriptions, history, ledger, todayIso],
  );
  const r = useMemo(() => f.records(tt), [f]);
  const since = ` Starts on ${dayLabel(ledger.cutover.slice(0, 10))} ${ledger.cutover.slice(0, 4)}, when the ledger began recording each payment.`;

  const charts: Record<FinancePage, React.ReactNode[]> = {
    summary: [
      <SeriesChart key="collected" kind="bar" title="Cash collected per month" rows={f.collected} series={[{ key: "collected", name: "Collected" }]} records={r.collected}
        description="Money actually received from clients each month: every recorded payment, plus invoices marked Paid before the ledger began. Click a month to see the payments." />,
      <SeriesChart key="ivc" kind="bar" title="Invoiced vs collected per month" rows={f.invoicedVsCollected} series={[{ key: "invoiced", name: "Invoiced" }, { key: "collected", name: "Collected" }]} records={r.invoicedAndCollected}
        description="What was billed each month (sent and paid invoices by issue date) next to what came in. Invoiced running well ahead of collected for months means money is piling up unpaid." />,
      <SeriesChart key="ages" kind="bar" shortTicks title="Unpaid invoices by age" rows={f.ages} series={[{ key: "value", name: "Still owed" }]} records={r.age}
        description="The unpaid balance on every sent invoice, by how late it is. Money more than 60 days late is the hardest to collect: chase it first." />,
      <RankedBars key="clients" title="Revenue by client, top 10 (all time)" data={f.clientsTop} valueLabel="Paid revenue" records={r.client}
        description="Paid invoices per client since the business started; smaller clients are grouped as Everything else. One client far ahead of the rest is a dependency risk." />,
      <Donut key="service" title="Revenue by service type (last 12 months)" data={f.serviceTotals} centre="Revenue" records={r.serviceType}
        description="Paid invoices over the last 12 months, by the service type of their project. Shows which kinds of work bring the money in. Click a slice to see its invoices." />,
      <Donut key="expenses" title="Expenses by category (last 12 months)" data={f.expenseTotals} centre="Spent" records={r.categoryInYear}
        description="Everything spent over the last 12 months, by category. Click a slice to see the expenses in it." />,
      <SeriesChart key="profit" kind="line" title="Profit per month" rows={f.profit} series={[{ key: "profit", name: "Profit" }]} records={r.profit}
        description="Cash collected minus expenses, each month, before founder pay. Below zero means the business spent more than it took in that month." />,
      <Donut key="split" colors={PEOPLE_COLORS} title="Where the payments go" data={f.splitTotals} centre="Collected" records={r.splitPart}
        description={`Every payment collected, split into the business share and each founder's pay under the split rules.${since}`} />,
      <SeriesChart key="cash" kind="line" title="Cash held over time" rows={f.cash} series={HOLDER_SERIES}
        description={`End-of-day balance in the safe and with each founder. Money with a founder should fall back to zero as it is sorted.${since}`} />,
      <SeriesChart key="mrr" kind="line" title="Recurring revenue trend" rows={f.mrr} series={[{ key: "mrr", name: "Monthly recurring revenue" }]} records={r.mrrMonth}
        description="What live retainers and subscriptions were worth per month at the end of each month (yearly and quarterly ones counted per month)." />,
      <SeriesChart key="days" kind="line" format="days" title="Days to get paid" rows={f.daysToPaid} series={[{ key: "days", name: "Average days" }]} records={r.daysToPaid}
        description="Average days from an invoice's issue date to its paid date, for invoices paid that month. Rising means clients are paying slower." />,
    ],
    received: [
      <Donut key="collector" colors={PEOPLE_COLORS} title="Who received the money" data={f.collectorTotals} centre="Collected" records={r.received}
        description={`Every payment collected, by who received it: Mikey, Zane, or paid straight to the business.${since}`} />,
      <SeriesChart key="tosort" kind="line" title="Money still to sort over time" rows={f.toSort} series={[{ key: "handover", name: "Zane still to hand over", color: ORANGE }, { key: "business", name: "Business share not yet in the safe", color: BLUE }]}
        description={`End-of-day money not sorted yet. Both lines should drop to zero soon after each payment.${since}`} />,
      <SeriesChart key="tosafe" kind="bar" format="days" title="Days from client payment to the safe" rows={f.daysToSafe} series={[{ key: "days", name: "Average days" }]}
        description={`On average, how many days the business share took to reach the safe after the client paid, by payment month. Only payments already in the safe count.${since}`} />,
    ],
    invoices: [
      <Donut key="status" title="Invoices by status" data={f.byStatus.map((x) => ({ name: x.label, value: x.value }))} centre="Invoiced" records={r.status}
        description="The value of all invoices at each status; the number of invoices is in brackets. Overdue is a Sent invoice past its due date." />,
      <SeriesChart key="invoiced" kind="bar" title="Value invoiced per month" rows={f.invoicedVsCollected} series={[{ key: "invoiced", name: "Invoiced" }]} records={r.invoiced}
        description="The value of invoices sent each month, by issue date (drafts and voided invoices left out)." />,
      <SeriesChart key="avg" kind="line" title="Average invoice size per month" rows={f.averageInvoice} series={[{ key: "average", name: "Average invoice" }]} records={r.invoiced}
        description="The average value of invoices sent each month. Bigger average invoices usually mean bigger projects or fewer small retainers." />,
    ],
    "founder-pay": [
      <Donut key="pm" colors={PEOPLE_COLORS} title="Founder pay by founder" data={f.founderTotals} centre="Founder pay" records={r.founder}
        description={`What each founder has earned from the payments collected, base plus bonus.${since}`} />,
      <Donut key="bb" title="Base vs bonus" data={f.baseBonus} centre="Founder pay" records={r.payPart}
        description={`All founder pay split into the fixed base share and the bonus set per invoice.${since}`} />,
      <Donut key="pd" title="Paid out vs still due" data={f.paidDue} centre="Founder pay" records={r.payStatus}
        description={`How much founder pay has been handed over, and how much is still owed to the founders.${since}`} />,
    ],
    cash: [
      <SeriesChart key="bal" kind="line" title="Business cash balance over time" rows={f.cash} series={[HOLDER_SERIES[0]]}
        description={`End-of-day balance in the safe. It rises when money is put in and falls when expenses or founder pay are paid from it.${since}`} />,
      <SeriesChart key="into" kind="bar" title="Money moved into the safe per month" rows={f.intoSafe} series={[{ key: "amount", name: "Into the safe" }]} records={r.intoSafe}
        description={`Transfers into the safe plus payments taken straight to it, each month.${since}`} />,
      <SeriesChart key="var" kind="bar" title="Cash count differences" rows={f.counts} series={[{ key: "variance", name: "Counted minus expected" }]} signColors={[AQUA, ORANGE]} signNames={["More than expected", "Money missing"]}
        description="Each cash count against what the books expected at that moment. Zero is a perfect match; a bar below zero means money was missing, above zero means unrecorded money turned up." />,
    ],
    expenses: [
      <Donut key="cat" title="Spending by category (all time)" data={f.byCategory} centre="Spent" records={r.category}
        description="Every expense recorded, grouped by category." />,
      <SeriesChart key="pmc" kind="stacked" total title="Spending per month by category" rows={f.expensesByMonth} series={["Software", "Subcontractors", "Hosting", "Hardware", "Marketing", "Other"].map((c) => ({ key: c, name: c }))} records={r.spent}
        description="Everything spent each month, split by category." />,
      <Donut key="payer" title="Who paid for expenses" data={f.byPayer} centre="Spent" records={r.payer}
        description="Expenses paid from business cash versus paid personally by a founder. Still owed back is money the business must reimburse; expenses from before the ledger have no payer recorded." />,
    ],
    recurring: [
      <SeriesChart key="mrr" kind="line" title="Monthly recurring revenue over time" rows={f.mrr} series={[{ key: "mrr", name: "Monthly recurring revenue" }]} records={r.mrrMonth}
        description="What live retainers and subscriptions were worth per month at the end of each month." />,
      <Donut key="rc" title="Recurring revenue by client" data={topWithOther(f.recurringByClient, 5)} centre="Per month" records={r.recurringClient}
        description="What each client's live subscriptions are worth per month (yearly and quarterly ones counted per month). Smaller clients are grouped as Everything else." />,
      <SeriesChart key="exp" kind="bar" title="Recurring invoices expected, this month and the next two" rows={f.expected} series={[{ key: "amount", name: "Expected" }]} records={r.expected}
        description="What live subscriptions are due to bill in each month. This month includes any billing already due but not invoiced yet." />,
    ],
  };

  return (
    <section aria-label="Charts" className="space-y-3">
      {page !== "summary" && <h2 className="text-[15px] font-semibold text-[#1B2533]">Charts</h2>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{charts[page]}</div>
    </section>
  );
}
