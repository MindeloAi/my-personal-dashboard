import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getSubscriptions, getLedger, getFinanceHistory, getLeads } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import type { InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { InvoicesView } from "./invoices-view";
import { PageHeader } from "@/components/dashboard/explain";
import { FinanceCharts } from "@/components/dashboard/finance-charts";

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
  const [clients, projects, invoices, subscriptions, ledger, history, leads] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getSubscriptions(),
    getLedger(today()),
    getFinanceHistory(today()),
    getLeads(),
  ]);

  const initialStatus = STATUSES.includes(status as InvoiceStatusFilter)
    ? (status as InvoiceStatusFilter)
    : "All";

  return (
    <>
      <PageHeader title="Invoices" purpose="Every invoice issued to clients, what is still owed, and the cash expected in over the next 30 days." />
      <InvoicesView
      clients={clients}
      projects={projects}
      invoices={invoices}
      subscriptions={subscriptions}
      ledger={ledger}
      leads={leads}
      initialStatus={initialStatus}
      initialClientId={client ?? null}
    />
      <FinanceCharts page="invoices" history={history} ledger={ledger} invoices={invoices} clients={clients} projects={projects} />
    </>
  );
}
