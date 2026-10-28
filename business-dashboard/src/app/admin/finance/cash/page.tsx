import { requireAdminPage } from "@/lib/auth";
import { getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { CashPanel } from "@/components/dashboard/cash-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashPage() {
  await requireAdminPage();
  return <CashPanel ledger={await getLedger(today())} />;
}
