import { Section } from "@/components/dashboard/section";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  const leads = await getLeads();
  return (
    <Section title="Leads" description="Inbound and tracked sales pipeline.">
      <LeadsTable leads={leads} />
    </Section>
  );
}
