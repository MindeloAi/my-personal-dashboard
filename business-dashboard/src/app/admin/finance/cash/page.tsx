import { requireAdminPage } from "@/lib/auth";
import { getLedger, getFinanceHistory } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { CashPanel } from "@/components/dashboard/cash-panel";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashPage() {
  await requireAdminPage();
  const [ledger, history] = await Promise.all([getLedger(today()), getFinanceHistory()]);
  return (
    <>
      <PageHeader title="Cash & safe" purpose="Where the business's money physically is right now, the transfers between people and the safe, and the last cash counts." />
      <CashPanel ledger={ledger} />
      <FinanceCharts page="cash" history={history} ledger={ledger} />
    </>
  );
}
