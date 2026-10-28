"use client";

// Money received: every collection, who it came from, and where its money has
// to go. Zane hands what he collects to Mikey, Mikey puts the business share in
// the safe (business cash), gives Zane his payout and keeps his own. Every
// figure comes from the collections view (migration 016); this only renders it
// and records the moves.

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { doCollectionStepAction, setCollectorAction, undoCollectionStepAction } from "@/app/actions";
import { runAction } from "@/components/dashboard/cash-panel";
import { FOUNDER_LABEL, HOLDERS, HOLDER_LABEL, tt, type Founder, type Holder } from "@/lib/ledger";
import type { Collection, CollectionStep, Ledger } from "@/lib/db";
import { Explain } from "./explain";
import Link from "next/link";
import { href, linksFor, type Graph } from "@/lib/record-graph";

const cardCls = "bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-5";
const titleCls = "text-[10px] text-[#5A6678] font-medium tracking-wider uppercase";
const actionCls =
  "min-h-11 sm:min-h-0 text-[11px] px-2.5 py-1 rounded-[4px] bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 hover:bg-[#1D4ED8]/20 disabled:opacity-40 transition-colors";
const undoCls = "min-h-11 sm:min-h-0 text-[11px] text-[#5A6678] hover:text-[#0E1A2B] disabled:opacity-40 transition-colors";

const day = (s: string) => format(parseISO(s.slice(0, 10)), "d MMM yyyy");

type Step = {
  label: string;
  amount: number;
  /** Set when part of it has already moved. */
  left?: number;
  done: boolean;
  doneText: string;
  action?: { label: string; run: () => Promise<string | null> };
  undo?: () => Promise<string | null>;
  /** Later steps the undo takes with it, for the confirm message. */
  undoAlso?: string[];
};

