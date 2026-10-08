import { requireAdminPage } from "@/lib/auth";
import {
  getClients,
  getProjects,
  getInvoices,
  getExpenses,
  getSubscriptions,
} from "@/lib/db";
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

  await requireAdminPage();
  const [clients, projects, invoices, expenses, subscriptions] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getSubscriptions(),
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
      subscriptions={subscriptions}
      initialStatus={initialStatus}
      initialClientId={client ?? null}
    />
  );
}
