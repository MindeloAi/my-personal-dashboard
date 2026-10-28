"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  deleteLatestCashCountAction,
  deleteTransferAction,
  recordCashCountAction,
  recordTransferAction,
  type ActionResult,
} from "@/app/actions";
import { HOLDERS, HOLDER_LABEL, holderLine, owedLine, tt, type Holder } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";
import type { CashCheckRow, Ledger } from "@/lib/db";
import { Explain } from "./explain";

const inputCls =
  "w-full bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] px-3 py-2 text-sm text-[#1B2533] placeholder:text-[#8B9AB0] focus:outline-none focus:border-[#94A3B8] transition-colors";
const selectCls = inputCls + " cursor-pointer";
const cardCls = "bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-5";
const titleCls = "text-[10px] text-[#5A6678] font-medium tracking-wider uppercase";
const buttonCls =
  "min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-[4px] bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 hover:bg-[#1D4ED8]/20 disabled:opacity-40 transition-colors";
const textButtonCls =
  "min-h-11 sm:min-h-0 text-[11px] text-[#5A6678] hover:text-[#0E1A2B] disabled:opacity-40 transition-colors";

const day = (s: string) => format(parseISO(s.slice(0, 10)), "d MMM");

/** Runs a ledger action; toasts and returns the error message, or null on success. */
export async function runAction(fn: () => Promise<ActionResult>, fallback: string): Promise<string | null> {
  try {
    const res = await fn();
    if (res.error) {
      toast.error(res.error);
      return res.error;
    }
    return null;
  } catch {
    toast.error(fallback);
    return fallback;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#5A6678] mb-1">{label}</span>
      {children}
    </label>
  );
}

