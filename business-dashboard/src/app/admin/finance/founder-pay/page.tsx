import { requireAdminPage } from "@/lib/auth";
import { getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { FounderPay } from "@/components/dashboard/founder-pay";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FounderPayPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Founder pay" purpose="What Michael and Zane have earned from collected payments, what is still due to them, and what unpaid invoices will add." />
      <FounderPay ledger={await getLedger(today())} />
    </>
  );
}
