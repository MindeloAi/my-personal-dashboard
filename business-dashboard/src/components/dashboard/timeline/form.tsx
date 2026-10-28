"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

// Same look as the client dialogs.
export { inputCls, selectCls } from "@/components/dashboard/clients-list";
export const cancelBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#334155] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors disabled:opacity-40";
export const primaryBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white disabled:opacity-40 transition-colors hover:bg-[#1D4ED8]/80";
// The prototype highlight for a lit row: a blue wash and a blue bar on the left.
export const LIT_ROW = "bg-[#EFF4FF] shadow-[inset_3px_0_#2563EB]";
// Late labels, late diamonds, errors and delete buttons. Applied as an inline style, so the colour lives only here.
export const LATE = "#B23A0A";
export const THROWN = "That did not save. Check your connection and try again.";

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-[#4A5568]">
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

// An inline delete confirmation. Cancel takes focus when it opens; onConfirm closes the row itself, and only on success.
export function ConfirmRow({
  text,
  busy,
  onConfirm,
  onCancel,
  className = "",
}: {
  text: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 bg-[#FCEBE3] px-3 py-2 text-xs text-[#1B2533] ${className}`} role="alert">
      <span>{text}</span>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="min-h-11 sm:min-h-0 px-3 py-1.5 rounded-[4px] font-semibold text-[#1B2533] disabled:opacity-40"
        style={{ background: LATE }}
      >
        Delete
      </button>
      <button type="button" autoFocus onClick={onCancel} className={cancelBtn}>
        Cancel
      </button>
    </div>
  );
}

// Dialog state that gives focus back to whatever opened the dialog, so closing it never drops focus on the page body.
export function useFocusReturn<T>() {
  const [value, setValue] = useState<T | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const set = (next: T | null) => {
    if (next) opener.current = document.activeElement as HTMLElement | null;
    setValue(next);
    if (!next) requestAnimationFrame(() => opener.current?.focus());
  };
  return [value, set] as const;
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
