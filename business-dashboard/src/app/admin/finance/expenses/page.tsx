import { requireAdminPage } from "@/lib/auth";
import { getExpenses, getLedger, getFinanceHistory } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { listAttachments } from "@/lib/documents-db";
import { ExpensesView } from "./expenses-view";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpensesPage() {
  await requireAdminPage();
  const [expenses, ledger, history] = await Promise.all([getExpenses(), getLedger(today()), getFinanceHistory(today())]);
  const withFiles = [...new Set((await listAttachments("expense", expenses.map((e) => e.id))).map((a) => a.entityId))];
  return (
    <>
      <PageHeader title="Expenses" purpose="Everything the business has spent, by category, and what still needs reimbursing. Open an expense to attach its receipt." />
      <ExpensesView expenses={expenses} cutover={ledger.cutover} withFiles={withFiles} />
      <FinanceCharts page="expenses" history={history} ledger={ledger} expenses={expenses} />
    </>
  );
}
