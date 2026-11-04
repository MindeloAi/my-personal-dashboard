// The client file: money summary, charts, deals, documents, files and activity
// for one client. Server-safe (no "use client"); the charts are client components.
import Link from "next/link";
import type { Client, Invoice, Project, Subscription } from "@/lib/db";
import type { Activity, Attachment, Deal, Doc } from "@/lib/documents-db";
import { clientMoney } from "@/lib/client-data";
import { isLive, monthlyAmount } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import { href } from "@/lib/record-graph";
import { StatTile } from "@/components/dashboard/explain";
import { Donut, SeriesChart } from "@/components/dashboard/chart-kit";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";

type Pay = { invoiceId: string; amount: number; paidAt: string };

export function ClientFile({ client, projects, invoices, payments, cutover, subscriptions, deals, docs, files, activity }: {
  client: Client; projects: Project[]; invoices: Invoice[]; payments: Pay[]; cutover: string;
  subscriptions: Subscription[]; deals: Deal[]; docs: Doc[]; files: Attachment[]; activity: Activity[];
}) {
  const m = clientMoney({ projects, invoices, payments, cutover });
  const care = subscriptions.filter((s) => isLive(s)).reduce((sum, s) => sum + monthlyAmount(s), 0);
  const names: Record<string, string> = Object.fromEntries(projects.map((p) => [p.id, p.Name]));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Client since" value={client.Created?.slice(0, 10) ?? "Not recorded"} note="When they were added." />
        <StatTile label="Billed" value={tt(m.billed)} note="Every invoice issued, drafts and voids left out." />
        <StatTile label="Paid" value={tt(m.paid)} note="Everything received from them." tone="text-[#1E6B3A]" />
        <StatTile label="Still owed" value={tt(m.owed)} note="Billed but not yet received." tone={m.owed > 0 ? "text-[#B23A0A]" : undefined} />
        <StatTile label="Care plan a month" value={tt(care)} note="Their live recurring plans, as a monthly figure." />
        <StatTile label="Days to pay" value={m.avgDaysToPay == null ? "No data" : String(m.avgDaysToPay)} note="Average from issue to paid in full." />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Donut title="Billed: paid and still owed" description="How much of what we billed them has come in." data={[{ name: "Paid", value: m.paid }, { name: "Still owed", value: m.owed }]} centre={tt(m.billed)} colors={{ Paid: "#1E6B3A", "Still owed": "#B23A0A" }} />
        <SeriesChart title="Money received by month" description="Payments from this client, by the month they arrived." rows={m.byMonth} series={[{ key: "paid", name: "Received" }]} kind="bar" labelHeader="Month" />
        <Donut title="Paid by project" description="Which projects their payments were for." data={m.byProject} centre={tt(m.paid)} />
      </div>
      <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Deals</h2>
        <p className="mt-0.5 text-xs text-[#4A5568]">What we offered on each project. Open a project to change its deal.</p>
        {deals.length === 0 ? <p className="mt-3 text-sm text-[#6B7789]">No deals recorded yet.</p> : (
          <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{d.reference}</strong>{d.projectId && <> · <Link className="font-medium text-[#1D4ED8] hover:underline" href={href.project(d.projectId)}>{names[d.projectId] ?? "Project"}</Link></>}</span>
                <span className="text-[#5A6678]">{d.priceTotal != null ? tt(d.priceTotal) : "No price"}{d.deadline ? ` · due ${d.deadline}` : ""}{d.carePlan ? ` · care ${tt(d.carePlan.monthlyAmount)}/mo` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Documents</h2>
          <Link className="text-xs font-medium text-[#1D4ED8] hover:underline" href={`/admin/documents?client=${encodeURIComponent(client.id)}`}>All documents for this client</Link>
        </div>
        <DocumentsTable docs={docs} names={names} showClient={false} />
      </section>
      <FilesPanel entityType="client" entityId={client.id} files={files} />
      <ActivityList items={activity} />
    </>
  );
}
