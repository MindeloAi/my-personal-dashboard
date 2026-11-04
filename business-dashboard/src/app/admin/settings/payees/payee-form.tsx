"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inputCls } from "@/components/dashboard/clients-list";
import { savePayeeAccountAction } from "@/app/documents-actions";
import type { Payee } from "@/lib/documents";
import type { PayeeAccount } from "@/lib/documents-db";

const label = "flex flex-col gap-1.5 text-xs text-[#4A5568]";

export function PayeeForm({ payee, account }: { payee: Payee; account: PayeeAccount | null }) {
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [branch, setBranch] = useState(account?.branch ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [accountType, setAccountType] = useState(account?.accountType ?? "");
  const [saving, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await savePayeeAccountAction({
        payee, accountName, bankName, branch: branch.trim() || null, accountNumber, accountType: accountType.trim() || null,
      });
      if (r.ok) toast.success("Saved");
      else toast.error(r.error);
    });

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className={label}>Account name<input className={inputCls} value={accountName} onChange={(e) => setAccountName(e.target.value)} /></label>
      <label className={label}>Bank<input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} /></label>
      <label className={label}>Branch (optional)<input className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} /></label>
      <label className={label}>Account number<input className={inputCls} autoComplete="off" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></label>
      <label className={label}>Account type (optional)<input className={inputCls} placeholder="Chequing or Savings" value={accountType} onChange={(e) => setAccountType(e.target.value)} /></label>
      <button type="submit" disabled={saving}
        className="min-h-11 sm:min-h-0 self-start rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {saving ? "Saving" : "Save"}
      </button>
    </form>
  );
}
