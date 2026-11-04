import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClientById, getInvoices, getProjects, getClients, getLeads, getLedger, getSubscriptions } from "@/lib/db";
import { getClientActivity, getDealsForClient, listAttachments, listDocuments } from "@/lib/documents-db";
import { linksFor } from "@/lib/record-graph";
import { round2 } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";
import { getClientTimeline } from "@/lib/timeline-db";
import type { UnpaidInvoice } from "@/lib/timeline";
import { TimelineView } from "./timeline-view";
import { ClientRecords } from "@/components/dashboard/client-records";
import { ClientFile } from "./client-file";

export const dynamic = "force-dynamic";
// Covers the slow Claude call made by the Server Action on this page.
export const maxDuration = 60;

export default async function ClientTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  // A non-uuid segment would reach Postgres as a raw cast error (22P02) and render a 500.
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await getClientById(id);
  if (!client) notFound();

  const [projects, invoices, timeline, clients, leads, ledger, subscriptions, deals, docs, files, activity] = await Promise.all([
    getProjects(),
    getInvoices(),
    getClientTimeline(id),
    getClients(),
    getLeads(),
    getLedger(today()),
    getSubscriptions(),
    getDealsForClient(id),
    listDocuments({ clientId: id }),
    listAttachments("client", [id]),
    getClientActivity(id),
  ]);
  const r = linksFor("client", id, { clients, leads, projects, invoices });
  const invoiceIds = new Set(r.invoices.map((i) => i.id));
  const clientPayments = ledger.payments.filter((p) => invoiceIds.has(p.invoiceId));

  const unpaid: UnpaidInvoice[] = invoices
    .filter((i) => i.Client?.[0] === id && (i.Status === "Sent" || i.Status === "Overdue"))
    .map((i) => ({
      id: i.id,
      number: i["Invoice Number"] ?? "",
      balance: round2((i.Amount ?? 0) - (i["Paid So Far"] ?? 0)),
      dueOn: i["Due Date"] ?? null,
    }))
    .filter((i) => i.balance > 0);

  return (
    <TimelineView
      client={client}
      projects={projects.filter((p) => p.Client?.[0] === id)}
      entries={timeline.entries}
      promises={timeline.promises}
      invoices={unpaid}
      today={today()}
      linked={
        <>
          <ClientRecords clientId={id} graph={{ clients, leads, projects, invoices }} payments={ledger.payments} cutover={ledger.cutover} />
          <ClientFile
            client={client}
            projects={r.projects}
            invoices={r.invoices}
            payments={clientPayments}
            cutover={ledger.cutover}
            subscriptions={subscriptions.filter((s) => s.Client?.[0] === id)}
            deals={deals}
            docs={docs}
            files={files}
            activity={activity}
          />
        </>
      }
    />
  );
}
