"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { markPayoutPaidOutAction, undoPayoutPaidOutAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Ledger, Payout } from "@/lib/db";
import { FOUNDERS, FOUNDER_LABEL, HOLDERS, HOLDER_LABEL, tt, type Founder, type Holder } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";

const inputCls = "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

/** Where the money for this payout is: Zane keeps his share of what he collected. */
const defaultFrom = (p: Payout): Holder =>
  p.receivedBy === "business" ? "business" : p.receivedBy === "zane" && p.founder === "zane" ? "zane" : "mikey";

type FounderFilter = "all" | Founder;
type StatusFilter = "all" | Payout["status"];

const monthLabel = (m: string) => format(parseISO(`${m}-01`), "MMM yyyy");
const dayLabel = (d: string) => format(parseISO(d), "d MMM yyyy");

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 bg-[#0b0d10] rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === o.value ? "bg-[#bfff3a] text-black" : "text-zinc-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Payout["status"] }) {
  return status === "due" ? (
    <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20">Due</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20">Paid out</span>
  );
}

function PaidOutModal({ payout, onClose }: { payout: Payout; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A negative payout is a split correction: the founder returns money to a pot.
  const back = payout.total < 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const from = fd.get("from") as string;
    setError(null);
    start(async () => {
      try {
        const res = await markPayoutPaidOutAction(payout.id, date, from);
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success(`${payout.number} marked paid out`);
        onClose();
      } catch {
        setError("Could not save. Try again.");
        toast.error("Could not mark the payout paid out");
      }
    });
  }

  return (
    <ModalShell title={`Mark ${payout.number} ${back ? "paid back" : "paid out"}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-zinc-400">
          {back
            ? `${FOUNDER_LABEL[payout.founder]} pays back ${tt(-payout.total)} (a split correction)`
            : `${FOUNDER_LABEL[payout.founder]}, ${tt(payout.total)}`}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-date" className="text-xs text-zinc-400">{back ? "Date paid back" : "Date paid out"}</label>
            <input id="payout-date" name="date" type="date" required defaultValue={today()} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-from" className="text-xs text-zinc-400">{back ? "Paid back to" : "Paid from"}</label>
            <select id="payout-from" name="from" defaultValue={defaultFrom(payout)} className={selectCls}>
              {HOLDERS.map((h) => (
                <option key={h} value={h}>{HOLDER_LABEL[h]}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-[#ff4d8b]">{error}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={onClose} className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80">
            {pending ? "Saving..." : back ? "Mark paid back" : "Mark paid out"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function UndoButton({ payout }: { payout: Payout }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Move this payout back to due?")) return;
        start(async () => {
          try {
            const res = await undoPayoutPaidOutAction(payout.id);
            if (res.error) toast.error(res.error);
            else toast.success(`${payout.number} moved back to due`);
          } catch {
            toast.error("Could not undo the payout");
          }
        });
      }}
      className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 text-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
    >
      {pending ? "Undoing..." : "Undo"}
    </button>
  );
}

function ProjectedEarnings({ projection }: { projection: Ledger["projection"] }) {
  const count = projection.invoices.length;
  if (count === 0 && projection.michael.dueNow === 0 && projection.zane.dueNow === 0) return null;
  return (
    <div className="mb-6">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Projected earnings</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FOUNDERS.map((f) => {
          const p = projection[f];
          return (
            <div key={f} className="bg-[#0b0d10] border border-[#2a2e34] rounded-xl p-4">
              <p className="text-xs text-zinc-400">{FOUNDER_LABEL[f]}</p>
              <p className="text-2xl font-bold text-white tabular-nums mt-1">{tt(p.outlook)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {tt(p.total)} from {count} unpaid {count === 1 ? "invoice" : "invoices"}
                {p.dueNow > 0 && <>, plus <span className="text-[#fbbf24]">{tt(p.dueNow)} due now</span></>}
              </p>
              {p.total > 0 && (
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Base {tt(p.base)}, bonus {tt(p.bonus)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {projection.unassignedBonus > 0 && (
        <p className="text-xs text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-xl px-3 py-2 mt-3 leading-relaxed">
          {tt(projection.unassignedBonus)} of bonus pool is not assigned yet: {projection.invoicesWithoutShares}{" "}
          {projection.invoicesWithoutShares === 1 ? "invoice has" : "invoices have"} no bonus shares. Set them on each invoice
          to include it.
        </p>
      )}
      {count > 0 && (
        <details className="mt-3 group">
          <summary className="min-h-11 sm:min-h-0 flex items-center text-xs text-zinc-400 hover:text-white cursor-pointer select-none">
            By invoice
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
                  <th className="text-left pb-2 font-medium whitespace-nowrap">Invoice</th>
                  <th className="text-left pb-2 font-medium whitespace-nowrap pl-4">Due</th>
                  <th className="text-right pb-2 font-medium whitespace-nowrap pl-4">Still owed</th>
                  <th className="text-right pb-2 font-medium whitespace-nowrap pl-4">Michael</th>
                  <th className="text-right pb-2 font-medium whitespace-nowrap pl-4">Zane</th>
                  <th className="text-right pb-2 font-medium whitespace-nowrap pl-4">Unassigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2e34]">
                {projection.invoices.map((i) => (
                  <tr key={i.invoiceId} className="text-xs">
                    <td className="py-2 font-mono text-zinc-300 whitespace-nowrap">{i.invoiceNumber ?? "None"}</td>
                    <td className={`py-2 pl-4 whitespace-nowrap ${i.overdue ? "text-[#ff4d8b]" : "text-zinc-400"}`}>
                      {i.dueDate ? dayLabel(i.dueDate) : "None"}
                      {i.overdue && " (overdue)"}
                    </td>
                    <td className="py-2 pl-4 text-right text-zinc-300 whitespace-nowrap">{tt(i.remaining)}</td>
                    <td className="py-2 pl-4 text-right text-white whitespace-nowrap">{tt(i.michael)}</td>
                    <td className="py-2 pl-4 text-right text-white whitespace-nowrap">{tt(i.zane)}</td>
                    <td className={`py-2 pl-4 text-right whitespace-nowrap ${i.unassignedBonus > 0 ? "text-[#fbbf24]" : "text-zinc-600"}`}>
                      {i.unassignedBonus > 0 ? tt(i.unassignedBonus) : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export function FounderPay({ ledger }: { ledger: Ledger }) {
  const [founder, setFounder] = useState<FounderFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [month, setMonth] = useState<string>("all");
  const [paying, setPaying] = useState<Payout | null>(null);

  const months = [
    ...new Set([...ledger.payouts.map((p) => p.paidAt.slice(0, 7)), ...ledger.founderPay.map((r) => r.month)]),
  ].sort((a, b) => b.localeCompare(a));

  const payouts = ledger.payouts
    .filter((p) => founder === "all" || p.founder === founder)
    .filter((p) => status === "all" || p.status === status)
    .filter((p) => month === "all" || p.paidAt.slice(0, 7) === month)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.number.localeCompare(a.number));

  const summary = ledger.founderPay
    .filter((r) => founder === "all" || r.founder === founder)
    .filter((r) => month === "all" || r.month === month)
    .sort((a, b) => b.month.localeCompare(a.month) || FOUNDERS.indexOf(a.founder) - FOUNDERS.indexOf(b.founder));

  const dueTotal = payouts.filter((p) => p.status === "due").reduce((s, p) => s + p.total, 0);

  return (
    <div id="founder-pay" className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Founder pay</p>
        {dueTotal > 0 && <span className="text-xs text-[#fbbf24] font-semibold">{tt(dueTotal)} due</span>}
      </div>

      <ProjectedEarnings projection={ledger.projection} />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Pills<FounderFilter>
          label="Founder"
          value={founder}
          onChange={setFounder}
          options={[{ value: "all", label: "All" }, ...FOUNDERS.map((f) => ({ value: f, label: FOUNDER_LABEL[f] }))]}
        />
        <Pills<StatusFilter>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "due", label: "Due" },
            { value: "paid_out", label: "Paid out" },
          ]}
        />
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-h-11 sm:min-h-0 bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-1.5 text-xs text-zinc-300 cursor-pointer focus:outline-none focus:border-zinc-500 transition-colors"
        >
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {summary.length > 0 && (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
                <th className="text-left pb-3 font-medium whitespace-nowrap">Month</th>
                <th className="text-left pb-3 font-medium whitespace-nowrap">Founder</th>
                <th className="text-right pb-3 font-medium whitespace-nowrap">Due</th>
                <th className="text-right pb-3 font-medium whitespace-nowrap pl-4">Paid out</th>
                <th className="text-right pb-3 font-medium whitespace-nowrap pl-4">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e34]">
              {summary.map((r) => (
                <tr key={`${r.month}-${r.founder}`} className="text-xs">
                  <td className="py-2.5 text-zinc-400 whitespace-nowrap">{monthLabel(r.month)}</td>
                  <td className="py-2.5 text-zinc-300 whitespace-nowrap">{FOUNDER_LABEL[r.founder]}</td>
                  <td className={`py-2.5 text-right whitespace-nowrap ${r.due > 0 ? "text-[#fbbf24]" : "text-zinc-500"}`}>{tt(r.due)}</td>
                  <td className="py-2.5 text-right whitespace-nowrap pl-4 text-zinc-300">{tt(r.paidOut)}</td>
                  <td className="py-2.5 text-right whitespace-nowrap pl-4 font-semibold text-white">{tt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
              <th className="text-left pb-3 font-medium whitespace-nowrap">Number</th>
              <th className="text-left pb-3 font-medium whitespace-nowrap pl-4">Founder</th>
              <th className="text-left pb-3 font-medium whitespace-nowrap pl-4">Came from</th>
              <th className="hidden sm:table-cell text-right pb-3 font-medium whitespace-nowrap pl-4">Base</th>
              <th className="hidden sm:table-cell text-right pb-3 font-medium whitespace-nowrap pl-4">Bonus</th>
              <th className="text-right pb-3 font-medium whitespace-nowrap pl-4">Total</th>
              <th className="text-left pb-3 font-medium whitespace-nowrap pl-6">Status</th>
              <th className="text-left pb-3 font-medium whitespace-nowrap pl-4">Paid out</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2e34]">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-zinc-600 text-sm">
                  {ledger.payouts.length === 0 ? "No founder payouts yet" : "No payouts match these filters"}
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors text-xs">
                  <td className="py-3 text-zinc-300 font-medium whitespace-nowrap">{p.number}</td>
                  <td className="py-3 pl-4 text-zinc-300 whitespace-nowrap">{FOUNDER_LABEL[p.founder]}</td>
                  <td className="py-3 pl-4 min-w-[16rem] max-w-md align-top">
                    <p className="text-zinc-200 font-medium">
                      {p.client ?? "No client"}
                      {p.project && <span className="text-zinc-400 font-normal"> · {p.project}</span>}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {p.invoiceNumber ?? "No invoice no."} · collected {tt(p.paymentAmount)} on {dayLabel(p.paidAt)}
                      {p.invoiceAmount != null && p.invoiceAmount !== p.paymentAmount && ` (invoice ${tt(p.invoiceAmount)})`}
                    </p>
                    {p.invoiceNotes && (
                      <p className="text-[11px] text-zinc-300 mt-1 border-l-2 border-[#bfff3a]/40 pl-2 whitespace-pre-line break-words">
                        {p.invoiceNotes}
                      </p>
                    )}
                  </td>
                  <td className="hidden sm:table-cell py-3 pl-4 text-right text-zinc-400 whitespace-nowrap">{tt(p.base)}</td>
                  <td className="hidden sm:table-cell py-3 pl-4 text-right text-zinc-400 whitespace-nowrap">{tt(p.bonus)}</td>
                  <td className={`py-3 pl-4 text-right font-semibold whitespace-nowrap ${p.total < 0 ? "text-[#ff4d8b]" : "text-white"}`}>
                    {tt(p.total)}
                    {p.total < 0 && <span className="block text-[10px] font-normal text-zinc-500">pays back</span>}
                  </td>
                  <td className="py-3 pl-6 whitespace-nowrap"><StatusPill status={p.status} /></td>
                  <td className="py-3 pl-4 text-zinc-400 whitespace-nowrap">
                    {p.status === "paid_out" && p.paidOutAt ? (
                      <>
                        {dayLabel(p.paidOutAt)}
                        {p.paidFrom && <span className="block text-[10px] text-zinc-600">from {HOLDER_LABEL[p.paidFrom]}</span>}
                      </>
                    ) : (
                      <span className="text-zinc-600">Not yet</span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-right whitespace-nowrap">
                    {p.status === "due" ? (
                      <button
                        type="button"
                        onClick={() => setPaying(p)}
                        className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-lg border border-[#bfff3a]/30 text-[#bfff3a] hover:bg-[#bfff3a]/10 transition-colors"
                      >
                        {p.total < 0 ? "Mark paid back" : "Mark paid out"}
                      </button>
                    ) : (
                      <UndoButton payout={p} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paying && <PaidOutModal payout={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
