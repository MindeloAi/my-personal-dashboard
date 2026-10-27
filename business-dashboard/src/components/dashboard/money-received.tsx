"use client";

// Money received: every collection, who it came from, and where its money has
// to go. Zane hands what he collects to Mikey, Mikey puts the business share in
// the safe (business cash), gives Zane his payout and keeps his own. Every
// figure comes from the collections view (migration 016); this only renders it
// and records the moves.

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  deleteTransferAction,
  markPayoutPaidOutAction,
  recordTransferAction,
  undoPayoutPaidOutAction,
} from "@/app/actions";
import { runAction } from "@/components/dashboard/cash-panel";
import { HOLDER_LABEL, tt, type Founder, type Holder } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";
import type { Collection, Ledger } from "@/lib/db";

const cardCls = "bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5";
const titleCls = "text-[10px] text-zinc-500 font-medium tracking-wider uppercase";
const actionCls =
  "min-h-11 sm:min-h-0 text-[11px] px-2.5 py-1 rounded-lg bg-[#bfff3a]/10 text-[#bfff3a] border border-[#bfff3a]/20 hover:bg-[#bfff3a]/20 disabled:opacity-40 transition-colors";
const undoCls = "min-h-11 sm:min-h-0 text-[11px] text-zinc-500 hover:text-white disabled:opacity-40 transition-colors";

const day = (s: string) => format(parseISO(s.slice(0, 10)), "d MMM yyyy");

/** Where this collection's unsorted money is once Zane has handed it over. */
const heldBy = (c: Collection): Holder => (c.receivedBy === "business" ? "business" : "mikey");

type Step = {
  label: string;
  amount: number;
  /** Set when part of it has already moved. */
  left?: number;
  done: boolean;
  doneText: string;
  action?: { label: string; run: () => Promise<string | null> };
  undo?: () => Promise<string | null>;
};

function steps(c: Collection, ledger: Ledger): Step[] {
  const from = heldBy(c);
  // Nothing is shared out until Zane has passed the money to Mikey.
  const waiting = c.receivedBy === "zane" && c.handoverDue > 0;
  const moves = ledger.movements.filter((m) => m.paymentId === c.paymentId);
  const lastMove = (to: Holder) => moves.find((m) => m.toLoc === to); // newest first
  const payout = (f: Founder) => ledger.payouts.find((p) => p.paymentId === c.paymentId && p.founder === f);
  const move = (fromLoc: Holder, toLoc: Holder, amount: number) => () =>
    runAction(
      () => recordTransferAction({ movedAt: today(), fromLoc, toLoc, amount, note: null, paymentId: c.paymentId }),
      "Failed to record the move",
    );
  const undoMove = (to: Holder) => {
    const m = lastMove(to);
    return m ? () => runAction(() => deleteTransferAction(m.id), "Failed to undo") : undefined;
  };

  const out: Step[] = [];
  if (c.receivedBy === "zane") {
    out.push({
      label: "Zane hands to Mikey",
      amount: c.amount,
      left: c.handoverDue,
      done: c.handoverDue === 0,
      doneText: "Handed over",
      action: c.handoverDue > 0 ? { label: "Mark handed over", run: move("zane", "mikey", c.handoverDue) } : undefined,
      undo: undoMove("mikey"),
    });
  }
  out.push({
    label: "Into business cash",
    amount: c.businessShare,
    left: c.businessDue,
    done: c.businessDue === 0,
    doneText: c.receivedBy === "business" ? "Paid straight in" : "In the safe",
    action:
      c.businessDue > 0 && !waiting
        ? { label: "Put in business cash", run: move(from, "business", c.businessDue) }
        : undefined,
    undo: c.receivedBy === "business" ? undefined : undoMove("business"),
  });
  for (const [founder, label, doneText] of [
    ["zane", "Give Zane", "Given to Zane"],
    ["michael", "Mikey keeps", "Kept"],
  ] as const) {
    const p = payout(founder);
    if (!p) continue;
    out.push({
      label,
      amount: p.total,
      done: p.status === "paid_out",
      doneText: p.paidFrom ? `${doneText}, from ${HOLDER_LABEL[p.paidFrom]}` : doneText,
      action:
        p.status === "due" && !waiting
          ? {
              label: founder === "zane" ? "Mark given" : "Mark kept",
              run: () => runAction(() => markPayoutPaidOutAction(p.id, today(), from), "Failed to mark paid out"),
            }
          : undefined,
      undo:
        p.status === "paid_out"
          ? () => runAction(() => undoPayoutPaidOutAction(p.id), "Failed to undo")
          : undefined,
    });
  }
  return out;
}

