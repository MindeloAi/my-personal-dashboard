import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getSubscriptions, getLedger, getFinanceHistory } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { SubscriptionsList } from "@/components/dashboard/subscriptions-list";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecurringPage() {
  await requireAdminPage();
  const [subscriptions, invoices, clients, projects, ledger, history] = await Promise.all([
    getSubscriptions(),
    getInvoices(),
    getClients(),
    getProjects(),
    getLedger(today()),
    getFinanceHistory(),
  ]);
  return (
    <>
      <PageHeader title="Recurring" purpose="Retainers and subscriptions that bill clients on a schedule, and the invoices they are due to raise." />
      <SubscriptionsList subscriptions={subscriptions} invoices={invoices} clients={clients} projects={projects} />
      <FinanceCharts page="recurring" history={history} ledger={ledger} subscriptions={subscriptions} invoices={invoices} clients={clients} projects={projects} />
    </>
  );
}
