"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ChartCard } from "./chart-card";
import { tt } from "@/lib/ledger";
import type { MonthRow, Slice } from "@/lib/overview-data";

// Validated categorical order (dataviz reference palette, light mode): blue,
// orange, aqua, yellow, magenta. The lighter three sit under 3:1 on white, so
// every chart also prints its values (legend rows, labels, the enlarged table).
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
const INK = "#1B2533";
const MUTED = "#5A6678";
const GRID = "#EEF1F5";

const short = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${n < 0 ? "-" : ""}TT$${s}`;
};
const pct = (v: number, total: number) => (total ? `${Math.round((v / total) * 100)}%` : "0%");
const axis = { stroke: GRID, tick: { fill: MUTED, fontSize: 12 }, tickLine: false } as const;
const tooltip = {
  formatter: (v: unknown) => tt(Number(v)),
  contentStyle: { border: "1px solid #DCE1E8", borderRadius: 4, fontSize: 12, color: INK },
  cursor: { fill: "#0E1A2B0D", stroke: "#94A3B8" },
} as const;
const height = (large: boolean) => (large ? 420 : 220);

function Legend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#334155]">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: i.color }} />
          {i.name}
          {i.value && <span className="font-semibold text-[#1B2533]">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function MonthlyMoneyChart({ data }: { data: MonthRow[] }) {
  const lines = [
    { key: "revenue", name: "Revenue", color: SERIES[0] },
    { key: "expenses", name: "Expenses", color: SERIES[1] },
    { key: "profit", name: "Profit", color: SERIES[2] },
  ] as const;
  return (
    <ChartCard
      title="Revenue, expenses and profit by month"
      description="Last 12 months. Revenue is paid invoices in the month they were paid; profit is revenue minus expenses. Watch for months where the orange line rises above the blue one."
      table={{ columns: ["Month", "Revenue", "Expenses", "Profit"], rows: data.map((d) => [d.month, tt(d.revenue), tt(d.expenses), tt(d.profit)]) }}
      chart={(large) => (
        <>
          <ResponsiveContainer width="100%" height={height(large)}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
              <ReferenceLine y={0} stroke="#CBD5E1" />
              <Tooltip {...tooltip} />
              {lines.map((l) => (
                <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: l.color }} activeDot={{ r: 5 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <Legend items={lines.map((l) => ({ name: l.name, color: l.color }))} />
        </>
      )}
    />
  );
}

export function RevenueToDateChart({ data }: { data: MonthRow[] }) {
  const last = data.at(-1)?.revenueToDate ?? 0;
  return (
    <ChartCard
      title="Total revenue earned to date"
      description={`Running total of every paid invoice since the business started, at the end of each month: ${tt(last)} now. A flat stretch means no invoices were paid that month.`}
      table={{ columns: ["Month", "Revenue to date", "Paid that month"], rows: data.map((d) => [d.month, tt(d.revenueToDate), tt(d.revenue)]) }}
      chart={(large) => (
        <ResponsiveContainer width="100%" height={height(large)}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
            <Tooltip {...tooltip} />
            <Line dataKey="revenueToDate" name="Revenue to date" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: SERIES[0] }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    />
  );
}

export function ProfitBarsChart({ data }: { data: MonthRow[] }) {
  return (
    <ChartCard
      title="Profit or loss each month"
      description="Revenue minus expenses for each of the last 12 months. Blue bars above the line are profit; orange bars below it are a loss."
      table={{ columns: ["Month", "Profit or loss"], rows: data.map((d) => [d.month, tt(d.profit)]) }}
      chart={(large) => (
        <>
          <ResponsiveContainer width="100%" height={height(large)}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
              <ReferenceLine y={0} stroke="#94A3B8" />
              <Tooltip {...tooltip} />
              <Bar dataKey="profit" name="Profit or loss" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {data.map((d) => <Cell key={d.month} fill={d.profit < 0 ? SERIES[1] : SERIES[0]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Legend items={[{ name: "Profit", color: SERIES[0] }, { name: "Loss", color: SERIES[1] }]} />
        </>
      )}
    />
  );
}

/** Horizontal bars for a ranked list of named amounts. */
function RankedBars({ title, description, data, valueLabel }: { title: string; description: string; data: Slice[]; valueLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      table={{ columns: ["Name", valueLabel, "Share"], rows: [...data.map((d) => [d.name, tt(d.value), pct(d.value, total)]), ["Total", tt(total), "100%"]] }}
      chart={(large) =>
        data.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#5A6678]">Nothing to show yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(large ? 320 : 160, data.length * (large ? 44 : 32) + 24)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={large ? 180 : 120} />
              <Tooltip {...tooltip} />
              <Bar dataKey="value" name={valueLabel} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}
                label={{ position: "right", fill: INK, fontSize: 12, formatter: (v: unknown) => short(Number(v)) }} />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}

export function OwedByClientChart({ data }: { data: Slice[] }) {
  return (
    <RankedBars
      title="Owed to us, by client"
      description="Unpaid balance on every sent invoice, grouped by client. The longest bars are the clients to chase first."
      data={data}
      valueLabel="Still owed"
    />
  );
}

export function TopClientsChart({ data }: { data: Slice[] }) {
  return (
    <RankedBars
      title="Top clients by revenue (all time)"
      description="Paid invoices per client since the business started; smaller clients are grouped as Other. One client far ahead of the rest is a dependency risk."
      data={data}
      valueLabel="Paid revenue"
    />
  );
}

export function LeadsByStageChart({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title="Sales leads at each stage"
      description={`How many of the ${total} leads sit at each step of the pipeline, from first contact to won or lost. A pile-up at one stage shows where deals stall.`}
      table={{ columns: ["Stage", "Leads", "Share"], rows: data.map((d) => [d.name, d.value, pct(d.value, total)]) }}
      chart={(large) => (
        <ResponsiveContainer width="100%" height={height(large)}>
          <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(s: string) => (s === "Proposal Sent" ? "Proposal" : s)} />
            <YAxis {...axis} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip {...tooltip} formatter={(v: unknown) => `${v} leads`} />
            <Bar dataKey="value" name="Leads" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}
              label={{ position: "top", fill: INK, fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    />
  );
}

/** Donut with a value legend beside it. */
function Donut({ title, description, data, centre }: { title: string; description: string; data: Slice[]; centre: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      table={{ columns: ["Name", "Amount", "Share"], rows: [...data.map((d) => [d.name, tt(d.value), pct(d.value, total)]), ["Total", tt(total), "100%"]] }}
      chart={(large) => (
        <div className={`flex flex-col items-center gap-4 ${large ? "sm:flex-row" : ""}`}>
          <div className="relative shrink-0" style={{ width: large ? 320 : 170, height: large ? 320 : 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={d.name} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-[#5A6678]">{centre}</span>
              <span className={`${large ? "text-2xl" : "text-base"} font-semibold text-[#1B2533]`}>{short(total)}</span>
            </div>
          </div>
          <ul className="w-full space-y-2 text-sm">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] pb-1.5">
                <span className="flex items-center gap-2 text-[#334155]">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SERIES[i % SERIES.length] }} />
                  {d.name}
                </span>
                <span className="text-right">
                  <span className="font-semibold text-[#1B2533]">{tt(d.value)}</span>
                  <span className="ml-2 text-xs text-[#5A6678]">{pct(d.value, total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    />
  );
}

export function MoneyHeldChart({ data }: { data: Slice[] }) {
  return (
    <Donut
      title="Where the money is now"
      description="All money the business holds, by who has it: the business cash in the safe, and money Zane or Mikey collected that is not sorted yet."
      data={data}
      centre="Held"
    />
  );
}

export function ServiceMixChart({ data }: { data: Slice[] }) {
  return (
    <Donut
      title="Revenue by service type (all time)"
      description="Paid invoices grouped by the service type of their project. Unspecified means the invoice's project has no service type set."
      data={data}
      centre="Revenue"
    />
  );
}
