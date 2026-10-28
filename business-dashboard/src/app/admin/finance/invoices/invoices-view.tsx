"use client";

import { useState } from "react";
import { InvoicesTable, type InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { Cashflow } from "@/components/dashboard/cashflow";
import type { Client, Project, Invoice, Subscription, Ledger } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  ledger: Ledger;
  initialStatus: InvoiceStatusFilter;
  initialClientId: string | null;
};

export function InvoicesView({
  clients,
  projects,
  invoices,
  subscriptions,
  ledger,
  initialStatus,
  initialClientId,
}: Props) {
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>(initialStatus);
  const [invoiceClient, setInvoiceClient] = useState<string | null>(initialClientId);

  const selectedClient = invoiceClient ? clients.find((c) => c.id === invoiceClient) : null;
  const selectedClientName = selectedClient?.Company || selectedClient?.Name || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2">
        <InvoicesTable
          invoices={invoices}
          projects={projects}
          subscriptions={subscriptions}
          statusFilter={invoiceStatus}
          onStatusFilterChange={setInvoiceStatus}
          clientFilter={invoiceClient}
          onClearClientFilter={() => setInvoiceClient(null)}
          clientName={selectedClientName}
          ledger={ledger}
        />
      </div>
      <Cashflow invoices={invoices} projects={projects} subscriptions={subscriptions} />
    </div>
  );
}
