"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { finaliseDocumentAction, setDocumentStatusAction } from "@/app/documents-actions";
import { DOC_STATUS_LABEL, TRANSITIONS, type DocStatus } from "@/lib/documents";

/** Finalise, and the status moves allowed from here. Editing the text happens through Claude (Phase 2). */
export function DocumentActions({ id, status, missing }: { id: string; status: DocStatus; missing: string[] }) {
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(done);
      else toast.error(r.error);
    });
  const moves = TRANSITIONS[status].filter((s) => s !== "draft" && s !== "finalised");
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
