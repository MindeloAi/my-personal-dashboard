"use client";

import Link from "next/link";
import { href, linksFor, paidOn, type Graph } from "@/lib/record-graph";
import { HOLDER_LABEL, tt } from "@/lib/ledger";
import type { Payment } from "@/lib/db";

const link = "font-medium text-[#1D4ED8] hover:underline";
const th = "border-b border-[#DCE1E8] px-3 py-2 text-left text-xs font-semibold text-[#4A5568]";
const td = "border-b border-[#EEF1F5] px-3 py-2";

/** A client's whole deal: the lead it came from, projects, invoices, payments and total paid. */
export function ClientRecords({ clientId, graph, payments, cutover }: { clientId: string; graph: Graph; payments: Payment[]; cutover: string }) {
  const r = linksFor("client", clientId, graph);
  const ids = new Set(r.invoices.map((i) => i.id));
  const number = new Map(r.invoices.map((i) => [i.id, i["Invoice Number"] ?? "Draft"]));
  const paidRows = [
    ...payments.filter((p) => ids.has(p.invoiceId)).map((p) => ({ date: p.paidAt.slice(0, 10), invoiceId: p.invoiceId, amount: p.amount, how: `Received by ${HOLDER_LABEL[p.receivedBy]}` })),
    // Paid before the ledger began: one line per invoice, on its paid date.
    ...r.invoices
      .filter((i) => i.Status === "Paid" && (i["Paid Date"] ?? "") < cutover.slice(0, 10) && !payments.some((p) => p.invoiceId === i.id))
      .map((i) => ({ date: i["Paid Date"] ?? "", invoiceId: i.id, amount: i.Amount ?? 0, how: "Paid before the ledger" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const projectName = new Map(r.projects.map((p) => [p.id, p.Name]));

  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[#1B2533]">From lead to cash</h2>
        <p className="mt-0.5 text-xs text-[#4A5568]">
          The lead this client came from, their projects, every invoice and every payment. Each name opens that record.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[#5A6678]">Came from lead</dt>
          <dd className="mt-0.5">{r.lead ? <Link className={link} href={href.lead(r.lead.id)}>{r.lead.Name}</Link> : <span className="text-[#6B7789]">No lead recorded</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5A6678]">Projects</dt>
          <dd className="mt-0.5">
            {r.projects.length ? r.projects.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link className={link} href={href.project(p.id)}>{p.Name}</Link></span>) : <span className="text-[#6B7789]">None</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5A6678]">Paid so far</dt>
          <dd className="mt-0.5 font-semibold text-[#1B2533]">{tt(r.paid)}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto border border-[#DCE1E8]">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead><tr className="bg-[#F7F8FA]"><th className={th}>Invoice</th><th className={th}>Project</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Paid</th></tr></thead>
            <tbody>
              {r.invoices.length === 0 && <tr><td className={td} colSpan={5}>No invoices yet.</td></tr>}
              {r.invoices.map((i) => (
                <tr key={i.id}>
                  <td className={td}><Link className={link} href={href.invoice(i.id)}>{i["Invoice Number"] ?? "Draft"}</Link></td>
                  <td className={td}>{i.Project?.[0] ? <Link className={link} href={href.project(i.Project[0])}>{projectName.get(i.Project[0]) ?? "Project"}</Link> : ""}</td>
                  <td className={td}>{i.Status}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{tt(i.Amount ?? 0)}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{tt(paidOn(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-[#DCE1E8]">
          <table className="w-full min-w-[380px] border-collapse text-sm">
            <thead><tr className="bg-[#F7F8FA]"><th className={th}>Paid on</th><th className={th}>Invoice</th><th className={th}>How</th><th className={`${th} text-right`}>Amount</th></tr></thead>
            <tbody>
              {paidRows.length === 0 && <tr><td className={td} colSpan={4}>No payments yet.</td></tr>}
              {paidRows.map((p, n) => (
                <tr key={n}>
                  <td className={td}>{p.date}</td>
                  <td className={td}><Link className={link} href={href.invoice(p.invoiceId)}>{number.get(p.invoiceId)}</Link></td>
                  <td className={`${td} text-[#4A5568]`}>{p.how}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{tt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
