"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
  isBefore,
  isAfter,
  getDate,
} from "date-fns";
import type { Invoice, Expense } from "@/lib/airtable";

type Props = { invoices: Invoice[]; expenses: Expense[] };
type Range = "1M" | "6M" | "YTD" | "ALL";

type PeriodData = {
  month: string;
  revenue: number;
  outstanding: number;
  netProfit: number;
  paidInvoices: Invoice[];
  outstandingInvoices: Invoice[];
};

function getWeekLabel(day: number): string {
  if (day <= 7) return "Wk 1";
  if (day <= 14) return "Wk 2";
  if (day <= 21) return "Wk 3";
  return "Wk 4";
}

function buildMonthlyData(invoices: Invoice[], expenses: Expense[], range: Range): PeriodData[] {
  const now = new Date();

  if (range === "1M") {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
    const buckets = new Map<string, PeriodData>(
      weeks.map((w) => [w, { month: w, revenue: 0, outstanding: 0, netProfit: 0, paidInvoices: [], outstandingInvoices: [] }])
    );

    for (const inv of invoices) {
      if (inv.Status === "Paid" && inv["Paid Date"]) {
        const d = parseISO(inv["Paid Date"]);
        if (!isBefore(d, monthStart) && !isAfter(d, monthEnd)) {
          const key = getWeekLabel(getDate(d));
          const b = buckets.get(key);
          if (b) { b.revenue += inv.Amount ?? 0; b.paidInvoices.push(inv); }
        }
      }
      if ((inv.Status === "Sent" || inv.Status === "Overdue") && inv["Issue Date"]) {
        const d = parseISO(inv["Issue Date"]);
        if (!isBefore(d, monthStart) && !isAfter(d, monthEnd)) {
          const key = getWeekLabel(getDate(d));
          const b = buckets.get(key);
          if (b) { b.outstanding += inv.Amount ?? 0; b.outstandingInvoices.push(inv); }
        }
      }
    }

    for (const exp of expenses) {
      if (!exp.Date) continue;
      const d = parseISO(exp.Date);
      if (!isBefore(d, monthStart) && !isAfter(d, monthEnd)) {
        const key = getWeekLabel(getDate(d));
        const b = buckets.get(key);
        if (b) b.netProfit -= exp.Amount ?? 0;
      }
    }
    for (const b of buckets.values()) b.netProfit += b.revenue;

    return Array.from(buckets.values());
  }

  const cutoff =
    range === "6M"
      ? subMonths(startOfMonth(now), 5)
      : range === "YTD"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(2020, 0, 1);

  const buckets = new Map<string, PeriodData>();
  let cursor = new Date(cutoff);
  while (cursor <= now) {
    const key = format(cursor, "MMM yy");
    buckets.set(key, { month: key, revenue: 0, outstanding: 0, netProfit: 0, paidInvoices: [], outstandingInvoices: [] });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  for (const inv of invoices) {
    if (inv.Status === "Paid" && inv["Paid Date"]) {
      const d = parseISO(inv["Paid Date"]);
      if (!isBefore(d, cutoff)) {
        const key = format(d, "MMM yy");
        const b = buckets.get(key);
        if (b) { b.revenue += inv.Amount ?? 0; b.paidInvoices.push(inv); }
      }
    }
    if ((inv.Status === "Sent" || inv.Status === "Overdue") && inv["Issue Date"]) {
      const d = parseISO(inv["Issue Date"]);
      if (!isBefore(d, cutoff)) {
        const key = format(d, "MMM yy");
        const b = buckets.get(key);
        if (b) { b.outstanding += inv.Amount ?? 0; b.outstandingInvoices.push(inv); }
      }
    }
  }

  const expenseByMonth = new Map<string, number>();
  for (const exp of expenses) {
    if (!exp.Date) continue;
    const d = parseISO(exp.Date);
    if (isBefore(d, cutoff)) continue;
    const key = format(d, "MMM yy");
    expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + (exp.Amount ?? 0));
  }
  for (const [key, b] of buckets) b.netProfit = b.revenue - (expenseByMonth.get(key) ?? 0);

  return Array.from(buckets.values());
}

type TooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
  payload?: PeriodData;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  onDrillDown?: (data: PeriodData) => void;
};

