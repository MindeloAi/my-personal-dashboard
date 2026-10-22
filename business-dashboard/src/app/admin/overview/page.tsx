import { requireAdminPage } from "@/lib/auth";
import {
  getClients,
  getProjects,
  getInvoices,
  getExpenses,
  getSubscriptions,
  getLedger,
} from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { OverviewView } from "./overview-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverviewPage() {
  await requireAdminPage();
  const [clients, projects, invoices, expenses, subscriptions, ledger] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getSubscriptions(),
    getLedger(today()),
  ]);

  return (
    <OverviewView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      subscriptions={subscriptions}
      ledger={ledger}
    />
  );
}
