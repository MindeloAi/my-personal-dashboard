import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getProjects } from "@/lib/db";
import { getTimelineCounts } from "@/lib/timeline-db";
import { ClientsView } from "./clients-view";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { PageCharts } from "@/components/dashboard/page-charts";
import { today } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import { clientsSummary } from "@/lib/pages-data";
import { owedSplit } from "@/lib/overview-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientsPage() {
  await requireAdminPage();
  const [clients, invoices, projects, timelineCounts] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
    getTimelineCounts(),
  ]);
  const s = clientsSummary(clients, invoices, projects, today());
  const owed = owedSplit(invoices);
  return (
    <>
      <PageHeader title="Clients" purpose="Every client, who pays the most, and a way into each client's full history." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active clients" value={String(s.active)} note="Clients marked Active: being worked for or billed now." />
        <StatTile label="Total earned" value={tt(s.earned)} note={`Paid invoices from ${s.paying} clients since the business started.`} />
        <StatTile label="Average per client" value={tt(s.average)} note="Total earned divided by the clients who have paid." />
        <StatTile label="Owed to us" value={tt(owed.overdue + owed.notDue)} note={`Unpaid on sent invoices; ${tt(owed.overdue)} of it overdue.`} tone="text-[#B45309]" />
      </div>
      <ClientsView
      clients={clients}
      invoices={invoices}
      projects={projects}
      timelineCounts={timelineCounts}
    />
      <PageCharts page="clients" clients={clients} invoices={invoices} projects={projects} />
    </>
  );
}
