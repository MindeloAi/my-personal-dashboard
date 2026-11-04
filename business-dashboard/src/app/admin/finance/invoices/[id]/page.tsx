import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getLeads, getLedger, getProjects } from "@/lib/db";
import { getEntityActivity, listAttachments, listDocuments } from "@/lib/documents-db";
import { effectiveStatus } from "@/lib/invoices";
import { HOLDER_LABEL, tt } from "@/lib/ledger";
import { paidOn, href } from "@/lib/record-graph";
import { today } from "@/lib/subscriptions";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { LinkedRecords } from "@/components/dashboard/linked-records";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";
import { MakeReceipt } from "./make-receipt";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the Make receipt server action renders a PDF

const th = "border-b border-[#DCE1E8] px-3 py-2 text-left text-xs font-semibold text-[#4A5568]";
const td = "border-b border-[#EEF1F5] px-3 py-2";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();

  const [invoices, clients, leads, projects, ledger, files, activity, docs, receipts] = await Promise.all([
    getInvoices(), getClients(), getLeads(), getProjects(), getLedger(today()),
    listAttachments("invoice", [id]), getEntityActivity("invoice", id), listDocuments({ type: "invoice", invoiceId: id }),
    listDocuments({ type: "receipt", invoiceId: id }),
  ]);
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();

  const status = effectiveStatus(inv);
  const paid = paidOn(inv);
  const balance = Math.max(0, (inv.Amount ?? 0) - paid);
  const payments = ledger.payments.filter((p) => p.invoiceId === id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const [pdf] = docs;
  const receiptFor = new Map(receipts.filter((d) => d.status !== "void" && d.paymentId).map((d) => [d.paymentId!, d]));

  return (
    <div className="space-y-3">
      <Link href="/admin/finance/invoices" className="text-xs text-[#5A6678] hover:text-[#334155]">Invoices</Link>
      <PageHeader title={`Invoice ${inv["Invoice Number"] ?? "(draft, not numbered yet)"}`} purpose={`${status}. Issued ${inv["Issue Date"] ?? "not yet"}, due ${inv["Due Date"] ?? "no date set"}.`} />
      <LinkedRecords kind="invoice" id={id} graph={{ clients, leads, projects, invoices }} hide={["invoices"]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Amount" value={tt(inv.Amount ?? 0)} note="The full invoice." />
        <StatTile label="Paid" value={tt(paid)} note="Payments recorded against it." tone="text-[#1E6B3A]" />
        <StatTile label="Still owed" value={tt(balance)} note={balance > 0 ? "Not yet received." : "Nothing outstanding."} tone={balance > 0 ? "text-[#B23A0A]" : undefined} />
        <StatTile label="Paid on" value={inv["Paid Date"] ?? "Not paid"} note="Date it was paid in full." />
      </div>
      {inv.Notes && (
        <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-[#1B2533]">{inv.Notes}</p>
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Payments</h2>
        <div className="overflow-x-auto border border-[#DCE1E8] bg-white">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead><tr className="bg-[#F7F8FA]"><th className={th}>Paid on</th><th className={th}>Received by</th><th className={`${th} text-right`}>Amount</th><th className={th}>Receipt</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td className={td} colSpan={4}>{inv.Status === "Paid" ? `Paid before the ledger began${inv["Paid Date"] ? `, on ${inv["Paid Date"]}` : ""}.` : "No payments yet."}</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{p.paidAt.slice(0, 10)}</td>
                  <td className={td}>{HOLDER_LABEL[p.receivedBy]}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{tt(p.amount)}</td>
                  <td className={td}>
                    {(() => {
                      const rct = receiptFor.get(p.id);
                      if (!rct) return <MakeReceipt paymentId={p.id} />;
                      return <Link className="font-medium text-[#1D4ED8] hover:underline" href={href.document(rct.id)}>{rct.receiptNumber ? `Receipt ${rct.receiptNumber}` : "Receipt (draft)"}</Link>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-xs text-[#4A5568]">Make receipt drafts a receipt for that payment for the client; finalise it on the next page to give it its RCT number and PDF. A receipt link opens the one already made. You can also ask Claude: &quot;she paid, make a receipt&quot;.</p>
        <p className="text-xs"><Link className="font-medium text-[#1D4ED8] hover:underline" href="/admin/finance/received">Record or change payments in Money received</Link></p>
      </section>
      {pdf && <p className="text-xs">Invoice document: <Link className="font-medium text-[#1D4ED8] hover:underline" href={href.document(pdf.id)}>{pdf.title}</Link></p>}
      <FilesPanel entityType="invoice" entityId={id} files={files} defaultKind="proof_of_payment" />
      <ActivityList items={activity} />
    </div>
  );
}
