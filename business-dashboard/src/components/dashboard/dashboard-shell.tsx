"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { MrrCard } from "@/components/dashboard/mrr-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { BusinessCounters } from "@/components/dashboard/business-counters";
import { ServiceTypeSplit } from "@/components/dashboard/service-type-split";
import { ExpensesBreakdown } from "@/components/dashboard/expenses-breakdown";
import { ProjectBoard } from "@/components/dashboard/project-board";
import { InvoicesTable, type InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { Cashflow } from "@/components/dashboard/cashflow";
import { TopClients } from "@/components/dashboard/top-clients";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ExpensesList } from "@/components/dashboard/expenses-list";
import { Section } from "@/components/dashboard/section";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { IdeasPanel } from "@/components/dashboard/ideas-panel";
import { AutomationLauncher } from "@/components/dashboard/automation-launcher";
import type { Client, Project, Invoice, Expense, Lead, Task, Idea } from "@/lib/airtable";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  leads: Lead[];
  tasks: Task[];
  ideas: Idea[];
  // DevHub is an async Server Component that fetches its own GitHub/Airtable
  // data, so it can't be imported into this client tree — page.tsx renders it
  // and passes the element down.
  devHub: React.ReactNode;
};

export function DashboardShell({
  clients,
  projects,
  invoices,
  expenses,
  leads,
  tasks,
  ideas,
  devHub,
}: Props) {
  const [expenseCategory, setExpenseCategory] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>("All");
  const [invoiceClient, setInvoiceClient] = useState<string | null>(null);

  const today = format(new Date(), "EEEE, MMMM d");

  const jumpToOverdue = useCallback(() => {
    setInvoiceStatus("Overdue");
    requestAnimationFrame(() => {
      document.getElementById("invoices")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const selectedClient = invoiceClient ? clients.find((c) => c.id === invoiceClient) : null;
  const selectedClientName = selectedClient?.Company || selectedClient?.Name || null;

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
        <div>
          <p className="text-xl font-bold text-[#f5f5f5]">MindeloAI Dashboard</p>
          <p className="text-xs text-zinc-500 mt-0.5">{today}</p>
        </div>
        <QuickActions clients={clients} projects={projects} />
      </div>

      {/* Row 1: Hero cards */}
      <div id="finance" className="scroll-mt-4">
        <HeroCards invoices={invoices} expenses={expenses} />
      </div>

      {/* Row 2: Revenue chart + counters + service mix + MRR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RevenueChart invoices={invoices} expenses={expenses} />
        <BusinessCounters clients={clients} projects={projects} invoices={invoices} onJumpToOverdue={jumpToOverdue} />
        <div className="grid grid-cols-1 gap-3">
          <MrrCard projects={projects} invoices={invoices} />
          <ServiceTypeSplit projects={projects} invoices={invoices} />
        </div>
      </div>

      {/* Row 3: Project board */}
      <div id="projects" className="scroll-mt-4">
        <ProjectBoard projects={projects} clients={clients} />
      </div>

      {/* Row 4: Invoices + cashflow + top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <InvoicesTable
            invoices={invoices}
            projects={projects}
            statusFilter={invoiceStatus}
            onStatusFilterChange={setInvoiceStatus}
            clientFilter={invoiceClient}
            onClearClientFilter={() => setInvoiceClient(null)}
            clientName={selectedClientName}
          />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Cashflow invoices={invoices} projects={projects} />
          <div id="clients" className="scroll-mt-4">
            <TopClients
              clients={clients}
              invoices={invoices}
              projects={projects}
              selectedClientId={invoiceClient}
              onSelectClient={setInvoiceClient}
            />
          </div>
        </div>
      </div>

      {/* Row 5: Expenses breakdown + list */}
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

      {/* Row 6: Leads / Sales */}
      <Section id="leads" title="Leads" description="Inbound and tracked sales pipeline.">
        <LeadsTable leads={leads} />
      </Section>

      {/* Row 7: Task board + Business ideas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section id="tasks" title="Tasks" description="Work queue shared with the Claude-Code bridge.">
          <TasksPanel tasks={tasks} projects={projects} />
        </Section>
        <Section id="ideas" title="Ideas" description="Business ideas backlog.">
          <IdeasPanel ideas={ideas} />
        </Section>
      </div>

      {/* Row 8: Dev hub (server-rendered) */}
      <Section id="dev" title="Dev" description="Repos, live deploy links, and coding-task queue.">
        {devHub}
      </Section>

      {/* Row 9: Automation launcher */}
      <Section id="automation" title="Automation" description="One-click workflows and invoice generation.">
        <AutomationLauncher projects={projects} leads={leads} />
      </Section>
    </div>
  );
}
