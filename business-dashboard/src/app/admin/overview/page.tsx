import { requireAdminPage } from "@/lib/auth";
import {
  getClients,
  getProjects,
  getInvoices,
  getExpenses,
  getSubscriptions,
  getLedger,
  getLeads,
} from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { OverviewView } from "./overview-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverviewPage() {
  await requireAdminPage();
  const [clients, projects, invoices, expenses, subscriptions, leads, ledger] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getSubscriptions(),
    getLeads(),
    getLedger(today()),
  ]);

  return (
    <OverviewView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      subscriptions={subscriptions}
      leads={leads}
      ledger={ledger}
    />
  );
}
