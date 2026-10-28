"use client";

import { useState } from "react";
import { ExpensesBreakdown } from "@/components/dashboard/expenses-breakdown";
import { ExpensesList } from "@/components/dashboard/expenses-list";
import type { Expense, Ledger } from "@/lib/db";

/** Clicking a category in the breakdown filters the list beside it. */
export function ExpensesView({ expenses, cutover }: { expenses: Expense[]; cutover: Ledger["cutover"] }) {
  const [category, setCategory] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <ExpensesBreakdown expenses={expenses} selectedCategory={category} onSelectCategory={setCategory} />
      <div className="lg:col-span-2">
        <ExpensesList
          expenses={expenses}
          cutover={cutover}
          categoryFilter={category}
          onClearCategoryFilter={() => setCategory(null)}
        />
      </div>
    </div>
  );
}
