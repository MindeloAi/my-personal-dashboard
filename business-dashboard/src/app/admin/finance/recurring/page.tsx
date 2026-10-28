import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getSubscriptions } from "@/lib/db";
import { SubscriptionsList } from "@/components/dashboard/subscriptions-list";
import { PageHeader } from "@/components/dashboard/explain";

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
  return (
    <>
      <PageHeader title="Recurring" purpose="Retainers and subscriptions that bill clients on a schedule, and the invoices they are due to raise." />
      <SubscriptionsList subscriptions={subscriptions} invoices={invoices} clients={clients} projects={projects} />
    </>
  );
}
