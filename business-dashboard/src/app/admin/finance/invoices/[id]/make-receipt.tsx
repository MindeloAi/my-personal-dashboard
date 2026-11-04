"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createReceiptAction } from "@/app/documents-actions";
import { href } from "@/lib/record-graph";

/** Drafts a receipt for one payment and opens it. */
export function MakeReceipt({ paymentId }: { paymentId: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={busy}
      className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-2 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-[#0E1A2B]/5 disabled:opacity-50"
      onClick={() => start(async () => {
        const r = await createReceiptAction(paymentId);
        if (r.ok) router.push(href.document(r.data.id));
        else toast.error(r.error);
      })}>
      {busy ? "Making..." : "Make receipt"}
    </button>
  );
}
