"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { deletePaymentAction } from "@/app/actions";
import { EditInvoiceModal } from "@/components/dashboard/edit-invoice-modal";
import { RecordPaymentModal } from "@/components/dashboard/record-payment-modal";
import { effectiveStatus, isOverdue } from "@/lib/invoices";
import { HOLDER_LABEL, tt, type Holder } from "@/lib/ledger";
import type { Client, Invoice, Lead, Ledger, Payment, Project, Subscription } from "@/lib/airtable";
import { Explain } from "./explain";
import { LinkedRecords } from "./linked-records";

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
  /** For the linked-records line: client and lead names around each invoice. */
  clients?: Client[];
  leads?: Lead[];
};

const STATUS_STYLES: Record<string, string> = {
  Paid: "bg-[#1E6B3A]/10 text-[#1E6B3A] border-[#1E6B3A]/20",
  Sent: "bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20",
  Overdue: "bg-[#B23A0A]/10 text-[#B23A0A] border-[#B23A0A]/20",
  Draft: "bg-[#E2E8F0] text-[#4A5568] border-[#CBD5E1]",
  Void: "bg-[#7E22CE]/10 text-[#7E22CE] border-[#7E22CE]/20",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  milestone: "Milestone",
  final: "Final",
  recurring: "Recurring",
  one_off: "One-off",
};

/** Who holds an invoice's payments: one holder, null if they differ, undefined if none. */
function collectorOf(ledger: Ledger, invoiceId: string): Holder | null | undefined {
  const holders = new Set(ledger.payments.filter((p) => p.invoiceId === invoiceId).map((p) => p.receivedBy));
  if (holders.size === 0) return undefined;
  return holders.size === 1 ? [...holders][0] : null;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
        STATUS_STYLES[status] ?? "bg-[#E2E8F0] text-[#4A5568] border-[#CBD5E1]"
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
      className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#B23A0A] hover:border-[#B23A0A]/40 disabled:opacity-40 transition-colors"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

function PaymentsList({ payments }: { payments: Payment[] }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] text-[#6B7789] uppercase tracking-wider mb-1.5">Payments</p>
      <ul className="divide-y divide-[#DCE1E8] border border-[#DCE1E8] rounded-[4px]">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 text-xs text-[#4A5568]">
            <span>{format(parseISO(p.paidAt), "MMM d, yyyy")}</span>
            <span className="font-mono font-semibold text-[#1B2533]">{tt(p.amount)}</span>
            <span>
              <span className="text-[#6B7789] mr-1">Received by</span>
              {HOLDER_LABEL[p.receivedBy]}
            </span>
            {p.method && (
              <span>
                <span className="text-[#6B7789] mr-1">Via</span>
                {p.method}
              </span>
            )}
            {p.createdBy && (
              <span>
                <span className="text-[#6B7789] mr-1">Entered by</span>
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
  clients = [],
  leads = [],
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const graph = { clients, leads, projects: projects ?? [], invoices };
  // A link to /admin/finance/invoices#invoice-<id> opens that invoice's details.
  useEffect(() => {
    const open = () => {
      if (window.location.hash.startsWith("#invoice-")) setExpandedId(window.location.hash.slice(9));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
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
    <div id="invoices" className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-[#5A6678] uppercase tracking-wider">Invoices</p>
          {clientFilter && clientName && (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 font-medium flex items-center gap-1.5">
              {clientName}
              <button
                onClick={onClearClientFilter}
                className="hover:text-[#0E1A2B] transition-colors"
                aria-label="Clear client filter"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 bg-[#F3F5F8] rounded-[4px] p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => onStatusFilterChange(f)}
              className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
                statusFilter === f ? "bg-[#1D4ED8] text-white" : "text-[#4A5568] hover:text-[#0E1A2B]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <Explain
        className="-mt-2 mb-5"
        shows="Every invoice issued to a client: its number, type, amount, due date and status."
        read="Filter by status at the top. Sent means issued and not yet paid, Overdue means past its due date, Paid means its recorded payments cover the full amount. Numbers are assigned automatically when an invoice is sent."
        watch="Overdue invoices, and Sent invoices close to their due date. An invoice only becomes Paid by recording payments against it."
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#5A6678] text-xs uppercase tracking-wider border-b border-[#DCE1E8]">
              <th className="text-left pb-3 font-medium">Invoice</th>
              <th className="hidden sm:table-cell text-left pb-3 font-medium">Type</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium pl-3 sm:pl-6">Due</th>
              <th className="hidden sm:table-cell text-left pb-3 font-medium">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE1E8]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6B7789] text-sm">
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
                      id={`invoice-${inv.id}`}
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      className="scroll-mt-24 hover:bg-[#F7F8FA] target:bg-[#EFF4FF] transition-colors cursor-pointer"
                    >
                      <td className="py-3 font-mono text-[#334155] text-xs font-semibold whitespace-nowrap">
                        {inv["Invoice Number"] ?? "—"}
                        {/* Phones drop the Type column; keep the type under the number. */}
                        <span className="sm:hidden block mt-0.5 font-sans font-normal text-[#5A6678]">
                          {TYPE_LABELS[inv["Invoice Type"] ?? ""] ?? inv["Invoice Type"] ?? "—"}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3 text-[#4A5568]">
                        {TYPE_LABELS[inv["Invoice Type"] ?? ""] ?? inv["Invoice Type"] ?? "—"}
                      </td>
                      <td className="py-3 text-right font-semibold text-[#1B2533]">
                        TT${(inv.Amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 sm:pl-6 text-[#4A5568] whitespace-nowrap">
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
                            className="min-h-11 sm:min-h-0 whitespace-nowrap text-xs px-2.5 py-1 rounded-[4px] bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 hover:bg-[#1D4ED8]/20 transition-colors"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#F3F5F8]/60">
                        <td colSpan={6} className="px-2 pb-3 pt-1">
                          <LinkedRecords kind="invoice" id={inv.id} graph={graph} hide={["invoices"]} className="mb-2" />
                          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-[#4A5568]">
                            {inv["Issue Date"] && (
                              <span>
                                <span className="text-[#6B7789] mr-1">Issued</span>
                                {format(parseISO(inv["Issue Date"]), "MMM d, yyyy")}
                              </span>
                            )}
                            {inv["Payment Method"] && (
                              <span>
                                <span className="text-[#6B7789] mr-1">Via</span>
                                {inv["Payment Method"]}
                              </span>
                            )}
                            {inv["Paid Date"] && (
                              <span>
                                <span className="text-[#6B7789] mr-1">Paid</span>
                                {format(parseISO(inv["Paid Date"]), "MMM d, yyyy")}
                              </span>
                            )}
                            {inv.Notes ? (
                              <span className="text-[#334155]">
                                <span className="text-[#6B7789] mr-1">Notes</span>
                                {inv.Notes}
                              </span>
                            ) : (
                              <span className="text-[#6B7789] italic">No notes</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInvoice(inv);
                              }}
                              className="ml-auto min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
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
          collector={collectorOf(ledger, editingInvoice.id)}
          onClose={() => setEditingInvoice(null)}
        />
      )}
      {payingInvoice && (
        <RecordPaymentModal invoice={payingInvoice} ledger={ledger} onClose={() => setPayingInvoice(null)} />
      )}
    </div>
  );
}