// Every step and undo is one server transaction (db.ts doCollectionStep /
// undoCollectionStep): handing over also ticks Zane's share, putting the
// business share in the safe also ticks Mikey's, and an undo takes every step
// that depended on it.
function steps(c: Collection, ledger: Ledger): Step[] {
  const zaneCollected = c.receivedBy === "zane";
  // Nothing is shared out until Zane has passed the money to Mikey.
  const waiting = zaneCollected && c.handoverDue > 0;
  const moved = (to: Holder) => ledger.movements.some((m) => m.paymentId === c.paymentId && m.toLoc === to);
  const payouts = (f: Founder) => ledger.payouts.filter((p) => p.paymentId === c.paymentId && p.founder === f);
  const paid = (f: Founder) => payouts(f).some((p) => p.status === "paid_out");
  const act = (step: CollectionStep) => () =>
    runAction(() => doCollectionStepAction(c.paymentId, step), "Failed to save");
  const undo = (step: CollectionStep) => () =>
    runAction(() => undoCollectionStepAction(c.paymentId, step), "Failed to undo");

  const zaneLabel = zaneCollected ? "Zane keeps his share" : "Give Zane";
  const out: Step[] = [];
  if (zaneCollected) {
    // He keeps his own share and sends Mikey the rest (018).
    out.push({
      label: "Zane hands to Mikey",
      amount: c.amount - c.zanePayout,
      left: c.handoverDue,
      done: c.handoverDue === 0,
      doneText: "Handed over",
      action: c.handoverDue > 0 ? { label: "Mark handed over", run: act("handover") } : undefined,
      undo: moved("mikey") ? undo("handover") : undefined,
      undoAlso: [
        ...(moved("business") ? ["Into business cash"] : []),
        ...(paid("michael") ? ["Mikey keeps"] : []),
      ],
    });
  }
  out.push({
    label: "Into business cash",
    amount: c.businessShare,
    left: c.businessDue,
    done: c.businessDue === 0,
    doneText: c.receivedBy === "business" ? "Paid straight in" : "In the safe",
    action: c.businessDue > 0 && !waiting ? { label: "Put in business cash", run: act("business") } : undefined,
    undo: moved("business") ? undo("business") : undefined,
    undoAlso: paid("michael") ? ["Mikey keeps"] : [],
  });
  for (const [founder, label, doneText] of [
    [ "zane", zaneLabel, zaneCollected ? "Kept by Zane" : "Given to Zane"] as const,
    ["michael", "Mikey keeps", "Kept"] as const,
  ]) {
    // Zane's share of what he collected never leaves him, so it does not wait.
    const blocked = waiting && !(zaneCollected && founder === "zane");
    // Newest first. More than one when a split was changed after paying out
    // (017): the extra one is a correction, negative if he was overpaid.
    const rows = payouts(founder);
    if (rows.length === 0) continue;
    const due = rows.filter((p) => p.status === "due");
    const lastPaid = rows.find((p) => p.status === "paid_out");
    const left = due.reduce((s, p) => s + p.total, 0);
    out.push({
      label,
      amount: founder === "zane" ? c.zanePayout : c.michaelPayout,
      left,
      done: due.length === 0,
      doneText: lastPaid?.paidFrom ? `${doneText}, from ${HOLDER_LABEL[lastPaid.paidFrom]}` : doneText,
      action:
        due.length > 0 && !blocked
          ? {
              label:
                left < 0
                  ? `${FOUNDER_LABEL[founder]} paid back ${tt(-left)}`
                  : founder === "zane" && !zaneCollected
                    ? "Mark given"
                    : "Mark kept",
              run: act(founder),
            }
          : undefined,
      undo: lastPaid ? undo(founder) : undefined,
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
        <span className={step.done ? "text-[#5A6678]" : "text-[#1B2533]"}>{step.label}</span>
        <span className={`ml-2 tabular-nums ${step.done ? "text-[#5A6678]" : "text-[#1B2533] font-medium"}`}>
          {tt(step.amount)}
        </span>
        {!step.done && step.left !== undefined && step.left < step.amount && (
          <span className={`ml-2 text-[11px] tabular-nums ${step.left < 0 ? "text-[#B23A0A]" : "text-[#B45309]"}`}>
            {step.left < 0 ? `overpaid, ${tt(-step.left)} to pay back` : `${tt(step.left)} still to go`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {step.done ? (
          <>
            <span className="text-[11px] text-[#1D4ED8]">{step.doneText}</span>
            {step.undo && (
              <button
                type="button"
                disabled={pending}
                className={undoCls}
                onClick={() =>
                  window.confirm(
                    step.undoAlso?.length
                      ? `Undo "${step.label}"? This also undoes: ${step.undoAlso.join(", ")}.`
                      : `Undo "${step.label}"?`,
                  ) && go(step.undo!, "Undone")
                }
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
          <span className="text-[11px] text-[#6B7789]">After handover</span>
        )}
      </div>
    </li>
  );
}

/** Who has this money. Fixable until any of it has been handed over or put in the safe. */
function CollectorSelect({ c, locked }: { c: Collection; locked: boolean }) {
  const [pending, start] = useTransition();
  if (locked) return <span className="text-[#334155]">{HOLDER_LABEL[c.receivedBy]}</span>;
  return (
    <select
      aria-label={`Who collected ${c.invoiceNumber ?? "this payment"}`}
      value={c.receivedBy}
      disabled={pending}
      onChange={(e) => {
        const holder = e.target.value as Holder;
        start(async () => {
          const err = await runAction(() => setCollectorAction(c.invoiceId, holder), "Failed to change who collected it");
          if (!err) toast.success(`Collected by ${HOLDER_LABEL[holder]}`);
        });
      }}
      className="min-h-11 sm:min-h-0 bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] px-2 py-0.5 text-[11px] text-[#1B2533] cursor-pointer hover:border-[#94A3B8] focus:outline-none focus:border-[#94A3B8] disabled:opacity-40"
    >
      {HOLDERS.map((h) => (
        <option key={h} value={h}>{HOLDER_LABEL[h]}</option>
      ))}
    </select>
  );
}

function CollectionItem({ c, ledger, graph }: { c: Collection; ledger: Ledger; graph?: Graph }) {
  const list = steps(c, ledger);
  const open = list.some((s) => !s.done);
  const who = c.client ?? "No client";
  // With the records loaded, the client, project and invoice are links.
  const r = graph ? linksFor("invoice", c.invoiceId, graph) : null;
  const linkCls = "hover:underline text-[#1D4ED8]";

  return (
    <li className="py-4 border-t border-[#EEF1F5] first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[#1B2533] font-medium">
            {r?.client ? <Link className={linkCls} href={href.client(r.client.id)}>{who}</Link> : who}
            {c.project && (
              <span className="text-[#4A5568] font-normal">
                {" · "}
                {r?.projects[0] ? <Link className={linkCls} href={href.project(r.projects[0].id)}>{c.project}</Link> : c.project}
              </span>
            )}
          </p>
          <p className="text-[11px] text-[#5A6678] mt-0.5">
            {day(c.paidAt)} ·{" "}
            {c.invoiceNumber ? <Link className={linkCls} href={href.invoice(c.invoiceId)}>{c.invoiceNumber}</Link> : "No invoice no."} · collected by{" "}
            <CollectorSelect c={c} locked={ledger.movements.some((m) => m.paymentId === c.paymentId)} />
            {c.method && ` · ${c.method}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base text-[#1B2533] font-semibold tabular-nums">{tt(c.amount)}</p>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              open
                ? "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20"
                : "bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20"
            }`}
          >
            {open ? "To sort" : "Sorted"}
          </span>
        </div>
      </div>

      {(c.invoiceNotes || c.note) && (
        <div className="mt-2 border-l-2 border-[#1D4ED8]/40 pl-3 space-y-1">
          {c.invoiceNotes && <p className="text-sm text-[#1B2533] whitespace-pre-line break-words">{c.invoiceNotes}</p>}
          {c.note && (
            <p className="text-sm text-[#334155] whitespace-pre-line break-words">
              <span className="text-[#5A6678]">Payment note: </span>
              {c.note}
            </p>
          )}
        </div>
      )}

      <ul className="mt-2 bg-[#F3F5F8] rounded-[4px] px-3 py-1 divide-y divide-[#EEF1F5]">
        {list.map((s) => (
          <StepRow key={s.label} step={s} />
        ))}
      </ul>
    </li>
  );
}

export function MoneyReceived({ ledger, graph }: { ledger: Ledger; graph?: Graph }) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const { toSort } = ledger;
  const rows = onlyOpen
    ? ledger.collections.filter((c) => steps(c, ledger).some((s) => !s.done))
    : ledger.collections;

  const tiles = [
    { label: "Zane to hand over", value: toSort.handover, note: "Collected by Zane, still to give Mikey: each payment minus Zane's share." },
    { label: "Put in business cash", value: toSort.business, note: "Business share of collected payments not in the safe yet." },
    { label: "Give Zane", value: toSort.giveZane, note: "Zane's founder pay still due from money Mikey holds." },
    { label: "Mikey keeps", value: toSort.mikeyKeeps, note: "Mikey's founder pay not yet marked as kept." },
  ];

  return (
    <section className={cardCls} aria-labelledby="money-received-title">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p id="money-received-title" className={titleCls}>Money received</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-[#1B2533]">{tt(toSort.received)}</p>
          <p className="text-xs text-[#5A6678] mt-1">
            {ledger.collections.length} payment{ledger.collections.length === 1 ? "" : "s"} since the ledger started
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#4A5568] cursor-pointer min-h-11 sm:min-h-0">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#1D4ED8]" />
          Only still to sort
        </label>
      </div>
      <Explain
        className="mt-3"
        shows="Every payment a client has made since the ledger started, and where each payment's money still has to go."
        read="Each payment shows its invoice and notes, who collected it, then its steps: hand over to Mikey, put the business share in the safe, pay each founder. A ticked step is done; undoing a step also undoes the steps after it."
        watch="Orange totals are money not sorted yet. Money left with Zane or Mikey for long should be handed over or put in the safe."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-[#F3F5F8] rounded-[4px] px-3 py-2.5">
            <p className="text-[11px] text-[#5A6678]">{t.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${t.value > 0 ? "text-[#B45309]" : "text-[#5A6678]"}`}>
              {tt(t.value)}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#5A6678]">{t.note}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[#6B7789] mt-4">
          {onlyOpen ? "Everything received has been sorted." : "No payments recorded yet."}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((c) => (
            <CollectionItem key={c.paymentId} c={c} ledger={ledger} graph={graph} />
          ))}
        </ul>
      )}
    </section>
  );
}
