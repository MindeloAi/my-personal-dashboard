"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordPaymentAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  HOLDERS,
  HOLDER_LABEL,
  PAYMENT_METHODS,
  round2,
  splitPreview,
  tt,
  type Holder,
  type PaymentMethod,
  type SplitRule,
} from "@/lib/ledger";
import { today } from "@/lib/subscriptions";
import type { Invoice, Ledger } from "@/lib/airtable";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";



/** Display-only split of one payment. The saved figures come from the database. */
export function SplitPreview({
  amount,
  rule,
  michaelShare,
}: {
  amount: number;
  rule: SplitRule;
  michaelShare: number;
}) {
  const s = splitPreview(amount, rule, michaelShare);
  const rows: [string, number][] = [
    ["Bonus pool", s.pool],
    ["Business allocation", s.allocation],
    ["Michael base", s.michaelBase],
    ["Zane base", s.zaneBase],
    ["Michael bonus", s.michaelBonus],
    ["Zane bonus", s.zaneBonus],
    ["Kept by business", s.kept],
  ];
  return (
    <div className="bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2">
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-1 text-zinc-500">{label}</td>
              <td className="py-1 text-right font-mono text-zinc-300">{tt(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-[#2a2e34]">
            <td className="pt-2 pb-1 text-zinc-300 font-semibold">Michael total</td>
            <td className="pt-2 pb-1 text-right font-mono text-white font-semibold">{tt(s.michaelTotal)}</td>
          </tr>
          <tr>
            <td className="py-1 text-zinc-300 font-semibold">Zane total</td>
            <td className="py-1 text-right font-mono text-white font-semibold">{tt(s.zaneTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function RecordPaymentModal({
  invoice,
  ledger,
  onClose,
}: {
  invoice: Invoice;
  ledger: Ledger;
  onClose: () => void;
}) {
  const remaining = round2((invoice.Amount ?? 0) - (invoice["Paid So Far"] ?? 0));
  const michaelShare = invoice["Michael Bonus Share"];
  const hasShares = michaelShare != null && invoice["Zane Bonus Share"] != null;

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [paidAt, setPaidAt] = useState(today());
  const [receivedBy, setReceivedBy] = useState<Holder>("mikey");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [payOutNow, setPayOutNow] = useState(true);
  // null = follow "Received by" until the user picks a holder here.
  const [paidFromChoice, setPaidFromChoice] = useState<Holder | null>(null);
  const paidFrom = paidFromChoice ?? receivedBy;

  const amountNum = parseFloat(amount) || 0;
  const amountValid = amountNum > 0 && amountNum <= remaining;
  const preview = hasShares ? splitPreview(amountNum, ledger.rule, michaelShare) : null;
  const cashUp = preview && payOutNow ? preview.kept : amountNum;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasShares || !amountValid) return;
    setError(null);
    start(async () => {
      try {
        const res = await recordPaymentAction({
          invoiceId: invoice.id,
          amount: amountNum,
          paidAt,
          receivedBy,
          method: method ? (method as PaymentMethod) : null,
          note: note.trim() || null,
          payOutFrom: payOutNow ? paidFrom : null,
        });
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success("Payment recorded");
        onClose();
      } catch {
        setError("Failed to record payment. Try again.");
        toast.error("Failed to record payment");
      }
    });
  }

  return (
    <ModalShell title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500">
          {invoice["Invoice Number"] ?? "Invoice"}, {tt(remaining)} still owed
        </p>
        {!hasShares && (
          <p className="text-xs text-[#ff4d8b]">Set the bonus shares on this invoice first.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Amount (TTD)</label>
            <input
              type="number"
              min="0.01"
              max={remaining}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Paid on</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Received by</label>
            <select
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value as Holder)}
              className={selectCls}
            >
              {HOLDERS.map((h) => (
                <option key={h} value={h}>
                  {HOLDER_LABEL[h]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}>
              <option value="">Not set</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </div>
        {hasShares && (
          <>
            <SplitPreview amount={amountNum} rule={ledger.rule} michaelShare={michaelShare} />
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={payOutNow}
                onChange={(e) => setPayOutNow(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#bfff3a]"
              />
              Pay out founders now
            </label>
            {payOutNow && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400">Paid from</label>
                <select
                  value={paidFrom}
                  onChange={(e) => setPaidFromChoice(e.target.value as Holder)}
                  className={selectCls}
                >
                  {HOLDERS.map((h) => (
                    <option key={h} value={h}>
                      {HOLDER_LABEL[h]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-xs text-zinc-500">Business cash goes up by {tt(cashUp)}</p>
          </>
        )}
        {error && <p className="text-xs text-[#ff4d8b]">{error}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !hasShares || !amountValid}
            className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
          >
            {pending ? "Saving…" : "Confirm payment"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
