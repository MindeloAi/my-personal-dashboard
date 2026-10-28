"use client";

import { useMemo, useState } from "react";
import { parseISO, addDays, format, differenceInCalendarDays } from "date-fns";
import { EditInvoiceModal } from "@/components/dashboard/edit-invoice-modal";
import type { Invoice, Project, Subscription } from "@/lib/airtable";
import { isOverdue } from "@/lib/invoices";
import { today } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import { Explain } from "./explain";

type Props = { invoices: Invoice[]; projects?: Project[]; subscriptions?: Subscription[] };

const DOT_COLORS = ["#0F766E", "#1D4ED8", "#7E22CE", "#2563EB"];
const OVERDUE_COLOR = "#B23A0A";

export function Cashflow({ invoices, projects = [], subscriptions = [] }: Props) {
  const [editing, setEditing] = useState<Invoice | null>(null);

  const { upcoming, total } = useMemo(() => {
    const now = new Date();
    const todayStr = today(now);
    const cutoff = format(addDays(parseISO(todayStr), 30), "yyyy-MM-dd");
    const upcoming = invoices
      .filter((i) => (i.Status === "Sent" || i.Status === "Overdue") && i["Due Date"] && i["Due Date"] <= cutoff)
      .map((inv) => ({
        inv,
        remaining: (inv.Amount ?? 0) - (inv["Paid So Far"] ?? 0),
        overdue: isOverdue(inv, now),
      }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.inv["Due Date"]!.localeCompare(b.inv["Due Date"]!);
      });
    const total = upcoming.reduce((s, x) => s + x.remaining, 0);
    return { upcoming, total };
  }, [invoices]);

  const todayDate = parseISO(today());
  const colorFor = (overdue: boolean, idx: number) => (overdue ? OVERDUE_COLOR : DOT_COLORS[idx % DOT_COLORS.length]);
  const timelineDots = upcoming.slice(0, 5).map(({ inv, remaining, overdue }, idx) => {
    const daysDiff = differenceInCalendarDays(parseISO(inv["Due Date"]!), todayDate);
    const pct = Math.min(95, Math.max(5, (daysDiff / 30) * 100));
    return { inv, remaining, pct, color: colorFor(overdue, idx) };
  });

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <p className="text-sm font-medium text-[#1B2533] mb-1">Next 30 days</p>
      <p className="text-xs text-[#5A6678] mb-3">Expected cash in</p>
      <Explain
        className="-mt-2 mb-3"
        shows="The unpaid balance on every sent invoice due within the next 30 days, plus overdue ones, overdue first."
        watch="Overdue lines are already late and are the first to chase."
      />
      <p className="text-2xl font-medium text-[#1D4ED8]">{tt(total)}</p>

      <div className="relative mt-4 mb-2" style={{ height: 60 }}>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#DCE1E8]" />
        {timelineDots.map(({ inv, remaining, pct, color }) => (
          <button
            key={inv.id}
            onClick={() => setEditing(inv)}
            className="absolute group cursor-pointer"
            style={{ left: `${pct}%`, bottom: 0, transform: "translateX(-50%)" }}
            title={`${inv["Invoice Number"] ?? "No number"}, ${tt(remaining)}, click to edit`}
          >
            <div
              className="w-2 h-2 rounded-full mb-1 mx-auto group-hover:scale-150 transition-transform"
              style={{ background: color, boxShadow: `0 0 0 0 ${color}` }}
            />
            <div className="h-6 w-px mx-auto" style={{ background: color, opacity: 0.4 }} />
            <p className="text-[8px] text-[#5A6678] group-hover:text-[#0E1A2B] text-center whitespace-nowrap mt-1 transition-colors">
              {format(parseISO(inv["Due Date"]!), "MMM d")}
            </p>
          </button>
        ))}
      </div>

      {upcoming.length === 0 ? (
        <p className="text-xs text-[#6B7789] mt-4">No upcoming payments in 30 days</p>
      ) : (
        <div className="mt-4 pt-3 border-t border-[#EEF1F5] space-y-2">
          {upcoming.slice(0, 4).map(({ inv, remaining, overdue }, idx) => (
            <button
              key={inv.id}
              onClick={() => setEditing(inv)}
              className="w-full flex justify-between text-xs hover:bg-white/[0.02] -mx-1 px-1 py-0.5 rounded transition-colors"
            >
              <span className="text-[#4A5568]">
                {format(parseISO(inv["Due Date"]!), "MMM d")} · {inv["Invoice Number"] ?? "No number"}
                {overdue && <span className="ml-1.5 text-[10px] text-[#B23A0A]">overdue</span>}
              </span>
              <span style={{ color: colorFor(overdue, idx) }} className="font-medium tabular-nums">
                {tt(remaining)}
              </span>
            </button>
          ))}
          {upcoming.length > 4 && <p className="text-[10px] text-[#6B7789]">+{upcoming.length - 4} more</p>}
        </div>
      )}

      {editing && (
        <EditInvoiceModal
          invoice={editing}
          projects={projects}
          subscriptions={subscriptions}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
