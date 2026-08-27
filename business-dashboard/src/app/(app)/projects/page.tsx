import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([getProjects(), getClients()]);
  return <ProjectBoard projects={projects} clients={clients} />;
}
