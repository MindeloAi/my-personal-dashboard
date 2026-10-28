import { requireAdminPage } from "@/lib/auth";
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients, getLeads, getInvoices } from "@/lib/db";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { PageCharts } from "@/components/dashboard/page-charts";
import { tt } from "@/lib/ledger";
import { projectsSummary } from "@/lib/pages-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  await requireAdminPage();
  const [projects, clients, leads, invoices] = await Promise.all([getProjects(), getClients(), getLeads(), getInvoices()]);
  const s = projectsSummary(projects);
  return (
    <>
      <PageHeader title="All projects" purpose="Every project, client and internal, by stage from lead to done." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="In progress" value={String(s.inProgress)} note="Projects being built now." />
        <StatTile label="In review" value={String(s.inReview)} note="Built and waiting on the client's sign-off." />
        <StatTile label="Value of active work" value={tt(s.activeValue)} note="Total value of projects in progress or in review." />
      </div>
      <ProjectBoard projects={projects} clients={clients} leads={leads} invoices={invoices} initialClientId={client ?? null} />
      <PageCharts page="projects" projects={projects} clients={clients} />
    </>
  );
}
