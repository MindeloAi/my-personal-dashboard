import { requireAdminPage } from "@/lib/auth";
import { getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { MoneyReceived } from "@/components/dashboard/money-received";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneyReceivedPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Money received" purpose="Every payment collected from clients, who has the money now, and the steps left to sort it into the safe and founder pay." />
      <MoneyReceived ledger={await getLedger(today())} />
    </>
  );
}