function SubmitRow({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  return (
    <div className="flex gap-2 justify-end mt-6">
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] font-semibold disabled:opacity-40 transition-colors"
        style={{ background: "#1D4ED8", color: "#000" }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function HolderSelect({ name, defaultValue }: { name: string; defaultValue: Holder }) {
  return (
    <select name={name} className={selectCls} defaultValue={defaultValue}>
      {HOLDERS.map((h) => (
        <option key={h} value={h}>
          {HOLDER_LABEL[h]}
        </option>
      ))}
    </select>
  );
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fromLoc = fd.get("fromLoc") as Holder;
    const toLoc = fd.get("toLoc") as Holder;
    const amount = parseFloat(fd.get("amount") as string);
    const movedAt = fd.get("movedAt") as string;
    const note = ((fd.get("note") as string) || "").trim() || null;
    if (fromLoc === toLoc) return setError("From and to must be different holders.");
    if (!(amount > 0)) return setError("Amount must be more than zero.");
    if (!movedAt) return setError("Pick a date.");
    setError(null);
    start(async () => {
      const err = await runAction(
        () => recordTransferAction({ movedAt, fromLoc, toLoc, amount, note }),
        "Failed to record transfer",
      );
      if (err) return setError(err);
      toast.success("Transfer recorded");
      onClose();
    });
  }

  return (
    <ModalShell title="Record transfer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <HolderSelect name="fromLoc" defaultValue="zane" />
          </Field>
          <Field label="To">
            <HolderSelect name="toLoc" defaultValue="mikey" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (TT$)">
            <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Date">
            <input name="movedAt" type="date" required defaultValue={today()} className={inputCls} />
          </Field>
        </div>
        <Field label="Note">
          <input name="note" placeholder="Optional" className={inputCls} />
        </Field>
        {error && <p className="text-xs text-[#B23A0A]">{error}</p>}
        <SubmitRow pending={pending} onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function CountModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const location = fd.get("location") as Holder;
    const raw = fd.get("amount") as string;
    const amount = parseFloat(raw);
    const countedAt = fd.get("countedAt") as string;
    const note = ((fd.get("note") as string) || "").trim() || null;
    if (raw === "" || !(amount >= 0)) return setError("Enter the amount counted, zero or more.");
    if (!countedAt) return setError("Pick a date.");
    setError(null);
    start(async () => {
      const err = await runAction(
        () => recordCashCountAction({ countedAt, location, amount, note }),
        "Failed to save count",
      );
      if (err) return setError(err);
      toast.success("Count saved");
      onClose();
    });
  }

  return (
    <ModalShell title="Enter cash count" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Holder">
          <HolderSelect name="location" defaultValue="mikey" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount counted (TT$)">
            <input name="amount" type="number" step="0.01" min="0" required placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Date">
            <input name="countedAt" type="date" required defaultValue={today()} className={inputCls} />
          </Field>
        </div>
        <Field label="Note">
          <input name="note" placeholder="Optional" className={inputCls} />
        </Field>
        {error && <p className="text-xs text-[#B23A0A]">{error}</p>}
        <SubmitRow pending={pending} onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function VariancePill({ variance }: { variance: number }) {
  if (variance === 0) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 font-medium">
        Matches
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#B45309]/10 text-[#B45309] border border-[#B45309]/20 font-medium tabular-nums">
      {tt(Math.abs(variance))} {variance < 0 ? "short" : "over"}
    </span>
  );
}

function CashCheckItem({ row }: { row: CashCheckRow }) {
  const [pending, start] = useTransition();
  const counted = row.counted !== null && row.countedAt !== null;

  function undo() {
    if (!window.confirm(`Undo the last count for ${HOLDER_LABEL[row.location]}?`)) return;
    start(async () => {
      const err = await runAction(() => deleteLatestCashCountAction(row.location), "Failed to undo count");
      if (!err) toast.success("Count removed");
    });
  }

  return (
    <div className="py-2.5 border-t border-[#EEF1F5] first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[#1B2533]">{HOLDER_LABEL[row.location]}</span>
        {counted && row.variance !== null && <VariancePill variance={row.variance} />}
      </div>
      {counted ? (
        <div className="mt-1 space-y-0.5 text-xs text-[#5A6678]">
          <p>
            Counted {tt(row.counted!)} on {day(row.countedAt!)}
            {row.expected !== null && <>, expected {tt(row.expected)}</>}
          </p>
          {row.expected !== row.expectedNow && <p>Expected now {tt(row.expectedNow)}</p>}
          <button type="button" onClick={undo} disabled={pending} className={textButtonCls}>
            {pending ? "Undoing…" : "Undo last count"}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-[#5A6678]">
          Not counted yet, expected now {tt(row.expectedNow)}
        </p>
      )}
    </div>
  );
}

function TransferRow({ id, label, movedAt, amount, createdBy }: {
  id: string;
  label: string;
  movedAt: string;
  amount: number;
  createdBy: string | null;
}) {
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm("Delete this transfer?")) return;
    start(async () => {
      const err = await runAction(() => deleteTransferAction(id), "Failed to delete transfer");
      if (!err) toast.success("Transfer deleted");
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0">
        <p className="text-[#334155] truncate">
          {day(movedAt)}, {label}
        </p>
        {createdBy && <p className="text-[10px] text-[#6B7789] truncate">by {createdBy}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[#1B2533] tabular-nums">{tt(amount)}</span>
        <button type="button" onClick={remove} disabled={pending} className={`${textButtonCls} hover:text-[#B23A0A]`}>
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}

export function CashPanel({ ledger }: { ledger: Ledger }) {
  const [modal, setModal] = useState<"transfer" | "count" | null>(null);

  const owed = owedLine(ledger.owedToFounders);
  const transfers = ledger.movements
    .filter((m) => m.kind === "transfer")
    .sort((a, b) => b.movedAt.localeCompare(a.movedAt))
    .slice(0, 5);
  const checkRows = ledger.cashCheck.filter((r) => r.counted !== null || r.expectedNow !== 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={titleCls}>Business cash (safe)</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${ledger.cash.business < 0 ? "text-[#B23A0A]" : "text-[#1B2533]"}`}>
              {tt(ledger.cash.business)}
            </p>
            <p className="text-xs text-[#5A6678] mt-1">
              All money {tt(ledger.cash.total)}: {holderLine(ledger.cash)}
            </p>
          </div>
          <button type="button" onClick={() => setModal("transfer")} className={buttonCls}>
            Record transfer
          </button>
        </div>
        <Explain
          className="mt-3"
          shows="Where all the business's money physically is: the safe (business cash) and money Mikey or Zane is holding that has not been sorted yet."
          read="Each balance is every payment collected, plus transfers in, minus transfers out, expenses and founder pay paid from that place. Record a transfer whenever money changes hands."
          watch="A balance should never go below zero. Money sitting with a founder for long should be handed over or put in the safe."
        />

        <div className="mt-4 space-y-1.5">
          {HOLDERS.map((h) => (
            <div key={h} className="flex justify-between text-xs">
              <span className="text-[#4A5568]">{HOLDER_LABEL[h]}</span>
              <span className={`tabular-nums ${ledger.cash[h] < 0 ? "text-[#B23A0A]" : "text-[#1B2533]"}`}>
                {tt(ledger.cash[h])}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#5A6678] mt-3 pt-3 border-t border-[#EEF1F5]">
          {owed
            ? `Owed to founders: ${owed}`
            : "Nothing owed to founders"}
        </p>

        <div className="mt-4">
          <p className={titleCls}>Recent transfers</p>
          {transfers.length === 0 ? (
            <p className="text-xs text-[#6B7789] mt-2">No transfers yet</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {transfers.map((m) => (
                <TransferRow
                  key={m.id}
                  id={m.id}
                  label={`${m.fromLoc ? HOLDER_LABEL[m.fromLoc] : "Unknown"} to ${m.toLoc ? HOLDER_LABEL[m.toLoc] : "Unknown"}`}
                  movedAt={m.movedAt}
                  amount={m.amount}
                  createdBy={m.createdBy}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={titleCls}>Cash check</p>
            <p className="text-xs text-[#5A6678] mt-1">Counted cash against what the books expect</p>
            <Explain
              className="mt-2"
              shows="The last time each person counted the money they hold, against what the dashboard says they should have."
              read="Expected is what the books said on the day of the count; Expected now is what they say today. Matches means the count agreed with the books."
              watch="A count that does not match means a payment, transfer or expense was not recorded. Find it before recording anything else."
            />
          </div>
          <button type="button" onClick={() => setModal("count")} className={buttonCls}>
            Enter count
          </button>
        </div>
        <div className="mt-3">
          {checkRows.length === 0 ? (
            <p className="text-xs text-[#6B7789]">No cash held or counted yet</p>
          ) : (
            checkRows.map((row) => <CashCheckItem key={row.location} row={row} />)
          )}
        </div>
      </div>

      {modal === "transfer" && <TransferModal onClose={() => setModal(null)} />}
      {modal === "count" && <CountModal onClose={() => setModal(null)} />}
    </div>
  );
}
