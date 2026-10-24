"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

// Same look as the client dialogs.
export { inputCls, selectCls } from "@/components/dashboard/clients-list";
export const cancelBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-40";
export const primaryBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80";
// The prototype highlight for a lit row: a blue wash and a blue bar on the left.
export const LIT_ROW = "bg-[#172235] shadow-[inset_3px_0_#60a5fa]";
// Late labels, late diamonds, errors and delete buttons. Applied as an inline style, so the colour lives only here.
export const LATE = "#ff4d8b";
export const THROWN = "That did not save. Check your connection and try again.";

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-xs" style={{ color: LATE }}>
      {text}
    </p>
  ) : null;
}

// One action at a time. The ref closes the gap before React re-renders the disabled buttons,
// so a fast double-click, or Suggest followed by Save, cannot send twice.
export function useSave(onClose: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  function run(call: () => Promise<{ error?: string }>, done: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    start(async () => {
      try {
        const res = await call();
        if (res.error) return setError(res.error);
        toast.success(done);
        onClose();
      } catch {
        setError(THROWN);
      } finally {
        busy.current = false;
      }
    });
  }
  return { pending, error, setError, run, busy };
}
