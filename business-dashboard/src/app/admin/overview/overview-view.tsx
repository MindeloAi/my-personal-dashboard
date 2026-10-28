"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { BusinessCounters } from "@/components/dashboard/business-counters";
import {
  MonthlyMoneyChart, RevenueToDateChart, ProfitBarsChart, MoneyHeldChart,
  OwedByClientChart, LeadsByStageChart, TopClientsChart, ServiceMixChart,
} from "@/components/dashboard/overview-charts";
import {
  monthlyMoney, owedByClient, revenueByClient, revenueByService, leadsByStage,
  moneyHeld, owedSplit, topWithOther,
} from "@/lib/overview-data";
import { mrr, today } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import type { Client, Project, Invoice, Expense, Subscription, Ledger, Lead } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  subscriptions: Subscription[];
  leads: Lead[];
  ledger: Ledger;
};

/**
 * Prints the page (the browser's "Save as PDF"). Charts size themselves from
 * their box, and the browser does not re-measure them for paper, so the page
 * is laid out at paper width first (html.printing, see globals.css) and the
 * dialog opens once the charts have redrawn.
 */
function exportPdf() {
  const html = document.documentElement;
  html.classList.add("printing");
  const done = () => {
    html.classList.remove("printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 300);
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="border border-[#DCE1E8] bg-white p-4 break-inside-avoid">
      <p className="text-xs font-medium text-[#4A5568]">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${tone ?? "text-[#1B2533]"}`}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-[#5A6678]">{note}</p>
    </div>
  );
}

export function OverviewView({ clients, projects, invoices, expenses, subscriptions, leads, ledger }: Props) {
  const router = useRouter();
  const todayIso = today();

  const d = useMemo(() => {
    const months = monthlyMoney(invoices, expenses, todayIso);
    const owed = owedByClient(invoices, projects, clients);
    const stages = leadsByStage(leads);
    const best = months.reduce((a, b) => (b.revenue > a.revenue ? b : a), months[0]);
    return {
      months,
      owed,
      stages,
      best,
      year: months.reduce((s, m) => s + m.revenue, 0),
      split: owedSplit(invoices),
      clientsTop: topWithOther(revenueByClient(invoices, projects, clients), 5),
      services: revenueByService(invoices, projects),
      held: moneyHeld(ledger.cash),
      monthly: mrr(subscriptions),
    };
  }, [invoices, expenses, projects, clients, leads, subscriptions, ledger.cash, todayIso]);

  const { cash, owedToUs, month } = ledger;
  const since = todayIso.startsWith(ledger.cutover.slice(0, 7))
    ? `since ${format(parseISO(ledger.cutover.slice(0, 10)), "d MMM")}`
    : format(parseISO(todayIso), "MMMM");
  const stage = (s: string) => d.stages.find((x) => x.name === s)?.value ?? 0;

  return (
    <div id="overview-report" className="space-y-4">
      {/* Shown only on the printed / saved PDF. */}
      <div className="hidden print:block">
        <p className="text-xl font-semibold">Mindelo: business overview</p>
        <p className="text-sm text-[#4A5568]">{format(parseISO(todayIso), "EEEE d MMMM yyyy")} · all figures in TT$</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1B2533]">Overview</h1>
          <p className="mt-1 text-sm text-[#4A5568]">The whole business on one page: money held, money owed, this month, sales and the trends behind them. Click any chart to enlarge it and see its numbers.</p>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          className="min-h-10 shrink-0 rounded-[4px] bg-[#1D4ED8] px-4 text-sm font-medium text-white hover:bg-[#1E40AF] print:hidden"
        >
          Export PDF
        </button>
      </div>

      <div className="overview-tiles grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Business cash (safe)" value={tt(cash.business)} note="Counted money in the safe, held by Mikey." />
        <Tile label="All money held" value={tt(cash.total)} note={`Safe plus unsorted money: Zane ${tt(cash.zane)}, Mikey ${tt(cash.mikey)}.`} />
        <Tile label="Owed to us" value={tt(owedToUs.total)} note={`Unpaid balance on ${owedToUs.count} sent invoices.`} tone="text-[#B45309]" />
        <Tile label="Overdue" value={tt(d.split.overdue)} note={`${d.split.overdueCount} invoices past their due date.`} tone="text-[#B23A0A]" />
        <Tile label={`This month's net (${since})`} value={tt(month.net)} note={`${tt(month.payments)} in, ${tt(month.expenses)} expenses, ${tt(month.payoutsPaidOut)} founder pay.`} />
        <Tile label="Monthly recurring revenue" value={tt(d.monthly)} note="What live retainers and subscriptions bring in each month." />
      </div>

      <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5 break-inside-avoid">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Summary</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#334155]">
          <li><strong className="text-[#1B2533]">Money held:</strong> {tt(cash.total)} in total: {tt(cash.business)} in the safe, {tt(cash.zane)} with Zane and {tt(cash.mikey)} with Mikey.</li>
          <li>
            <strong className="text-[#1B2533]">Owed to us:</strong> {tt(owedToUs.total)} on {owedToUs.count} invoices, of which {tt(d.split.overdue)} on {d.split.overdueCount} is overdue.
            {d.owed[0] && ` The largest balance is ${d.owed[0].name} at ${tt(d.owed[0].value)}.`}
          </li>
          <li><strong className="text-[#1B2533]">This month ({since}):</strong> {tt(month.payments)} came in, {tt(month.expenses)} went on expenses and {tt(month.payoutsPaidOut)} was paid to founders, leaving {tt(month.net)}.</li>
          <li><strong className="text-[#1B2533]">Last 12 months:</strong> {tt(d.year)} revenue{d.best?.revenue ? `; the best month was ${d.best.month} at ${tt(d.best.revenue)}` : ""}.</li>
          <li><strong className="text-[#1B2533]">Sales:</strong> {leads.length} leads: {stage("New")} new, {stage("Contacted")} contacted, {stage("Proposal Sent")} with a proposal out, {stage("Won")} won and {stage("Lost")} lost.</li>
          <li><strong className="text-[#1B2533]">Recurring:</strong> {tt(d.monthly)} a month from retainers and subscriptions ({tt(d.monthly * 12)} a year).</li>
        </ul>
      </section>

      <div className="overview-charts grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MonthlyMoneyChart data={d.months} />
        <ProfitBarsChart data={d.months} />
        <MoneyHeldChart data={d.held} />
        <OwedByClientChart data={d.owed} />
        <RevenueToDateChart data={d.months} />
        <ServiceMixChart data={d.services} />
        <TopClientsChart data={d.clientsTop} />
        <LeadsByStageChart data={d.stages} />
        <div className="break-inside-avoid">
          <BusinessCounters
            clients={clients}
            projects={projects}
            invoices={invoices}
            onJumpToOverdue={() => router.push("/admin/finance/invoices?status=Overdue")}
          />
        </div>
      </div>
    </div>
  );
}
