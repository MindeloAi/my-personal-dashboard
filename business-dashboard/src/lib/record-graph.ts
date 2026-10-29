// How records connect: a lead becomes a client, a client has projects, projects
// have invoices, invoices are paid. Given any one record, find the others, so
// every page can link a deal from first contact to cash. Pure; checked in
// scripts/record-graph.test.ts.
import type { Client, Project, Invoice, Lead } from "@/lib/db";

export const href = {
  client: (id: string) => `/admin/clients/${encodeURIComponent(id)}`,
  lead: (id: string) => `/admin/leads#lead-${id}`,
  project: (id: string) => `/admin/projects#project-${id}`,
  invoice: (id: string) => `/admin/finance/invoices#invoice-${id}`,
};

export type Graph = { clients: Client[]; leads: Lead[]; projects: Project[]; invoices: Invoice[] };
export type Linked = { lead?: Lead; client?: Client; projects: Project[]; invoices: Invoice[]; paid: number };

/** What a client has been paid on an invoice: the full amount once Paid, else the payments so far. */
export const paidOn = (i: Invoice) => (i.Status === "Paid" ? i.Amount ?? 0 : i["Paid So Far"] ?? 0);

export function linksFor(kind: "lead" | "client" | "project" | "invoice", id: string, g: Graph): Linked {
  const byId = <T extends { id: string }>(xs: T[], x?: string) => (x ? xs.find((r) => r.id === x) : undefined);
  let lead: Lead | undefined, client: Client | undefined, projects: Project[] = [], invoices: Invoice[] = [];
  const projectOf = (i: Invoice) => byId(g.projects, i.Project?.[0]);
  const clientIdOf = (i: Invoice) => i.Client?.[0] ?? projectOf(i)?.Client?.[0];

  if (kind === "invoice") {
    const inv = byId(g.invoices, id);
    if (inv) {
      const p = projectOf(inv);
      projects = p ? [p] : [];
      client = byId(g.clients, clientIdOf(inv));
      lead = byId(g.leads, p?.Lead?.[0]) ?? (client ? g.leads.find((l) => l.Client?.[0] === client!.id) : undefined);
      invoices = [inv];
    }
  } else if (kind === "project") {
    const p = byId(g.projects, id);
    if (p) {
      projects = [p];
      client = byId(g.clients, p.Client?.[0]);
      lead = byId(g.leads, p.Lead?.[0]) ?? (client ? g.leads.find((l) => l.Client?.[0] === client!.id) : undefined);
      invoices = g.invoices.filter((i) => i.Project?.[0] === p.id);
    }
  } else {
    if (kind === "lead") {
      lead = byId(g.leads, id);
      client = byId(g.clients, lead?.Client?.[0]);
    } else {
      client = byId(g.clients, id);
      lead = client ? g.leads.find((l) => l.Client?.[0] === client!.id) : undefined;
    }
    projects = g.projects.filter((p) => (client && p.Client?.[0] === client.id) || (lead && p.Lead?.[0] === lead.id));
    const pids = new Set(projects.map((p) => p.id));
    invoices = g.invoices.filter((i) => (client && clientIdOf(i) === client.id) || (i.Project?.[0] && pids.has(i.Project[0])));
  }
  invoices = invoices.filter((i) => i.Status !== "Void");
  return { lead, client, projects, invoices, paid: invoices.reduce((s, i) => s + paidOn(i), 0) };
}
