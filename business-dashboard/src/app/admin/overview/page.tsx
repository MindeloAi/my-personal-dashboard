import {
  getClients,
  getProjects,
  getInvoices,
  getExpenses,
  getSubscriptions,
} from "@/lib/db";
import { OverviewView } from "./overview-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverviewPage() {
  const [clients, projects, invoices, expenses, subscriptions] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getSubscriptions(),
  ]);

  return (
    <OverviewView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      subscriptions={subscriptions}
    />
  );
}
