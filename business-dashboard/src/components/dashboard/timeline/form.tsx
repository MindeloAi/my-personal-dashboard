"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

// Same look as the client dialogs (their copies are not exported).
export const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
export const selectCls = inputCls + " cursor-pointer";
export const cancelBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-40";
export const primaryBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80";
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
    <p role="alert" className="text-xs text-[#ff4d8b]">
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
