"use client";

import { useMemo } from "react";
import type { Expense } from "@/lib/airtable";
import { Explain } from "./explain";

type Props = {
  expenses: Expense[];
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  Software: "#B23A0A",
  Subcontractors: "#7E22CE",
  Hosting: "#2563EB",
  Hardware: "#0F766E",
  Marketing: "#1D4ED8",
  Other: "#94A3B8",
};

export function ExpensesBreakdown({ expenses, selectedCategory, onSelectCategory }: Props) {
  const { byCategory, total } = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of expenses) {
      const cat = exp.Category ?? "Other";
      map.set(cat, (map.get(cat) ?? 0) + (exp.Amount ?? 0));
    }
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }));
    const total = sorted.reduce((s, c) => s + c.amount, 0);
    return { byCategory: sorted, total };
  }, [expenses]);

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-[#1B2533]">Expenses</p>
        <span className="text-xs text-[#B23A0A]">TT${total.toLocaleString()}</span>
      </div>
      <Explain
        className="-mt-2 mb-4"
        shows="Total spending by category, biggest first."
        read="Click a category to filter the expense list beside it; click it again to clear."
        />
      <div className="space-y-3">
        {byCategory.length === 0 && (
          <p className="text-xs text-[#6B7789]">No expenses recorded</p>
        )}
        {byCategory.map(({ name, amount }) => {
          const pct = total === 0 ? 0 : Math.round((amount / total) * 100);
          const color = CATEGORY_COLORS[name] ?? "#94A3B8";
          const isSelected = selectedCategory === name;
          const isClickable = !!onSelectCategory;
          return (
            <button
              key={name}
              onClick={isClickable ? () => onSelectCategory?.(isSelected ? null : name) : undefined}
              disabled={!isClickable}
              className={`w-full text-left rounded-[4px] -mx-1 px-1 py-2 sm:py-0.5 transition-colors disabled:cursor-default ${
                isSelected ? "bg-white/[0.04]" : isClickable ? "hover:bg-white/[0.02]" : ""
              }`}
            >
              <div className="flex justify-between text-xs text-[#334155] mb-1">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`} style={{ background: color }} />
                  {name}
                </span>
                <span>TT${amount.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-[#EEF1F5] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color, boxShadow: isSelected ? `0 0 8px ${color}80` : "none" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
