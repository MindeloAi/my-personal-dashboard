import { requireAdminPage } from "@/lib/auth";
import { getExpenses, getLedger, getFinanceHistory } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { ExpensesView } from "./expenses-view";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpensesPage() {
  await requireAdminPage();
  const [expenses, ledger, history] = await Promise.all([getExpenses(), getLedger(today()), getFinanceHistory()]);
  return (
    <>
      <PageHeader title="Expenses" purpose="Everything the business has spent, by category, and what still needs reimbursing." />
      <ExpensesView expenses={expenses} cutover={ledger.cutover} />
      <FinanceCharts page="expenses" history={history} ledger={ledger} expenses={expenses} />
    </>
  );
}
