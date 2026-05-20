import {
  getInvoices,
  getProjects,
  getExpenses,
  getClients,
  getLeads,
  getTasks,
  getIdeas,
  MissingAirtableEnvError,
} from "@/lib/airtable";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DevHub } from "@/components/dashboard/dev-hub";

// Always render at request time. Dashboard data is live; never snapshot at build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  let invoices, projects, expenses, clients, leads, tasks, ideas;
  try {
    [invoices, projects, expenses, clients, leads, tasks, ideas] =
      await Promise.all([
        getInvoices(),
        getProjects(),
        getExpenses(),
        getClients(),
        getLeads(),
        getTasks(),
        getIdeas(),
      ]);
  } catch (err) {
    if (err instanceof MissingAirtableEnvError) {
      return (
        <div className="p-10 max-w-xl mx-auto text-center text-sm text-zinc-300">
          <p className="text-base font-semibold text-[#fbbf24] mb-2">
            Airtable env vars are missing
          </p>
          <p className="text-zinc-400">{err.message}</p>
        </div>
      );
    }
    return (
      <div className="p-10 text-center text-[#ff4d8b] text-sm">
        Failed to load dashboard data. Check the server logs for the underlying error.
      </div>
    );
  }

  return (
    <DashboardShell
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      leads={leads}
      tasks={tasks}
      ideas={ideas}
      devHub={<DevHub />}
    />
  );
}
