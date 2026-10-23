import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getClientById, getInvoices, getProjects } from "@/lib/db";
import { round2 } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";
import { getClientTimeline } from "@/lib/timeline-db";
import type { UnpaidInvoice } from "@/lib/timeline";
import { TimelineView } from "./timeline-view";

export const dynamic = "force-dynamic";
// Covers the slow Claude call made by the Server Action on this page.
export const maxDuration = 60;

export default async function ClientTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  const client = await getClientById(id);
  if (!client) notFound();

  const [projects, invoices, timeline] = await Promise.all([
    getProjects(),
    getInvoices(),
    getClientTimeline(id),
  ]);

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
    />
  );
}
