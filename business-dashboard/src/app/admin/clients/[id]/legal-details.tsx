"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inputCls } from "@/components/dashboard/clients-list";
import { saveClientDetailsAction } from "@/app/documents-actions";
import type { ClientDetails } from "@/lib/documents-db";

const label = "flex flex-col gap-1.5 text-xs text-[#4A5568]";

export function LegalDetails({ clientId, details }: { clientId: string; details: ClientDetails | null }) {
  const [address, setAddress] = useState(details?.address ?? "");
  const [signatoryName, setSignatoryName] = useState(details?.signatoryName ?? "");
  const [signatoryTitle, setSignatoryTitle] = useState(details?.signatoryTitle ?? "");
  const [saving, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await saveClientDetailsAction({ clientId, address, signatoryName, signatoryTitle });
      if (r.ok) toast.success("Saved");
      else toast.error(r.error);
    });

  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[#1B2533]">Legal details</h2>
      <p className="mt-0.5 mb-3 text-xs text-[#4A5568]">Used on service agreements, care plans and change requests. Claude fills these in when you tell it.</p>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className={`${label} sm:col-span-2`}>Address<textarea className={inputCls} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label className={label}>Signatory name<input className={inputCls} value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} /></label>
        <label className={label}>Signatory title<input className={inputCls} placeholder="Director" value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} /></label>
        <button type="submit" disabled={saving}
          className="min-h-11 sm:min-h-0 self-start justify-self-start rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? "Saving" : "Save"}
        </button>
      </form>
    </section>
  );
}
