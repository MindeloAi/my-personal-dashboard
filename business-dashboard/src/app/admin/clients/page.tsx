import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getProjects } from "@/lib/db";
import { getTimelineCounts } from "@/lib/timeline-db";
import { ClientsView } from "./clients-view";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientsPage() {
  await requireAdminPage();
  const [clients, invoices, projects, timelineCounts] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
    getTimelineCounts(),
  ]);
  return (
    <>
      <PageHeader title="Clients" purpose="Every client, who pays the most, and a way into each client's full history." />
      <ClientsView
      clients={clients}
      invoices={invoices}
      projects={projects}
      timelineCounts={timelineCounts}
    />
    </>
  );
}
