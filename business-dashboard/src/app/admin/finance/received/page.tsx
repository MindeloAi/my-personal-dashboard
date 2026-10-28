import { requireAdminPage } from "@/lib/auth";
import { getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { MoneyReceived } from "@/components/dashboard/money-received";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneyReceivedPage() {
  await requireAdminPage();
  return <MoneyReceived ledger={await getLedger(today())} />;
}