function CustomTooltip({ active, payload, label, onDrillDown }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-2xl p-4 min-w-[200px] shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 font-medium">{label}</p>
      <div className="space-y-2 mb-3">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-xs text-zinc-400">{p.name}</span>
            </div>
            <span className="text-xs font-semibold text-white">
              ${(p.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {(data.paidInvoices.length > 0 || data.outstandingInvoices.length > 0) && (
        <button
          onClick={() => onDrillDown?.(data)}
          className="w-full text-xs py-1.5 rounded-lg bg-[#bfff3a]/10 text-[#bfff3a] border border-[#bfff3a]/20 hover:bg-[#bfff3a]/20 transition-colors"
        >
          View invoices →
        </button>
      )}
    </div>
  );
}

function DrillDownPanel({ data, onClose }: { data: PeriodData; onClose: () => void }) {
  return (
    <div className="mt-4 bg-[#0b0d10] border border-[#2a2e34] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">{data.month} — Invoice breakdown</p>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs transition-colors">Close ✕</button>
      </div>
      {data.paidInvoices.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-[#bfff3a] uppercase tracking-wider mb-2">Paid</p>
          <div className="space-y-1.5">
            {data.paidInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-mono">{inv["Invoice Number"] ?? "—"}</span>
                <span className="text-zinc-500 capitalize">{inv["Invoice Type"]?.replace(/_/g, " ")}</span>
                <span className="text-white font-semibold">${(inv.Amount ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.outstandingInvoices.length > 0 && (
        <div>
          <p className="text-[10px] text-[#ff4d8b] uppercase tracking-wider mb-2">Outstanding</p>
          <div className="space-y-1.5">
            {data.outstandingInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-mono">{inv["Invoice Number"] ?? "—"}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${inv.Status === "Overdue" ? "text-[#ff4d8b]" : "text-[#3affd1]"}`}>{inv.Status}</span>
                <span className="text-white font-semibold">${(inv.Amount ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RevenueChart({ invoices, expenses }: Props) {
  const [range, setRange] = useState<Range>("6M");
  const [drillDown, setDrillDown] = useState<PeriodData | null>(null);

  const data = useMemo(() => buildMonthlyData(invoices, expenses, range), [invoices, expenses, range]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalOutstanding = invoices
    .filter((i) => i.Status === "Sent" || i.Status === "Overdue")
    .reduce((s, i) => s + (i.Amount ?? 0), 0);
  const totalNet = data.reduce((s, d) => s + d.netProfit, 0);

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-start justify-between mb-6">
        <div className="flex flex-wrap gap-4 md:gap-8">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Revenue</p>
            <p className="text-xl font-bold text-[#bfff3a]">${totalRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Outstanding</p>
            <p className="text-xl font-bold text-[#fbbf24]">${totalOutstanding.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Net Profit</p>
            <p className={`text-xl font-bold ${totalNet >= 0 ? "text-[#3affd1]" : "text-[#ff4d8b]"}`}>
              ${totalNet.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-[#0b0d10] rounded-xl p-1">
          {(["1M", "6M", "YTD", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => { setRange(r); setDrillDown(null); }}
              className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r ? "bg-[#bfff3a] text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#2a2e34" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <ReferenceLine y={0} stroke="#2a2e34" />
          <Tooltip content={<CustomTooltip onDrillDown={setDrillDown} />} cursor={{ stroke: "#2a2e34", strokeWidth: 1 }} />
          <Line type="linear" dataKey="revenue" name="Revenue" stroke="#bfff3a" strokeWidth={2.5} dot={{ fill: "#bfff3a", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#bfff3a", cursor: "pointer" }} animationDuration={800} />
          <Line type="linear" dataKey="outstanding" name="Outstanding" stroke="#ff4d8b" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: "#ff4d8b", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff4d8b", cursor: "pointer" }} animationDuration={1000} />
          <Line type="linear" dataKey="netProfit" name="Net Profit" stroke="#3affd1" strokeWidth={2} dot={{ fill: "#3affd1", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#3affd1", cursor: "pointer" }} animationDuration={1200} />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-5 mt-3">
        {[{ color: "#bfff3a", label: "Revenue" }, { color: "#ff4d8b", label: "Outstanding" }, { color: "#3affd1", label: "Net Profit" }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
