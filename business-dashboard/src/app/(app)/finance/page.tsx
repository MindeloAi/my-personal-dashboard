import { getClients, getProjects, getInvoices, getExpenses } from "@/lib/db";
import type { InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { FinanceView } from "./finance-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Verified against invoices-table.tsx:11 — this union has no "Void" member,
// even though the Invoice schema has a Void status.
const STATUSES: InvoiceStatusFilter[] = ["All", "Sent", "Overdue", "Paid", "Draft"];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string }>;
}) {
  const { status, client } = await searchParams;

  const [clients, projects, invoices, expenses] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
  ]);

  const initialStatus = STATUSES.includes(status as InvoiceStatusFilter)
    ? (status as InvoiceStatusFilter)
    : "All";

  return (
    <FinanceView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      initialStatus={initialStatus}
      initialClientId={client ?? null}
    />
  );
}
