"use client";

import { useRouter } from "next/navigation";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { MrrCard } from "@/components/dashboard/mrr-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { BusinessCounters } from "@/components/dashboard/business-counters";
import { ServiceTypeSplit } from "@/components/dashboard/service-type-split";
import type { Client, Project, Invoice, Expense, Subscription } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  subscriptions: Subscription[];
};

export function OverviewView({
  clients,
  projects,
  invoices,
  expenses,
  subscriptions,
}: Props) {
  const router = useRouter();

  return (
    <>
      <HeroCards invoices={invoices} expenses={expenses} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RevenueChart invoices={invoices} expenses={expenses} />
        <BusinessCounters
          clients={clients}
          projects={projects}
          invoices={invoices}
          onJumpToOverdue={() => router.push("/admin/finance?status=Overdue")}
        />
        <div className="grid grid-cols-1 gap-3">
          <MrrCard
            subscriptions={subscriptions}
            invoices={invoices}
            onJumpToRecurring={() => router.push("/admin/finance#subscriptions")}
          />
          <ServiceTypeSplit projects={projects} invoices={invoices} />
        </div>
      </div>
    </>
  );
}
