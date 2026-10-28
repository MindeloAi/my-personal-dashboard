import { requireAdminPage } from "@/lib/auth";
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients, getLeads } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  await requireAdminPage();
  const [projects, clients, leads] = await Promise.all([getProjects(), getClients(), getLeads()]);
  return (
    <>
      <PageHeader title="All projects" purpose="Every project, client and internal, by stage from lead to done." />
      <ProjectBoard projects={projects} clients={clients} leads={leads} initialClientId={client ?? null} />
    </>
  );
}
