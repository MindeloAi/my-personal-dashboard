import { requireAdminPage } from "@/lib/auth";
import { getExpenses, getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { ExpensesView } from "./expenses-view";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpensesPage() {
  await requireAdminPage();
  const [expenses, ledger] = await Promise.all([getExpenses(), getLedger(today())]);
  return (
    <>
      <PageHeader title="Expenses" purpose="Everything the business has spent, by category, and what still needs reimbursing." />
      <ExpensesView expenses={expenses} cutover={ledger.cutover} />
    </>
  );
}
