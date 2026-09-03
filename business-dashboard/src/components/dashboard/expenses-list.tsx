"use client";

import { useOptimistic, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Expense } from "@/lib/airtable";

type Props = {
  expenses: Expense[];
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
  Software: "#ff4d8b",
  Subcontractors: "#c44dff",
  Hosting: "#4d9fff",
  Hardware: "#3affd1",
  Marketing: "#bfff3a",
  Other: "#5a5f67",
};

const inputCls = "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

function EditModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = fd.get("amount") as string;
    const usdAmount = fd.get("usdAmount") as string;
    setError(false);
    const category = (fd.get("category") as string) || "";
    start(async () => {
      try {
        await updateExpenseAction(expense.id, {
          Name: (fd.get("name") as string) || undefined,
          Category: category ? (category as ExpenseCategoryValue) : undefined,
          Amount: amount ? parseFloat(amount) : undefined,
          Date: (fd.get("date") as string) || undefined,
          Recurring: fd.get("recurring") === "on",
          Notes: (fd.get("notes") as string) || undefined,
          "USD Amount": usdAmount ? parseFloat(usdAmount) : undefined,
          Reference: (fd.get("reference") as string) || undefined,
        });
        toast.success("Expense saved");
        onClose();
      } catch {
        setError(true);
        toast.error("Failed to save expense");
      }
    });
  }

  return (
    <ModalShell title="Edit Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Name</label>
              <input name="name" defaultValue={expense.Name} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Amount (TTD)</label>
              <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.Amount ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">USD Amount</label>
              <input name="usdAmount" type="number" min="0" step="0.01" defaultValue={expense["USD Amount"] ?? ""} placeholder="Optional" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Reference</label>
              <input name="reference" defaultValue={expense.Reference ?? ""} placeholder="Invoice / receipt no." className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Category</label>
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
              <label className="text-xs text-zinc-400">Date</label>
              <input name="date" type="date" defaultValue={expense.Date ?? ""} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input name="recurring" type="checkbox" defaultChecked={expense.Recurring ?? false} className="w-3.5 h-3.5 accent-[#bfff3a]" />
            Recurring expense
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <input name="notes" defaultValue={expense.Notes ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#ff4d8b]">Failed to save. Try again.</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#ff4d8b] text-white disabled:opacity-40 transition-colors hover:bg-[#ff4d8b]/80">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}

export function ExpensesList({ expenses, categoryFilter, onClearCategoryFilter }: Props) {
  const [editing, setEditing] = useState<Expense | null>(null);
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
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Expenses</p>
          {categoryFilter && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff4d8b]/10 text-[#ff4d8b] border border-[#ff4d8b]/20 font-medium flex items-center gap-1.5">
              {categoryFilter}
              <button
                onClick={onClearCategoryFilter}
                className="hover:text-white transition-colors"
                aria-label="Clear category filter"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <span className="text-xs text-[#ff4d8b] font-semibold">${total.toLocaleString()} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
              <th className="text-left pb-3 font-medium">Name</th>
              <th className="text-left pb-3 font-medium">Category</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium pl-6">Date</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2e34]">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-600 text-sm">No expenses recorded</td>
              </tr>
            ) : (
              sorted.map((exp) => {
                const color = CATEGORY_COLORS[exp.Category ?? "Other"] ?? "#5a5f67";
                return (
                  <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3 text-zinc-300 text-xs font-medium">
                      <span>{exp.Name}</span>
                      {exp.Recurring && <span className="ml-2 text-[10px] text-zinc-600">↻</span>}
                      {exp.Notes && <span className="ml-2 text-[10px] text-zinc-600 italic">{exp.Notes}</span>}
                    </td>
                    <td className="py-3">
                      {exp.Category ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color, background: `${color}18` }}>
                          {exp.Category}
                        </span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="py-3 text-right font-semibold text-white text-xs">
                      ${(exp.Amount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 pl-6 text-zinc-400 text-xs">
                      {exp.Date ? format(parseISO(exp.Date), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditing(exp)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white/0 text-zinc-600 border border-transparent hover:bg-white/[0.04] hover:text-zinc-300 hover:border-[#2a2e34] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white/0 text-zinc-600 border border-transparent hover:bg-[#ff4d8b]/10 hover:text-[#ff4d8b] hover:border-[#ff4d8b]/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
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

      {editing && <EditModal expense={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
