import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/sidebar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getClients, getProjects } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";

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
    requireAdminPage(),
  ]);
  // Trinidad's date, not the server's: Vercel runs in UTC, which showed
  // tomorrow from 8pm onwards.
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Port_of_Spain",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <Sidebar adminEmail={admin.email}>
        <div className="p-3 sm:p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
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
