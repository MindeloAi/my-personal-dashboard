"use client";

import { useState } from "react";
import {
  closePromiseAction,
  createPromiseAction,
  replacePromiseAction,
  updatePromiseAction,
} from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import { MAX_WHAT, type ClientPromise, type OwedBy } from "@/lib/timeline";
import { cancelBtn, Field, fmtDay, inputCls, primaryBtn, selectCls, useSave } from "./entry-modal";

type Props = {
  clientId: string;
  mode: "add" | "edit" | "replace" | "drop";
  side?: OwedBy;
  promise?: ClientPromise;
  onClose: () => void;
};

const TITLE = { add: "Add a promise", edit: "Edit promise", replace: "Replace promise", drop: "Drop promise" };
const DONE = { add: "Promise added", edit: "Promise updated", replace: "Promise replaced", drop: "Promise dropped" };

export function PromiseModal({ clientId, mode, side, promise, onClose }: Props) {
  const [owedBy, setOwedBy] = useState<OwedBy>(promise?.owedBy ?? side ?? "client");
  const [what, setWhat] = useState(promise?.what ?? "");
  const [dueOn, setDueOn] = useState(mode === "replace" ? "" : (promise?.dueOn ?? ""));
  const [note, setNote] = useState("");
  const { pending, error, setError, run } = useSave(onClose);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode !== "drop" && !what.trim()) return setError("Describe the promise first.");
    const fields = { owedBy, what: what.trim(), dueOn: dueOn || null };
    if (mode === "add") run(() => createPromiseAction({ clientId, entryId: null, ...fields }), DONE[mode]);
    else if (!promise) return;
    else if (mode === "edit") run(() => updatePromiseAction(promise.id, fields), DONE[mode]);
    else if (mode === "replace")
      run(() => replacePromiseAction(promise.id, { ...fields, owedBy: promise.owedBy }), DONE[mode]);
    else run(() => closePromiseAction(promise.id, { status: "dropped", note: note.trim() || null }), DONE[mode]);
  }

  return (
    <ModalShell title={TITLE[mode]} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {(mode === "replace" || mode === "drop") && promise && (
          <div className="rounded-xl border border-[#2a2e34] bg-[#0b0d10]/60 px-3 py-2 text-sm text-zinc-300 break-words">
            <p>{promise.what}</p>
            <p className="text-xs text-zinc-500">Due {fmtDay(promise.dueOn)}</p>
          </div>
        )}
        {(mode === "add" || mode === "edit") && (
          <Field id="pm-who" label="Who owes it">
            <select id="pm-who" value={owedBy} onChange={(e) => setOwedBy(e.target.value as OwedBy)} className={selectCls}>
              <option value="client">The client owes us</option>
              <option value="us">We owe the client</option>
            </select>
          </Field>
        )}
        {mode !== "drop" && (
          <>
            <Field id="pm-what" label={mode === "replace" ? "New promise" : "What"}>
              <input id="pm-what" value={what} maxLength={MAX_WHAT} onChange={(e) => setWhat(e.target.value)} className={inputCls} />
            </Field>
            <Field id="pm-due" label={mode === "replace" ? "New due date" : "Due date (optional)"}>
              <input id="pm-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
        {mode === "edit" && <p className="text-xs text-zinc-500">To record a date that really moved, use Replace instead.</p>}
        {mode === "drop" && (
          <Field id="pm-note" label="Note (optional)">
            <textarea id="pm-note" rows={3} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-xs text-[#ff4d8b]">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} className={cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending ? "Saving…" : mode === "drop" ? "Drop promise" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
