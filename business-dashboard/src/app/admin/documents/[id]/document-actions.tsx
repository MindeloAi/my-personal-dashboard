"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { selectCls } from "@/components/dashboard/clients-list";
import { finaliseDocumentAction, setDocumentPayeeAction, setDocumentStatusAction } from "@/app/documents-actions";
import { DOC_STATUS_LABEL, PAYEES, PAYEE_LABEL, TRANSITIONS, type DocStatus, type Payee } from "@/lib/documents";

/** Finalise, and the status moves allowed from here. Editing the text happens through Claude (Phase 2). */
export function DocumentActions({ id, type, status, missing }: { id: string; type: string; status: DocStatus; missing: string[] }) {
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true; data?: { pdfError?: string } } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (r.data?.pdfError) toast.warning(r.data.pdfError);
      else toast.success(done);
    });
  // Signed happens by attaching the signed copy in Files, never by a button.
  const moves = TRANSITIONS[status].filter((s) => s !== "draft" && s !== "finalised" && s !== "signed")
    .filter((s) => type !== "receipt" || s === "sent" || s === "void"); // a receipt is neither accepted nor declined
  const btn = "min-h-11 sm:min-h-0 rounded-[4px] px-3 py-2 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <button type="button" disabled={busy || missing.length > 0} title={missing.length ? `Still missing: ${missing.join(", ")}` : undefined}
          className={`${btn} bg-[#1D4ED8] text-white`}
          onClick={() => confirm("Finalise? This version is frozen and can never be edited.") && run(() => finaliseDocumentAction(id), "Finalised")}>
          Finalise
        </button>
      )}
      {moves.map((s) => (
        <button key={s} type="button" disabled={busy}
          className={`${btn} border border-[#DCE1E8] ${s === "void" ? "text-[#B23A0A]" : "text-[#1B2533]"} hover:bg-[#0E1A2B]/5`}
          onClick={() => (s !== "void" || confirm("Void this document? This cannot be undone.")) && run(() => setDocumentStatusAction(id, s), `Marked ${DOC_STATUS_LABEL[s].toLowerCase()}`)}>
          Mark {DOC_STATUS_LABEL[s].toLowerCase()}
        </button>
      ))}
    </div>
  );
}

/** Who the client pays on an invoice draft. Changes save straight away. */
export function PayeePicker({ id, payee }: { id: string; payee: Payee | null }) {
  const [busy, start] = useTransition();
  return (
    <select aria-label="Paid to" className={`${selectCls} w-auto min-h-11 sm:min-h-0`} disabled={busy} value={payee ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const r = await setDocumentPayeeAction(id, next);
          if (r.ok) toast.success(`Paid to ${PAYEE_LABEL[next as Payee]}`);
          else toast.error(r.error);
        });
      }}>
      {payee === null && <option value="" disabled>Not chosen</option>}
      {PAYEES.map((p) => <option key={p} value={p}>{PAYEE_LABEL[p]}</option>)}
    </select>
  );
}