function StepRow({ step }: { step: Step }) {
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<string | null>, ok: string) =>
    start(async () => {
      if (!(await fn())) toast.success(ok);
    });

  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <div className="min-w-0">
        <span className={step.done ? "text-zinc-500" : "text-zinc-200"}>{step.label}</span>
        <span className={`ml-2 tabular-nums ${step.done ? "text-zinc-500" : "text-white font-medium"}`}>
          {tt(step.amount)}
        </span>
        {!step.done && step.left !== undefined && step.left < step.amount && (
          <span className="ml-2 text-[11px] text-[#fbbf24] tabular-nums">{tt(step.left)} still to go</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {step.done ? (
          <>
            <span className="text-[11px] text-[#bfff3a]">{step.doneText}</span>
            {step.undo && (
              <button
                type="button"
                disabled={pending}
                className={undoCls}
                onClick={() => window.confirm(`Undo "${step.label}"?`) && go(step.undo!, "Undone")}
              >
                Undo
              </button>
            )}
          </>
        ) : step.action ? (
          <button type="button" disabled={pending} className={actionCls} onClick={() => go(step.action!.run, "Saved")}>
            {pending ? "Saving…" : step.action.label}
          </button>
        ) : (
          <span className="text-[11px] text-zinc-600">After handover</span>
        )}
      </div>
    </li>
  );
}

function CollectionItem({ c, ledger }: { c: Collection; ledger: Ledger }) {
  const list = steps(c, ledger);
  const open = list.some((s) => !s.done);
  const who = c.client ?? "No client";

  return (
    <li className="py-4 border-t border-[#1f242a] first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white font-medium">
            {who}
            {c.project && <span className="text-zinc-400 font-normal"> · {c.project}</span>}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {day(c.paidAt)} · {c.invoiceNumber ?? "No invoice no."} · collected by {HOLDER_LABEL[c.receivedBy]}
            {c.method && ` · ${c.method}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base text-white font-semibold tabular-nums">{tt(c.amount)}</p>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              open
                ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20"
                : "bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20"
            }`}
          >
            {open ? "To sort" : "Sorted"}
          </span>
        </div>
      </div>

      {(c.invoiceNotes || c.note) && (
        <div className="mt-2 border-l-2 border-[#bfff3a]/40 pl-3 space-y-1">
          {c.invoiceNotes && <p className="text-sm text-zinc-200 whitespace-pre-line break-words">{c.invoiceNotes}</p>}
          {c.note && (
            <p className="text-sm text-zinc-300 whitespace-pre-line break-words">
              <span className="text-zinc-500">Payment note: </span>
              {c.note}
            </p>
          )}
        </div>
      )}

      <ul className="mt-2 bg-[#0b0d10] rounded-xl px-3 py-1 divide-y divide-[#1f242a]">
        {list.map((s) => (
          <StepRow key={s.label} step={s} />
        ))}
      </ul>
    </li>
  );
}

export function MoneyReceived({ ledger }: { ledger: Ledger }) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const { toSort } = ledger;
  const rows = onlyOpen
    ? ledger.collections.filter((c) => steps(c, ledger).some((s) => !s.done))
    : ledger.collections;

  const tiles = [
    { label: "Zane to hand over", value: toSort.handover },
    { label: "Put in business cash", value: toSort.business },
    { label: "Give Zane", value: toSort.giveZane },
    { label: "Mikey keeps", value: toSort.mikeyKeeps },
  ];

  return (
    <section className={cardCls} aria-labelledby="money-received-title">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p id="money-received-title" className={titleCls}>Money received</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-white">{tt(toSort.received)}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {ledger.collections.length} payment{ledger.collections.length === 1 ? "" : "s"} since the ledger started
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer min-h-11 sm:min-h-0">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#bfff3a]" />
          Only still to sort
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-[#0b0d10] rounded-xl px-3 py-2.5">
            <p className="text-[11px] text-zinc-500">{t.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${t.value > 0 ? "text-[#fbbf24]" : "text-zinc-500"}`}>
              {tt(t.value)}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 mt-4">
          {onlyOpen ? "Everything received has been sorted." : "No payments recorded yet."}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((c) => (
            <CollectionItem key={c.paymentId} c={c} ledger={ledger} />
          ))}
        </ul>
      )}
    </section>
  );
}
