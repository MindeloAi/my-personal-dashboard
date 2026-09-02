"use client";

import { useRouter } from "next/navigation";
import { TopClients } from "@/components/dashboard/top-clients";
import { ClientsList } from "@/components/dashboard/clients-list";
import type { Client, Invoice, Project } from "@/lib/db";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsView({ clients, invoices, projects }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <TopClients
        clients={clients}
        invoices={invoices}
        projects={projects}
        selectedClientId={null}
        onSelectClient={(clientId) => {
          // Was "/finance?client=" — a dead route since the move under /admin.
          if (clientId) router.push(`/admin/finance?client=${encodeURIComponent(clientId)}`);
        }}
      />
      <ClientsList clients={clients} invoices={invoices} projects={projects} />
    </div>
  );
}
