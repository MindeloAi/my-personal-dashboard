import { requireAdminPage } from "@/lib/auth";
import { getLedger, getFinanceHistory, getInvoices, getClients, getProjects } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { MoneyReceived } from "@/components/dashboard/money-received";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneyReceivedPage() {
  await requireAdminPage();
  const [ledger, history, invoices, clients, projects] = await Promise.all([
    getLedger(today()), getFinanceHistory(), getInvoices(), getClients(), getProjects(),
  ]);
  return (
    <>
      <PageHeader title="Money received" purpose="Every payment collected from clients, who has the money now, and the steps left to sort it into the safe and founder pay." />
      <MoneyReceived ledger={ledger} />
      <FinanceCharts page="received" history={history} ledger={ledger} invoices={invoices} clients={clients} projects={projects} />
    </>
  );
}
