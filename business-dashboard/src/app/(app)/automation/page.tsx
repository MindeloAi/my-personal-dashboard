import { Section } from "@/components/dashboard/section";
import { AutomationLauncher } from "@/components/dashboard/automation-launcher";
import { getProjects, getLeads } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AutomationPage() {
  const [projects, leads] = await Promise.all([getProjects(), getLeads()]);
  return (
    <Section title="Automation" description="One-click workflows and invoice generation.">
      <AutomationLauncher projects={projects} leads={leads} />
    </Section>
  );
}
