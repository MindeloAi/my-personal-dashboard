import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getSubscriptions, getLedger } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import type { InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { InvoicesView } from "./invoices-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Verified against invoices-table.tsx:11 — this union has no "Void" member,
// even though the Invoice schema has a Void status.
const STATUSES: InvoiceStatusFilter[] = ["All", "Sent", "Overdue", "Paid", "Draft"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string }>;
}) {
  const { status, client } = await searchParams;

  await requireAdminPage();
  const [clients, projects, invoices, subscriptions, ledger] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getSubscriptions(),
    getLedger(today()),
  ]);

  const initialStatus = STATUSES.includes(status as InvoiceStatusFilter)
    ? (status as InvoiceStatusFilter)
    : "All";

  return (
    <InvoicesView
      clients={clients}
      projects={projects}
      invoices={invoices}
      subscriptions={subscriptions}
      ledger={ledger}
      initialStatus={initialStatus}
      initialClientId={client ?? null}
    />
  );
}
