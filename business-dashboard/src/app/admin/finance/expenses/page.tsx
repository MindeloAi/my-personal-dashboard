import { requireAdminPage } from "@/lib/auth";
import { getExpenses, getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { ExpensesView } from "./expenses-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpensesPage() {
  await requireAdminPage();
  const [expenses, ledger] = await Promise.all([getExpenses(), getLedger(today())]);
  return <ExpensesView expenses={expenses} cutover={ledger.cutover} />;
}
