import { requireAdminPage } from "@/lib/auth";
import { getLedger, getFinanceHistory } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { FounderPay } from "@/components/dashboard/founder-pay";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FounderPayPage() {
  await requireAdminPage();
  const [ledger, history] = await Promise.all([getLedger(today()), getFinanceHistory(today())]);
  return (
    <>
      <PageHeader title="Founder pay" purpose="What Michael and Zane have earned from collected payments, what is still due to them, and what unpaid invoices will add." />
      <FounderPay ledger={ledger} />
      <FinanceCharts page="founder-pay" history={history} ledger={ledger} />
    </>
  );
}
