"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeBonusSharesAction, setCollectorAction, updateInvoiceAction } from "@/app/actions";
import { SplitPreview } from "@/components/dashboard/record-payment-modal";
import { ModalShell } from "@/components/ui/modal-shell";
import { HOLDERS, HOLDER_LABEL, shareError, type Holder, type SplitRule } from "@/lib/ledger";
import type { Invoice, Project, Subscription } from "@/lib/airtable";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

type InvoiceTypeValue = "deposit" | "milestone" | "final" | "recurring" | "one_off";
type InvoiceStatusValue = "Draft" | "Sent" | "Overdue" | "Void";

// Fraction to a percent string without float noise (0.6 * 100 = 60.000000000000014).
const toPct = (f: number | undefined) => (f == null ? "" : String(Math.round(f * 10000) / 100));
const fillOther = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? String(Math.round((100 - n) * 100) / 100) : "";
};

export function EditInvoiceModal({
  invoice,
  projects = [],
  subscriptions = [],
  rule,
  collector,
  onClose,
}: {
  invoice: Invoice;
  projects?: Project[];
  subscriptions?: Subscription[];
  rule?: SplitRule;
  /** Who holds its payments now; null when they differ. Omit to hide the field. */
  collector?: Holder | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(invoice.Amount != null ? String(invoice.Amount) : "");
  const [michael, setMichael] = useState(toPct(invoice["Michael Bonus Share"]));
  const [zane, setZane] = useState(toPct(invoice["Zane Bonus Share"]));
  const [collectedBy, setCollectedBy] = useState<Holder | "">(collector ?? "");
  // The database locks the amount once a payment exists. Shares stay editable,
  // but then go through changeBonusSharesAction, which corrects the payouts.
  const locked = (invoice["Paid So Far"] ?? 0) > 0;
  const isPaid = invoice.Status === "Paid";
  const sharesProblem = locked && (michael === "" || zane === "") ? "Set both bonus shares." : shareError(michael, zane);
  const sharesChanged =
    toPct(invoice["Michael Bonus Share"]) !== michael || toPct(invoice["Zane Bonus Share"]) !== zane;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sharesProblem) return;
    const fd = new FormData(e.currentTarget);
    const bothShares = michael !== "" && zane !== "";
    const projectId = (fd.get("projectId") as string) || "";
    const subscriptionId = (fd.get("subscriptionId") as string) || "";
    const invoiceType = (fd.get("invoiceType") as string) || "";
    const status = (fd.get("status") as string) || "";
    setError(null);
    start(async () => {
      try {
        if (collectedBy && collectedBy !== collector) {
          const res = await setCollectorAction(invoice.id, collectedBy);
          if (res.error) {
            setError(res.error);
            toast.error(res.error);
            return;
          }
        }
        if (locked && sharesChanged) {
          const res = await changeBonusSharesAction(invoice.id, parseFloat(michael) / 100);
          if (res.error) {
            setError(res.error);
            toast.error(res.error);
            return;
          }
        }
        // "" clears a column; undefined would leave the old value in place while
        // reporting success (db.ts toColumns). Type/Status/Amount stay undefined
        // when blank: "" fails their enum/number validation.
        // Paid is reached only by recording payments: a Paid invoice never sends
        // Status, and Paid Date is never sent.
        const res = await updateInvoiceAction(invoice.id, {
          Amount: !locked && amount ? parseFloat(amount) : undefined,
          "Invoice Type": invoiceType ? (invoiceType as InvoiceTypeValue) : undefined,
          Status: !isPaid && status ? (status as InvoiceStatusValue) : undefined,
          "Issue Date": (fd.get("issueDate") as string) || "",
          "Due Date": (fd.get("dueDate") as string) || "",
          // Both blank clears them (null); undefined would silently keep the old ones.
          "Michael Bonus Share": locked ? undefined : bothShares ? parseFloat(michael) / 100 : null,
          "Zane Bonus Share": locked ? undefined : bothShares ? parseFloat(zane) / 100 : null,
          Notes: (fd.get("notes") as string) || "",
          // "— None" sends [] and unlinks. But each select only renders when its
          // list was passed in; a caller without the list must not unlink, or
          // editing from a screen that omits it silently detaches the invoice
          // (for a subscription, that re-raises a reminder already billed).
          Project: projectId ? [projectId] : projects.length ? [] : undefined,
          Subscription: subscriptionId ? [subscriptionId] : subscriptions.length ? [] : undefined,
        });
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success("Invoice saved");
        onClose();
      } catch {
        setError("Failed to save. Try again.");
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
              <p className={inputCls + " text-zinc-400"}>
                {invoice["Invoice Number"] ?? "Assigned when sent"}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Amount ($)</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={locked}
                className={inputCls + " disabled:opacity-50"}
              />
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
              {isPaid ? (
                <p className={inputCls + " text-zinc-400"}>Paid</p>
              ) : (
                <select name="status" defaultValue={invoice.Status ?? "Draft"} className={selectCls}>
                  <option value="Draft" disabled={locked}>Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Void" disabled={locked}>Void</option>
                </select>
              )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Michael bonus share (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={michael}
                onChange={(e) => {
                  setMichael(e.target.value);
                  if (zane === "") setZane(fillOther(e.target.value));
                }}
                className={inputCls + " disabled:opacity-50"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Zane bonus share (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={zane}
                onChange={(e) => {
                  setZane(e.target.value);
                  if (michael === "") setMichael(fillOther(e.target.value));
                }}
                className={inputCls + " disabled:opacity-50"}
              />
            </div>
          </div>
          {locked && sharesChanged && !sharesProblem && (
            <p className="text-xs text-[#fbbf24]">
              Payments are recorded, so saving re-splits their bonus. Payouts already paid out get a
              correction line: what one of you pays back and the other is owed.
            </p>
          )}
          {sharesProblem && <p className="text-xs text-[#ff4d8b]">{sharesProblem}</p>}
          {locked && collector !== undefined && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="collected-by" className="text-xs text-zinc-400">Collected by (who has the money)</label>
              <select
                id="collected-by"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value as Holder)}
                className={selectCls}
              >
                {collectedBy === "" && <option value="">Mixed, pick one</option>}
                {HOLDERS.map((h) => (
                  <option key={h} value={h}>{HOLDER_LABEL[h]}</option>
                ))}
              </select>
            </div>
          )}
          {rule && !sharesProblem && michael !== "" && zane !== "" && (
            <SplitPreview amount={parseFloat(amount) || 0} rule={rule} michaelShare={parseFloat(michael) / 100} />
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <input name="notes" defaultValue={invoice.Notes ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#ff4d8b]">{error}</p>}
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
              disabled={pending || !!sharesProblem}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
