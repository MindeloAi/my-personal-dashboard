import { Section } from "@/components/dashboard/section";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { getTasks, getProjects } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
  return (
    <Section title="Tasks" description="Work queue shared with the Claude-Code bridge.">
      <TasksPanel tasks={tasks} projects={projects} />
    </Section>
  );
}
