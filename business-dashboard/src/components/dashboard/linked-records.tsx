"use client";

import Link from "next/link";
import { href, linksFor, paidOn, type Graph } from "@/lib/record-graph";
import { tt } from "@/lib/ledger";

const link = "font-medium text-[#1D4ED8] hover:underline";

/**
 * The chain around one record: the lead it came from, the client, the
 * projects, the invoices and what has been paid. Every name is a link.
 * `hide` leaves out the record the page is already showing.
 */
export function LinkedRecords({
  kind, id, graph, hide = [], className = "",
}: {
  kind: "lead" | "client" | "project" | "invoice";
  id: string;
  graph: Graph;
  hide?: ("lead" | "client" | "projects" | "invoices")[];
  className?: string;
}) {
  const r = linksFor(kind, id, graph);
  const parts: React.ReactNode[] = [];
  if (!hide.includes("lead") && r.lead)
    parts.push(<span key="l">Lead <Link className={link} href={href.lead(r.lead.id)}>{r.lead.Name}</Link></span>);
  if (!hide.includes("client"))
    parts.push(r.client
      ? <span key="c">Client <Link className={link} href={href.client(r.client.id)}>{r.client.Company || r.client.Name}</Link></span>
      : <span key="c" className="text-[#6B7789]">No client yet</span>);
  if (!hide.includes("projects") && r.projects.length)
    parts.push(<span key="p">{r.projects.length === 1 ? "Project" : "Projects"} {r.projects.map((p, i) => (
      <span key={p.id}>{i > 0 && ", "}<Link className={link} href={href.project(p.id)}>{p.Name}</Link></span>
    ))}</span>);
  if (!hide.includes("invoices"))
    parts.push(r.invoices.length
      ? <span key="i">Invoices {r.invoices.map((i, n) => (
          <span key={i.id}>{n > 0 && ", "}<Link className={link} href={href.invoice(i.id)}>{i["Invoice Number"] ?? "Draft"}</Link>
            <span className="text-[#5A6678]"> ({i.Status}, {tt(i.Amount ?? 0)})</span></span>
        ))}</span>
      : <span key="i" className="text-[#6B7789]">No invoices yet</span>);
  if (r.invoices.some((i) => paidOn(i) > 0)) parts.push(<span key="paid">Paid so far <strong className="text-[#1B2533]">{tt(r.paid)}</strong></span>);

  return (
    <p className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4A5568] ${className}`} onClick={(e) => e.stopPropagation()}>
      {parts}
    </p>
  );
}
