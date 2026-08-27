import { format } from "date-fns";
import { Sidebar } from "@/components/dashboard/sidebar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getClients, getProjects } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Quick Actions' create-invoice / create-project modals need these lists on
  // every page. Two queries per page rather than the eight the single-page
  // dashboard used to run.
  const [clients, projects] = await Promise.all([getClients(), getProjects()]);
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <Sidebar>
        <div className="p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
            <div>
              <p className="text-xl font-bold text-[#f5f5f5]">MindeloAI Dashboard</p>
              <p className="text-xs text-zinc-500 mt-0.5">{today}</p>
            </div>
            <QuickActions clients={clients} projects={projects} />
          </div>
          {children}
        </div>
      </Sidebar>
    </div>
  );
}
