"use client";

import { useRouter } from "next/navigation";
import { TopClients } from "@/components/dashboard/top-clients";
import type { Client, Invoice, Project } from "@/lib/db";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsView({ clients, invoices, projects }: Props) {
  const router = useRouter();

  return (
    <TopClients
      clients={clients}
      invoices={invoices}
      projects={projects}
      selectedClientId={null}
      onSelectClient={(clientId) => {
        if (clientId) router.push(`/finance?client=${encodeURIComponent(clientId)}`);
      }}
    />
  );
}
