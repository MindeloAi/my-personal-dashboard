import { requireAdminPage } from "@/lib/auth";
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients, getLeads, getInvoices } from "@/lib/db";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { PageCharts } from "@/components/dashboard/page-charts";
import { tt } from "@/lib/ledger";
import { projectsSummary } from "@/lib/pages-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Mindelo's own products (Cruz, CariPromos): projects with no client or lead behind them. */
export default async function InternalProjectsPage() {
  await requireAdminPage();
  const [projects, clients, leads, invoices] = await Promise.all([getProjects(), getClients(), getLeads(), getInvoices()]);
  const s = projectsSummary(projects.filter((p) => p.Internal));
  return (
    <>
      <PageHeader title="Internal projects" purpose="Mindelo's own products, such as Cruz and CariPromos, that have no client behind them." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="In progress" value={String(s.inProgress)} note="Projects being built now." />
        <StatTile label="In review" value={String(s.inReview)} note="Built and waiting on the client's sign-off." />
        <StatTile label="Value of active work" value={tt(s.activeValue)} note="Total value of projects in progress or in review." />
      </div>
      <ProjectBoard projects={projects.filter((p) => p.Internal)} clients={clients} leads={leads} invoices={invoices} />
      <PageCharts page="projects" projects={projects.filter((p) => p.Internal)} clients={clients} />
    </>
  );
}
