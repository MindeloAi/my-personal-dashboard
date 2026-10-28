import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getExpenses, getSubscriptions, getLedger, getFinanceHistory } from "@/lib/db";
import { mrr, today } from "@/lib/subscriptions";
import { owedSplit } from "@/lib/overview-data";
import { tt } from "@/lib/ledger";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Finance → Summary. Old bookmarks and emails that point here with ?status=
 * or ?client= were invoice filters, so those still land on Invoices with the
 * same parameters.
 */
export default async function FinanceSummary({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of [value].flat()) if (one !== undefined) params.append(key, one);
  }
  if (params.size) redirect(`/admin/finance/invoices?${params}`);

  await requireAdminPage();
  const [clients, projects, invoices, expenses, subscriptions, ledger, history] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getSubscriptions(),
    getLedger(today()),
    getFinanceHistory(today()),
  ]);
  const { cash, owedToUs, month } = ledger;
  const split = owedSplit(invoices);
  // The ledger month starts at the cutover in its first month; say so, as the Overview does.
  const since = today().startsWith(ledger.cutover.slice(0, 7))
    ? `since ${format(parseISO(ledger.cutover.slice(0, 10)), "d MMM")}`
    : "this month";

  return (
    <>
      <PageHeader
        title="Finance summary"
        purpose="The state of the money at a glance: what came in this month, what is owed and late, the cash on hand, and the trends behind them. Click any chart to enlarge it; click a bar or point to see the records behind it."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label={`Collected (${since})`} value={tt(month.payments)} note={`Payments recorded from clients ${since}.`} />
        <StatTile label="Outstanding" value={tt(owedToUs.total)} note={`Unpaid balance on ${owedToUs.count} sent invoices.`} tone="text-[#B45309]" />
        <StatTile label="Overdue" value={tt(split.overdue)} note={`${split.overdueCount} invoices past their due date.`} tone="text-[#B23A0A]" />
        <StatTile label="Business cash (safe)" value={tt(cash.business)} note={`Counted money in the safe. All money held: ${tt(cash.total)}.`} />
        <StatTile label={`Net (${since})`} value={tt(month.net)} note={`Collected, minus ${tt(month.expenses)} expenses and ${tt(month.payoutsPaidOut)} founder pay paid out.`} />
        <StatTile label="Monthly recurring revenue" value={tt(mrr(subscriptions))} note="What live retainers and subscriptions bring in each month." />
      </div>
      <FinanceCharts
        page="summary"
        invoices={invoices}
        expenses={expenses}
        projects={projects}
        clients={clients}
        subscriptions={subscriptions}
        history={history}
        ledger={ledger}
      />
    </>
  );
}
