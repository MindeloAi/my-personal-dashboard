"use client";

import { useOptimistic, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  deleteExpenseAction,
  reimburseExpenseAction,
  undoReimburseExpenseAction,
  updateExpenseAction,
} from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Expense } from "@/lib/airtable";
import { FOUNDER_LABEL, HOLDERS, HOLDER_LABEL, PAID_WITH, paidWithFields, paidWithValue, tt } from "@/lib/ledger";
import { today } from "@/lib/subscriptions";

type Props = {
  expenses: Expense[];
  cutover: string;
  categoryFilter?: string | null;
  onClearCategoryFilter?: () => void;
};

type ExpenseCategoryValue =
  | "Software"
  | "Subcontractors"
  | "Hosting"
  | "Hardware"
  | "Marketing"
  | "Other";

const CATEGORY_COLORS: Record<string, string> = {
  Software: "#B23A0A",
  Subcontractors: "#7E22CE",
  Hosting: "#2563EB",
  Hardware: "#0F766E",
  Marketing: "#1D4ED8",
  Other: "#94A3B8",
};

const inputCls = "w-full bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] px-3 py-2 text-sm text-[#1B2533] placeholder:text-[#8B9AB0] focus:outline-none focus:border-[#94A3B8] transition-colors";
const selectCls = inputCls + " cursor-pointer";

function paidWithLine(e: Expense): string | null {
  if (e["Paid From"]) return `${HOLDER_LABEL[e["Paid From"]]}'s cash`;
  if (e["Paid Personally By"]) {
    const who = `${FOUNDER_LABEL[e["Paid Personally By"]]} paid personally`;
    if (!e["Reimbursed At"]) return who;
    const from = e["Reimbursed From"] ? ` from ${HOLDER_LABEL[e["Reimbursed From"]]}` : "";
    return `${who}, reimbursed ${format(parseISO(e["Reimbursed At"]), "d MMM")}${from}`;
  }
  return null;
}

function ReimburseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const from = fd.get("from") as string;
    setError(null);
    start(async () => {
      try {
        const res = await reimburseExpenseAction(expense.id, date, from);
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success("Reimbursement recorded");
        onClose();
      } catch {
        setError("Could not save. Try again.");
        toast.error("Could not record the reimbursement");
      }
    });
  }

  const founder = expense["Paid Personally By"];
  return (
    <ModalShell title="Reimburse expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-[#4A5568]">
          {expense.Name}, {tt(expense.Amount ?? 0)}{founder ? ` back to ${FOUNDER_LABEL[founder]}` : ""}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reimburse-date" className="text-xs text-[#4A5568]">Date reimbursed</label>
            <input id="reimburse-date" name="date" type="date" required defaultValue={today()} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reimburse-from" className="text-xs text-[#4A5568]">Paid from</label>
            <select id="reimburse-from" name="from" defaultValue="mikey" className={selectCls}>
              {HOLDERS.map((h) => (
                <option key={h} value={h}>{HOLDER_LABEL[h]}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-[#B23A0A]">{error}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={onClose} className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white disabled:opacity-40 transition-colors hover:bg-[#1D4ED8]/80">
            {pending ? "Saving..." : "Reimburse"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditModal({ expense, cutover, onClose }: { expense: Expense; cutover: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paidWithError, setPaidWithError] = useState(false);
  const reimbursed = !!expense["Reimbursed At"];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = fd.get("amount") as string;
    const usdAmount = fd.get("usdAmount") as string;
    const date = (fd.get("date") as string) || "";
    const paidWith = (fd.get("paidWith") as string) || "";
    setError(null);
    setPaidWithError(false);
    if (!reimbursed && !paidWith && date && date >= cutover) {
      setPaidWithError(true);
      return;
    }
    const category = (fd.get("category") as string) || "";
    start(async () => {
      try {
        const res = await updateExpenseAction(expense.id, {
          Name: (fd.get("name") as string) || undefined,
          Category: category ? (category as ExpenseCategoryValue) : undefined,
          Amount: amount ? parseFloat(amount) : undefined,
          // "" clears; undefined would silently keep the old value.
          Date: (fd.get("date") as string) || "",
          Recurring: fd.get("recurring") === "on",
          Notes: (fd.get("notes") as string) || "",
          "USD Amount": usdAmount ? parseFloat(usdAmount) : undefined,
          Reference: (fd.get("reference") as string) || "",
          ...(reimbursed ? {} : paidWithFields(paidWith)),
        });
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success("Expense saved");
        onClose();
      } catch {
        setError("Failed to save. Try again.");
        toast.error("Failed to save expense");
      }
    });
  }

  return (
    <ModalShell title="Edit Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Name</label>
              <input name="name" defaultValue={expense.Name} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Amount (TTD)</label>
              <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.Amount ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">USD Amount</label>
              <input name="usdAmount" type="number" min="0" step="0.01" defaultValue={expense["USD Amount"] ?? ""} placeholder="Optional" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Reference</label>
              <input name="reference" defaultValue={expense.Reference ?? ""} placeholder="Invoice / receipt no." className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Category</label>
              <select name="category" defaultValue={expense.Category ?? ""} className={selectCls}>
                <option value="">—</option>
                <option value="Software">Software</option>
                <option value="Subcontractors">Subcontractors</option>
                <option value="Hosting">Hosting</option>
                <option value="Hardware">Hardware</option>
                <option value="Marketing">Marketing</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Date</label>
              <input name="date" type="date" defaultValue={expense.Date ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-paid-with" className="text-xs text-[#4A5568]">Paid with</label>
            <select
              id="expense-paid-with"
              name="paidWith"
              defaultValue={paidWithValue(expense)}
              disabled={reimbursed}
              onChange={() => setPaidWithError(false)}
              aria-invalid={paidWithError}
              className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value="">Select...</option>
              {PAID_WITH.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {reimbursed && (
              <p className="text-[11px] text-[#5A6678]">Reimbursed, undo the reimbursement to change this.</p>
            )}
            {paidWithError && <p className="text-xs text-[#B23A0A]">Choose what this expense was paid with.</p>}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#4A5568] cursor-pointer select-none">
            <input name="recurring" type="checkbox" defaultChecked={expense.Recurring ?? false} className="w-3.5 h-3.5 accent-[#1D4ED8]" />
            Recurring expense
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Notes</label>
            <input name="notes" defaultValue={expense.Notes ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#B23A0A]">{error}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#B23A0A] text-white disabled:opacity-40 transition-colors hover:bg-[#B23A0A]/80">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}

export function ExpensesList({ expenses, cutover, categoryFilter, onClearCategoryFilter }: Props) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [reimbursing, setReimbursing] = useState<Expense | null>(null);
  const [, startTransition] = useTransition();
  const [optimisticExpenses, removeOptimistic] = useOptimistic<Expense[], string>(
    expenses,
    (current, deletedId) => current.filter((e) => e.id !== deletedId),
  );

  function handleDelete(exp: Expense) {
    if (!window.confirm(`Delete "${exp.Name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      removeOptimistic(exp.id);
      try {
        await deleteExpenseAction(exp.id);
        toast.success("Expense deleted");
      } catch {
        toast.error("Failed to delete expense");
      }
    });
  }

  function handleUndoReimburse(exp: Expense) {
    if (!window.confirm(`Undo the reimbursement for "${exp.Name}"?`)) return;
    startTransition(async () => {
      try {
        const res = await undoReimburseExpenseAction(exp.id);
        if (res.error) toast.error(res.error);
        else toast.success("Reimbursement undone");
      } catch {
        toast.error("Could not undo the reimbursement");
      }
    });
  }

  const filtered = categoryFilter
    ? optimisticExpenses.filter((e) => (e.Category ?? "Other") === categoryFilter)
    : optimisticExpenses;

  const sorted = [...filtered].sort((a, b) => {
    const da = a.Date ?? "";
    const db = b.Date ?? "";
    return db.localeCompare(da);
  });

  const total = sorted.reduce((s, e) => s + (e.Amount ?? 0), 0);

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-[#5A6678] uppercase tracking-wider">Expenses</p>
          {categoryFilter && (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#B23A0A]/10 text-[#B23A0A] border border-[#B23A0A]/20 font-medium flex items-center gap-1.5">
              {categoryFilter}
              <button
                onClick={onClearCategoryFilter}
                className="hover:text-[#0E1A2B] transition-colors"
                aria-label="Clear category filter"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <span className="text-xs text-[#B23A0A] font-semibold">${total.toLocaleString()} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#5A6678] text-xs uppercase tracking-wider border-b border-[#DCE1E8]">
              <th className="text-left pb-3 font-medium">Name</th>
              <th className="hidden sm:table-cell text-left pb-3 font-medium">Category</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium pl-3 sm:pl-6">Date</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE1E8]">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#6B7789] text-sm">No expenses recorded</td>
              </tr>
            ) : (
              sorted.map((exp) => {
                const color = CATEGORY_COLORS[exp.Category ?? "Other"] ?? "#94A3B8";
                const paidLine = paidWithLine(exp);
                // Matches the owed_to_founders view: only ledger-era expenses are owed back.
                const owed =
                  !!exp["Paid Personally By"] && !exp["Reimbursed At"] && !!exp.Date && exp.Date >= cutover;
                return (
                  <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3 text-[#334155] text-xs font-medium">
                      <span>{exp.Name}</span>
                      {exp.Recurring && <span className="ml-2 text-[10px] text-[#6B7789]">↻</span>}
                      {exp.Notes && <span className="ml-2 text-[10px] text-[#6B7789] italic">{exp.Notes}</span>}
                      {/* Phones drop the Category column; keep the pill under the name. */}
                      {exp.Category && (
                        <span className="sm:hidden block mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-[4px] font-medium" style={{ color, background: `${color}18` }}>
                            {exp.Category}
                          </span>
                        </span>
                      )}
                      {paidLine && (
                        <span className={`block mt-0.5 text-[10px] font-normal ${owed ? "text-[#B45309]" : "text-[#5A6678]"}`}>
                          {paidLine}
                        </span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell py-3">
                      {exp.Category ? (
                        <span className="text-xs px-2 py-0.5 rounded-[4px] font-medium" style={{ color, background: `${color}18` }}>
                          {exp.Category}
                        </span>
                      ) : <span className="text-[#6B7789] text-xs">—</span>}
                    </td>
                    <td className="py-3 text-right font-semibold text-[#1B2533] text-xs">
                      ${(exp.Amount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 pl-3 sm:pl-6 text-[#4A5568] text-xs whitespace-nowrap">
                      {exp.Date ? format(parseISO(exp.Date), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 justify-end">
                        {owed && (
                          <button
                            onClick={() => setReimbursing(exp)}
                            className="min-h-11 sm:min-h-0 whitespace-nowrap text-xs px-2.5 py-1 rounded-[4px] border border-[#1D4ED8]/30 text-[#1D4ED8] hover:bg-[#1D4ED8]/10 transition-colors"
                          >
                            Reimburse
                          </button>
                        )}
                        {exp["Reimbursed At"] && (
                          <button
                            onClick={() => handleUndoReimburse(exp)}
                            className="min-h-11 sm:min-h-0 whitespace-nowrap text-xs px-2.5 py-1 text-[#6B7789] hover:text-[#334155] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                          >
                            Undo reimbursement
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(exp)}
                          className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-[4px] bg-transparent text-[#6B7789] border border-transparent hover:bg-white/[0.04] hover:text-[#334155] hover:border-[#DCE1E8] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          className="min-h-11 sm:min-h-0 text-xs px-2.5 py-1 rounded-[4px] bg-transparent text-[#6B7789] border border-transparent hover:bg-[#B23A0A]/10 hover:text-[#B23A0A] hover:border-[#B23A0A]/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditModal expense={editing} cutover={cutover} onClose={() => setEditing(null)} />}
      {reimbursing && <ReimburseModal expense={reimbursing} onClose={() => setReimbursing(null)} />}
    </div>
  );
}
