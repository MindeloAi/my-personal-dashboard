import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getProjects } from "@/lib/db";
import { ClientsView } from "./clients-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientsPage() {
  await requireAdminPage();
  const [clients, invoices, projects] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
  ]);
  return <ClientsView clients={clients} invoices={invoices} projects={projects} />;
}
