"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateInvoiceAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Invoice, Project, Subscription } from "@/lib/airtable";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

type InvoiceTypeValue = "deposit" | "milestone" | "final" | "recurring" | "one_off";
type InvoiceStatusValue = "Draft" | "Sent" | "Paid" | "Overdue" | "Void";

export function EditInvoiceModal({
  invoice,
  projects = [],
  subscriptions = [],
  onClose,
}: {
  invoice: Invoice;
  projects?: Project[];
  subscriptions?: Subscription[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = fd.get("amount") as string;
    const projectId = (fd.get("projectId") as string) || "";
    const subscriptionId = (fd.get("subscriptionId") as string) || "";
    const invoiceType = (fd.get("invoiceType") as string) || "";
    const status = (fd.get("status") as string) || "";
    setError(false);
    start(async () => {
      try {
        await updateInvoiceAction(invoice.id, {
          "Invoice Number": (fd.get("invoiceNumber") as string) || undefined,
          Amount: amount ? parseFloat(amount) : undefined,
          "Invoice Type": invoiceType ? (invoiceType as InvoiceTypeValue) : undefined,
          Status: status ? (status as InvoiceStatusValue) : undefined,
          "Issue Date": (fd.get("issueDate") as string) || undefined,
          "Due Date": (fd.get("dueDate") as string) || undefined,
          "Paid Date": (fd.get("paidDate") as string) || undefined,
          Notes: (fd.get("notes") as string) || undefined,
          Project: projectId ? [projectId] : undefined,
          // Unlike Project above, "— None" here sends [] and genuinely unlinks.
          // The link decides which period lib/subscriptions.ts thinks has been
          // billed, so a misattributed invoice has to be detachable — otherwise
          // it silently suppresses a reminder for ever.
          Subscription: subscriptionId ? [subscriptionId] : [],
        });
        toast.success("Invoice saved");
        onClose();
      } catch {
        setError(true);
        toast.error("Failed to save invoice");
      }
    });
  }

  return (
    <ModalShell title="Edit Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {subscriptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Subscription</label>
              <select
                name="subscriptionId"
                defaultValue={invoice.Subscription?.[0] ?? ""}
                className={selectCls}
              >
                <option value="">— None</option>
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.Name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {projects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Project</label>
              <select name="projectId" defaultValue={invoice.Project?.[0] ?? ""} className={selectCls}>
                <option value="">— None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.Name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Invoice Number</label>
              <input name="invoiceNumber" defaultValue={invoice["Invoice Number"] ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Amount ($)</label>
              <input name="amount" type="number" min="0" step="0.01" defaultValue={invoice.Amount ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Type</label>
              <select name="invoiceType" defaultValue={invoice["Invoice Type"] ?? ""} className={selectCls}>
                <option value="">—</option>
                <option value="deposit">Deposit</option>
                <option value="milestone">Milestone</option>
                <option value="final">Final</option>
                <option value="recurring">Recurring</option>
                <option value="one_off">One-off</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Status</label>
              <select name="status" defaultValue={invoice.Status ?? "Draft"} className={selectCls}>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Void">Void</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Issue Date</label>
              <input name="issueDate" type="date" defaultValue={invoice["Issue Date"] ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Due Date</label>
              <input name="dueDate" type="date" defaultValue={invoice["Due Date"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Paid Date</label>
            <input name="paidDate" type="date" defaultValue={invoice["Paid Date"] ?? ""} className={inputCls} />
            <p className="text-[10px] text-zinc-600">
              Required for revenue/profit to count this invoice. Leave blank and set Status to Paid to default to today.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <input name="notes" defaultValue={invoice.Notes ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#ff4d8b]">Failed to save. Try again.</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
