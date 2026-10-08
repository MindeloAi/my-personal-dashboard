"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isBefore, isAfter } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { recurringStats, dueSubscriptions } from "@/lib/subscriptions";
import type { Invoice, Subscription } from "@/lib/airtable";

type Props = {
  subscriptions: Subscription[];
  invoices: Invoice[];
  onJumpToRecurring: () => void;
};

function inRange(dateStr: string | undefined, start: Date, end: Date) {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  return !isBefore(d, start) && !isAfter(d, end);
}

export function MrrCard({ subscriptions, invoices, onJumpToRecurring }: Props) {
  const stats = useMemo(() => {
    // MRR comes from `subscriptions`, not projects. The old version summed
    // projects whose Payment Structure was recurring_* AND whose Status was
    // "In Progress" — which excluded every retainer on a delivered project
    // (those are Done) and every retainer with no project at all, so this card
    // read $0 while money was recurring. See lib/subscriptions.ts.
    const { mrr, arr, live, upcoming } = recurringStats(subscriptions);
    const due = dueSubscriptions(subscriptions, invoices);

    // Last 6 months of paid recurring invoice revenue
    const now = new Date();
    const monthlyRecurring = Array.from({ length: 6 }, (_, idx) => {
      const mStart = startOfMonth(subMonths(now, 5 - idx));
      const mEnd = endOfMonth(mStart);
      const total = invoices
        .filter(
          (i) =>
            i.Status === "Paid" &&
            i["Invoice Type"] === "recurring" &&
            inRange(i["Paid Date"], mStart, mEnd)
        )
        .reduce((s, i) => s + (i.Amount ?? 0), 0);
      return { month: format(mStart, "MMM"), total };
    });

    const thisMonthRec = monthlyRecurring[5]?.total ?? 0;
    const lastMonthRec = monthlyRecurring[4]?.total ?? 0;
    const momPct =
      lastMonthRec === 0
        ? null
        : Math.round(((thisMonthRec - lastMonthRec) / Math.abs(lastMonthRec)) * 100);

    const peak = Math.max(...monthlyRecurring.map((m) => m.total), 1);

    return { mrr, arr, live, upcoming, due, monthlyRecurring, momPct, peak };
  }, [subscriptions, invoices]);

  const animatedMrr = useCountUp(stats.mrr);

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] text-[#3affd1] font-medium tracking-wider uppercase">Recurring Revenue</p>
        {stats.momPct !== null && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              stats.momPct >= 0
                ? "bg-[#3affd1]/12 text-[#3affd1]"
                : "bg-[#ff4d8b]/12 text-[#ff4d8b]"
            }`}
          >
            {stats.momPct >= 0 ? "▲" : "▼"} {Math.abs(stats.momPct)}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-1">
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">MRR</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            TT${Math.round(animatedMrr).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">ARR</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            TT${Math.round(stats.arr).toLocaleString()}
          </p>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-1">
        {stats.live} live · {stats.upcoming} starting later
      </p>

      {stats.due.length > 0 && (
        <button
          type="button"
          onClick={onJumpToRecurring}
          className="mt-2 w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors"
        >
          {stats.due.length} due to invoice →
        </button>
      )}

      {/* Mini bar chart */}
      <div className="mt-4 flex items-end gap-1 h-12">
        {stats.monthlyRecurring.map(({ month, total }, idx) => {
          const heightPct = (total / stats.peak) * 100;
          const isCurrent = idx === stats.monthlyRecurring.length - 1;
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${heightPct}%`,
                    background: isCurrent ? "#3affd1" : "#3affd1aa",
                    opacity: isCurrent ? 1 : 0.5,
                    minHeight: total > 0 ? "2px" : "0",
                  }}
                />
              </div>
              <span className="text-[8px] text-zinc-600">{month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
