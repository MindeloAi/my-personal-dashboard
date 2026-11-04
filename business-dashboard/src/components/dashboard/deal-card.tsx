"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { inputCls, selectCls } from "@/components/dashboard/clients-list";
import { saveDealAction } from "@/app/documents-actions";
import { PAYEES, PAYEE_LABEL, scheduleProblem, type Payee, type ScheduleLine } from "@/lib/documents";
import type { Deal } from "@/lib/documents-db";
import { tt } from "@/lib/ledger";

const label = "flex flex-col gap-1.5 text-xs text-[#4A5568]";
const dt = "text-xs text-[#5A6678]";
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
// Amounts stay as typed text while editing, so "1500." is not swallowed into "1500" mid-keystroke.
type DraftLine = { label: string; amount: string; trigger: string };

/** What we offered on this project. Every later document is built from it. */
export function DealCard({ projectId, deal, suggestedReference }: { projectId: string; deal: Deal | null; suggestedReference: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Deal{deal ? ` ${deal.reference}` : ""}</h2>
          <p className="mt-0.5 text-xs text-[#4A5568]">What we offered: scope, price, payments, care plan and deadline. Proposals, agreements and invoices are built from this.</p>
        </div>
        <button type="button" onClick={() => setEditing(true)}
          className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-3 py-2 text-xs font-semibold text-[#1B2533] transition-colors hover:bg-[#0E1A2B]/5">
          {deal ? "Edit deal" : "Set up the deal"}
        </button>
      </div>
      {deal ? (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className={dt}>Scope</dt><dd>{deal.scope.length ? <ul className="list-disc pl-5">{deal.scope.map((s, i) => <li key={i}>{s}</li>)}</ul> : "Not set"}</dd></div>
          <div><dt className={dt}>Price</dt><dd className="font-semibold">{deal.priceTotal != null ? tt(deal.priceTotal) : "Not set"}</dd></div>
          <div><dt className={dt}>Payments</dt><dd>{deal.paymentSchedule.length ? deal.paymentSchedule.map((l, i) => <p key={i}>{l.label}: {tt(l.amount)}, {l.trigger}</p>) : "Not split"}</dd></div>
          <div><dt className={dt}>Care plan</dt><dd>{deal.carePlan ? `${tt(deal.carePlan.monthlyAmount)} a month, ${deal.carePlan.minimumMonths} month minimum, then ${deal.carePlan.noticeDays} days' notice` : "None"}</dd></div>
          <div><dt className={dt}>Deadline</dt><dd>{deal.deadline ?? "None"}</dd></div>
          <div><dt className={dt}>Paid to</dt><dd>{deal.payeeDefault ? PAYEE_LABEL[deal.payeeDefault] : "Ask each time"}</dd></div>
          {deal.goals && <div className="sm:col-span-2"><dt className={dt}>Goals</dt><dd className="whitespace-pre-line">{deal.goals}</dd></div>}
          {deal.notes && <div className="sm:col-span-2"><dt className={dt}>Notes</dt><dd className="whitespace-pre-line">{deal.notes}</dd></div>}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[#6B7789]">No deal recorded for this project yet.</p>
      )}
      {editing && <DealModal projectId={projectId} deal={deal} suggestedReference={suggestedReference} onClose={() => setEditing(false)} />}
    </section>
  );
}

function DealModal({ projectId, deal, suggestedReference, onClose }: { projectId: string; deal: Deal | null; suggestedReference: string; onClose: () => void }) {
  const [reference, setReference] = useState(deal?.reference ?? suggestedReference);
  const [scope, setScope] = useState((deal?.scope ?? []).join("\n"));
  const [price, setPrice] = useState(deal?.priceTotal?.toString() ?? "");
  const [draft, setDraft] = useState<DraftLine[]>((deal?.paymentSchedule ?? []).map((l) => ({ ...l, amount: String(l.amount) })));
  const [care, setCare] = useState(!!deal?.carePlan);
  const [monthly, setMonthly] = useState(deal?.carePlan?.monthlyAmount.toString() ?? "");
  const [minimum, setMinimum] = useState(deal?.carePlan?.minimumMonths.toString() ?? "3");
  const [notice, setNotice] = useState(deal?.carePlan?.noticeDays.toString() ?? "30");
  const [inclusions, setInclusions] = useState((deal?.carePlan?.inclusions ?? []).join("\n"));
  const [exclusions, setExclusions] = useState((deal?.carePlan?.exclusions ?? []).join("\n"));
  const [deadline, setDeadline] = useState(deal?.deadline ?? "");
  const [goals, setGoals] = useState(deal?.goals ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [payee, setPayee] = useState<Payee | "">(deal?.payeeDefault ?? "");
  const [saving, start] = useTransition();

  const total = price.trim() === "" ? null : Number(price);
  const schedule: ScheduleLine[] = draft.map((l) => ({ ...l, amount: Number(l.amount) }));
  const problem =
    total != null && !(Number.isFinite(total) && total >= 0) ? "The total price must be a number" : scheduleProblem(total, schedule);
  const setLine = (i: number, patch: Partial<DraftLine>) => setDraft((s) => s.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  const save = () =>
    start(async () => {
      const r = await saveDealAction({
        projectId, reference: reference.trim().toUpperCase(), scope: lines(scope), priceTotal: total, paymentSchedule: schedule,
        carePlan: care ? { monthlyAmount: Number(monthly) || 0, minimumMonths: Number(minimum) || 0, noticeDays: Number(notice) || 0, inclusions: lines(inclusions), exclusions: lines(exclusions) } : null,
        deadline: deadline || null, goals: goals.trim() || null, notes: notes.trim() || null, payeeDefault: payee || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Deal saved");
      onClose();
    });

  return (
    <ModalShell title={deal ? `Edit deal ${deal.reference}` : "Set up the deal"} onClose={onClose} maxWidthClass="max-w-2xl">
      <div className="flex flex-col gap-4">
        <label className={label}>Reference<input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <label className={label}>What we offered (one item per line)<textarea className={inputCls} rows={4} value={scope} onChange={(e) => setScope(e.target.value)} /></label>
        <label className={label}>Total price (TTD)<input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs text-[#4A5568]">Payments</legend>
          {draft.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_1fr_auto] gap-2">
              <input aria-label="Payment label" className={inputCls} value={l.label} placeholder="Payment 1" onChange={(e) => setLine(i, { label: e.target.value })} />
              <input aria-label="Amount" className={inputCls} inputMode="decimal" value={l.amount} placeholder="0.00" onChange={(e) => setLine(i, { amount: e.target.value })} />
              <input aria-label="When it falls due" className={inputCls} value={l.trigger} placeholder="On acceptance" onChange={(e) => setLine(i, { trigger: e.target.value })} />
              <button type="button" aria-label="Remove payment" className="min-h-11 sm:min-h-0 px-2 text-[#B23A0A]" onClick={() => setDraft((s) => s.filter((_, n) => n !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="min-h-11 sm:min-h-0 self-start text-xs font-semibold text-[#1D4ED8] hover:underline"
            onClick={() => setDraft((s) => [...s, { label: `Payment ${s.length + 1}`, amount: "", trigger: "" }])}>+ Add a payment</button>
          {problem && <p className="text-xs text-[#B23A0A]">{problem}</p>}
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm text-[#1B2533] sm:min-h-0"><input type="checkbox" checked={care} onChange={(e) => setCare(e.target.checked)} /> Care plan after handover</label>
        {care && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}>Monthly (TTD)<input className={inputCls} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
            <label className={label}>Minimum months<input className={inputCls} inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></label>
            <label className={label}>Notice days<input className={inputCls} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} /></label>
            <label className={`${label} sm:col-span-3`}>Included (one per line)<textarea className={inputCls} rows={3} value={inclusions} onChange={(e) => setInclusions(e.target.value)} /></label>
            <label className={`${label} sm:col-span-3`}>Not included (one per line)<textarea className={inputCls} rows={2} value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></label>
          </div>
        )}
        <label className={label}>Deadline<input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        <label className={label}>Paid to<select className={selectCls} value={payee} onChange={(e) => setPayee(e.target.value as Payee | "")}>
          <option value="">Ask each time</option>
          {PAYEES.map((p) => <option key={p} value={p}>{PAYEE_LABEL[p]}</option>)}
        </select></label>
        <label className={label}>Goals<textarea className={inputCls} rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></label>
        <label className={label}>Notes (what was discussed, concessions)<textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-4 py-2 text-xs text-[#4A5568] transition-colors hover:border-[#94A3B8] hover:text-[#0E1A2B]">Cancel</button>
          <button type="button" disabled={saving || !!problem} onClick={save}
            className="min-h-11 sm:min-h-0 rounded-[4px] bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8]/80 disabled:opacity-40">{saving ? "Saving…" : "Save deal"}</button>
        </div>
      </div>
    </ModalShell>
  );
}
