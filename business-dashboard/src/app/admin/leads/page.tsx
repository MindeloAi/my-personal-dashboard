import { requireAdminPage } from "@/lib/auth";
import { Section } from "@/components/dashboard/section";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads, getClients } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  await requireAdminPage();
  // clients is needed by the Won→client conversion's duplicate check.
  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  return (
    <Section title="Leads" description="Inbound and tracked sales pipeline.">
      <LeadsTable leads={leads} clients={clients} />
    </Section>
  );
}
