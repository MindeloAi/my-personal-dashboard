import type { Metadata } from "next";
import { format } from "date-fns";
import { Sidebar } from "@/components/dashboard/sidebar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getClients, getProjects } from "@/lib/db";
import { getAdmin } from "@/lib/auth";

// Never index the dashboard. There is deliberately no link to /admin from the
// public site, but a stray referrer or a shared URL would otherwise be enough
// for a crawler to find it. /admin is also excluded from sitemap.ts.
export const metadata: Metadata = {
  title: "Mindelo Dashboard",
  robots: { index: false, follow: false, nocache: true },
};

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
  const [clients, projects, admin] = await Promise.all([
    getClients(),
    getProjects(),
    getAdmin(),
  ]);
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <Sidebar adminEmail={admin?.email}>
        <div className="p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
            <div>
              <p className="text-xl font-bold text-[#f5f5f5]">Mindelo Dashboard</p>
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
