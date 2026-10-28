import { requireAdminPage } from "@/lib/auth";
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients, getLeads } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Mindelo's own products (Cruz, CariPromos): projects with no client or lead behind them. */
export default async function InternalProjectsPage() {
  await requireAdminPage();
  const [projects, clients, leads] = await Promise.all([getProjects(), getClients(), getLeads()]);
  return <ProjectBoard projects={projects.filter((p) => p.Internal)} clients={clients} leads={leads} />;
}
