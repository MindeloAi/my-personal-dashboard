"use client";

import { Fragment, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { deletePaymentAction } from "@/app/actions";
import { EditInvoiceModal } from "@/components/dashboard/edit-invoice-modal";
import { RecordPaymentModal } from "@/components/dashboard/record-payment-modal";
import { effectiveStatus, isOverdue } from "@/lib/invoices";
import { HOLDER_LABEL, tt } from "@/lib/ledger";
import type { Invoice, Ledger, Payment, Project, Subscription } from "@/lib/airtable";

export type InvoiceStatusFilter = "All" | "Sent" | "Overdue" | "Paid" | "Draft";

type Props = {
  invoices: Invoice[];
  ledger: Ledger;
  projects?: Project[];
  subscriptions?: Subscription[];
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (f: InvoiceStatusFilter) => void;
  clientFilter?: string | null;
  onClearClientFilter?: () => void;
  clientName?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  Paid: "bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20",
  Sent: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
  Overdue: "bg-[#ff4d8b]/10 text-[#ff4d8b] border-[#ff4d8b]/20",
  Draft: "bg-zinc-800 text-zinc-400 border-zinc-700",
  Void: "bg-[#c44dff]/10 text-[#c44dff] border-[#c44dff]/20",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  milestone: "Milestone",
  final: "Final",
  recurring: "Recurring",
  one_off: "One-off",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
        STATUS_STYLES[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this payment? Its founder payouts are removed too, including any already paid out, so Business cash is reversed as if neither happened. The invoice reopens if it was paid.")) return;
        startTransition(async () => {
          try {
            const res = await deletePaymentAction(paymentId);
            if (res.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Payment deleted");
          } catch {
            toast.error("Failed to delete payment");
          }
        });
      }}
      className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-[#ff4d8b] hover:border-[#ff4d8b]/40 disabled:opacity-40 transition-colors"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

function PaymentsList({ payments }: { payments: Payment[] }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Payments</p>
      <ul className="divide-y divide-[#2a2e34] border border-[#2a2e34] rounded-xl">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 text-xs text-zinc-400">
            <span>{format(parseISO(p.paidAt), "MMM d, yyyy")}</span>
            <span className="font-mono font-semibold text-white">{tt(p.amount)}</span>
            <span>
              <span className="text-zinc-600 mr-1">Received by</span>
              {HOLDER_LABEL[p.receivedBy]}
            </span>
            {p.method && (
              <span>
                <span className="text-zinc-600 mr-1">Via</span>
                {p.method}
              </span>
            )}
            {p.createdBy && (
              <span>
                <span className="text-zinc-600 mr-1">Entered by</span>
                {p.createdBy}
              </span>
            )}
            <span className="ml-auto">
              <DeletePaymentButton paymentId={p.id} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InvoicesTable({
  invoices,
  ledger,
  projects,
  subscriptions,
  statusFilter,
  onStatusFilterChange,
  clientFilter,
  onClearClientFilter,
  clientName,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const projectToClient = new Map<string, string | undefined>();
  for (const p of projects ?? []) projectToClient.set(p.id, p.Client?.[0]);

  const filtered = invoices
    .filter((inv) => {
      if (statusFilter === "All") return true;
      if (statusFilter === "Overdue") return isOverdue(inv);
      // For "Sent", exclude past-due invoices (they bubble up under Overdue).
      if (statusFilter === "Sent") return inv.Status === "Sent" && !isOverdue(inv);
      return inv.Status === statusFilter;
    })
    .filter((inv) => {
      if (!clientFilter) return true;
      if (inv.Client?.[0] === clientFilter) return true;
      const projectClient = inv.Project?.[0] ? projectToClient.get(inv.Project[0]) : undefined;
      return projectClient === clientFilter;
    })
    .sort((a, b) => {
      const dateA = a["Issue Date"] ?? a["Due Date"] ?? "";
      const dateB = b["Issue Date"] ?? b["Due Date"] ?? "";
      return dateB.localeCompare(dateA);
    });

  const filters: InvoiceStatusFilter[] = ["All", "Sent", "Overdue", "Paid", "Draft"];

  return (
    <div id="invoices" className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Invoices</p>
          {clientFilter && clientName && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#bfff3a]/10 text-[#bfff3a] border border-[#bfff3a]/20 font-medium flex items-center gap-1.5">
              {clientName}
              <button
                onClick={onClearClientFilter}
                className="hover:text-white transition-colors"
                aria-label="Clear client filter"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 bg-[#0b0d10] rounded-xl p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => onStatusFilterChange(f)}
              className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f ? "bg-[#bfff3a] text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
              <th className="text-left pb-3 font-medium">Invoice</th>
              <th className="hidden sm:table-cell text-left pb-3 font-medium">Type</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium pl-3 sm:pl-6">Due</th>
              <th className="hidden sm:table-cell text-left pb-3 font-medium">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2e34]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-600 text-sm">
                  No invoices
                </td>
              </tr>
            ) : (
              filtered.map((inv) => {
                const isExpanded = expandedId === inv.id;
                const renderStatus = effectiveStatus(inv);
                const showMarkPaid = renderStatus === "Sent" || renderStatus === "Overdue";
                const payments = isExpanded ? ledger.payments.filter((p) => p.invoiceId === inv.id) : [];
                return (
                  <Fragment key={inv.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-3 font-mono text-zinc-300 text-xs font-semibold whitespace-nowrap">
                        {inv["Invoice Number"] ?? "—"}
                        {/* Phones drop the Type column; keep the type under the number. */}
                        <span className="sm:hidden block mt-0.5 font-sans font-normal text-zinc-500">
                          {TYPE_LABELS[inv["Invoice Type"] ?? ""] ?? inv["Invoice Type"] ?? "—"}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3 text-zinc-400">
                        {TYPE_LABELS[inv["Invoice Type"] ?? ""] ?? inv["Invoice Type"] ?? "—"}
                      </td>
                      <td className="py-3 text-right font-semibold text-white">
                        ${(inv.Amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 sm:pl-6 text-zinc-400 whitespace-nowrap">
                        {inv["Due Date"] ? format(parseISO(inv["Due Date"]), "MMM d") : "—"}
                        {/* Phones drop the Status column; the badge sits under the date. */}
                        <span className="sm:hidden block mt-1">
                          <StatusBadge status={renderStatus} />
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3">
                        <StatusBadge status={renderStatus} />
                      </td>
                      <td className="py-3 text-right">
                        {showMarkPaid && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingInvoice(inv);
                            }}
                            className="min-h-11 sm:min-h-0 whitespace-nowrap text-xs px-2.5 py-1 rounded-lg bg-[#bfff3a]/10 text-[#bfff3a] border border-[#bfff3a]/20 hover:bg-[#bfff3a]/20 transition-colors"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#0b0d10]/60">
                        <td colSpan={6} className="px-2 pb-3 pt-1">
                          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-zinc-400">
                            {inv["Issue Date"] && (
                              <span>
                                <span className="text-zinc-600 mr-1">Issued</span>
                                {format(parseISO(inv["Issue Date"]), "MMM d, yyyy")}
                              </span>
                            )}
                            {inv["Payment Method"] && (
                              <span>
                                <span className="text-zinc-600 mr-1">Via</span>
                                {inv["Payment Method"]}
                              </span>
                            )}
                            {inv["Paid Date"] && (
                              <span>
                                <span className="text-zinc-600 mr-1">Paid</span>
                                {format(parseISO(inv["Paid Date"]), "MMM d, yyyy")}
                              </span>
                            )}
                            {inv.Notes ? (
                              <span className="text-zinc-300">
                                <span className="text-zinc-600 mr-1">Notes</span>
                                {inv.Notes}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">No notes</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInvoice(inv);
                              }}
                              className="ml-auto min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                          {payments.length > 0 && <PaymentsList payments={payments} />}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          projects={projects}
          subscriptions={subscriptions}
          rule={ledger.rule}
          onClose={() => setEditingInvoice(null)}
        />
      )}
      {payingInvoice && (
        <RecordPaymentModal invoice={payingInvoice} ledger={ledger} onClose={() => setPayingInvoice(null)} />
      )}
    </div>
  );
}
