import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getSubscriptions } from "@/lib/db";
import { SubscriptionsList } from "@/components/dashboard/subscriptions-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecurringPage() {
  await requireAdminPage();
  const [subscriptions, invoices, clients, projects] = await Promise.all([
    getSubscriptions(),
    getInvoices(),
    getClients(),
    getProjects(),
  ]);
  return <SubscriptionsList subscriptions={subscriptions} invoices={invoices} clients={clients} projects={projects} />;
}
