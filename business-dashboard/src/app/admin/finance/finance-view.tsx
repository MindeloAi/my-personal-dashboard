"use client";

import { useState } from "react";
import { InvoicesTable, type InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { Cashflow } from "@/components/dashboard/cashflow";
import { ExpensesBreakdown } from "@/components/dashboard/expenses-breakdown";
import { ExpensesList } from "@/components/dashboard/expenses-list";
import { SubscriptionsList } from "@/components/dashboard/subscriptions-list";
import type { Client, Project, Invoice, Expense, Subscription } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  subscriptions: Subscription[];
  initialStatus: InvoiceStatusFilter;
  initialClientId: string | null;
};

export function FinanceView({
  clients,
  projects,
  invoices,
  expenses,
  subscriptions,
  initialStatus,
  initialClientId,
}: Props) {
  const [expenseCategory, setExpenseCategory] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>(initialStatus);
  const [invoiceClient, setInvoiceClient] = useState<string | null>(initialClientId);

  const selectedClient = invoiceClient ? clients.find((c) => c.id === invoiceClient) : null;
  const selectedClientName = selectedClient?.Company || selectedClient?.Name || null;

  return (
    <>
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
          />
        </div>
        <Cashflow invoices={invoices} projects={projects} subscriptions={subscriptions} />
      </div>

      <SubscriptionsList
        subscriptions={subscriptions}
        invoices={invoices}
        clients={clients}
        projects={projects}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ExpensesBreakdown
          expenses={expenses}
          selectedCategory={expenseCategory}
          onSelectCategory={setExpenseCategory}
        />
        <div className="lg:col-span-2">
          <ExpensesList
            expenses={expenses}
            categoryFilter={expenseCategory}
            onClearCategoryFilter={() => setExpenseCategory(null)}
          />
        </div>
      </div>
    </>
  );
}
