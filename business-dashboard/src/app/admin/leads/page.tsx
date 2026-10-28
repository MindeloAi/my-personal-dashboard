import { requireAdminPage } from "@/lib/auth";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads, getClients } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  await requireAdminPage();
  // clients is needed by the Won→client conversion's duplicate check.
  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  return (
    <>
      <PageHeader title="Leads" purpose="Everyone who has shown interest in working with Mindelo, and where each one is in the sales pipeline." />
      <LeadsTable leads={leads} clients={clients} />
    </>
  );
}
