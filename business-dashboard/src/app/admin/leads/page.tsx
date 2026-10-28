import { requireAdminPage } from "@/lib/auth";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads, getClients } from "@/lib/db";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { PageCharts } from "@/components/dashboard/page-charts";
import { today } from "@/lib/subscriptions";
import { leadsSummary } from "@/lib/pages-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  await requireAdminPage();
  // clients is needed by the Won→client conversion's duplicate check.
  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  const s = leadsSummary(leads, today());
  return (
    <>
      <PageHeader title="Leads" purpose="Everyone who has shown interest in working with Mindelo, and where each one is in the sales pipeline." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open leads" value={String(s.open)} note="New, contacted or with a proposal out." />
        <StatTile label="Won" value={String(s.won)} note="Leads won so far. The dashboard does not record when a lead was won." />
        <StatTile label="Win rate" value={`${Math.round(s.winRate)}%`} note="Won out of every lead decided (won or lost)." />
        <StatTile label="Follow-ups due" value={String(s.followUps)} note="Open leads whose follow-up date has arrived." tone={s.followUps ? "text-[#B45309]" : undefined} />
      </div>
      <LeadsTable leads={leads} clients={clients} />
      <PageCharts page="leads" leads={leads} />
    </>
  );
}
