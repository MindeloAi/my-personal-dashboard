import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects, getInvoices, getExpenses, getLeads, getFinanceHistory, getAnalytics } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { PageHeader } from "@/components/dashboard/explain";
import { ChartRegistry, ExportAllButton } from "@/components/dashboard/chart-export";
import type { AnalyticsQuery } from "@/lib/analytics";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  await requireAdminPage();
  const now = today();
  // Builder opens on money collected per month over the last 12 months.
  const initialQuery: AnalyticsQuery = {
    measure: "collected",
    breakdown: "month",
    split: null,
    from: format(startOfMonth(subMonths(parseISO(now), 11)), "yyyy-MM-dd"),
    to: now,
  };
  const [clients, projects, invoices, expenses, leads, history, initialRows] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
    getLeads(),
    getFinanceHistory(now),
    getAnalytics(initialQuery),
  ]);
  return (
    <ChartRegistry>
      <div className="space-y-4">
        <PageHeader
          title="Analytics"
          purpose="Raw analysis: build any chart from a fixed menu of measures and breakdowns, browse other chart forms, and download the numbers behind any of them."
          action={<ExportAllButton file={`analytics-${now}`} />}
        />
        <AnalyticsView
          clients={clients}
          projects={projects}
          invoices={invoices}
          expenses={expenses}
          leads={leads}
          history={history}
          today={now}
          initialQuery={initialQuery}
          initialRows={initialRows}
        />
      </div>
    </ChartRegistry>
  );
}
