"use client";

import { useActionState } from "react";

export type SetupState = { error?: string };

export function SetupForm(props: {
  action: (prev: SetupState, formData: FormData) => Promise<SetupState>;
  factorId: string;
  qr: string;
  secret: string;
  next: string;
  shared: boolean;
}) {
  const [state, formAction, pending] = useActionState(props.action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="factorId" value={props.factorId} />
      <input type="hidden" name="next" value={props.next} />

      <ol className="list-decimal pl-4 space-y-1 text-xs text-[#4A5568]">
        <li>Open Google Authenticator, Microsoft Authenticator or 1Password on your phone.</li>
        <li>
          Scan this code.
          {props.shared && <strong> This account is shared: Michael and Zane both scan it now, before continuing.</strong>}
        </li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>

      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URI from Supabase */}
      <img src={props.qr} alt="QR code for your authenticator app" width={200} height={200} className="mx-auto bg-white p-2" />

      <details className="text-xs text-[#5A6678]">
        <summary className="cursor-pointer">Can&apos;t scan? Type this key instead</summary>
        <p className="mt-1 font-mono break-all select-all bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] p-2">{props.secret}</p>
      </details>

      {state.error && <p className="text-xs text-[#B23A0A]">{state.error}</p>}

      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        aria-label="6-digit code"
        className="w-full rounded-[4px] bg-[#F3F5F8] border border-[#DCE1E8] px-3 py-2 text-lg tracking-[0.3em] text-center outline-none focus:border-[#1D4ED8]/40"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[4px] bg-[#1D4ED8] text-white text-sm font-semibold px-3 py-2 hover:bg-[#1D4ED8]/90 transition-colors disabled:opacity-60"
      >
        {pending ? "Checking…" : "Confirm"}
      </button>
    </form>
  );
}
