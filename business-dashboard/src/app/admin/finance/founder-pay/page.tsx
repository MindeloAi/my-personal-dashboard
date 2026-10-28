import { requireAdminPage } from "@/lib/auth";
import { getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { FounderPay } from "@/components/dashboard/founder-pay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FounderPayPage() {
  await requireAdminPage();
  return <FounderPay ledger={await getLedger(today())} />;
}
