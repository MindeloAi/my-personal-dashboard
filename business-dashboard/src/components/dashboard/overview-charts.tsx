"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ChartCard } from "./chart-card";
import {
  SERIES, INK, GRID, short, pct, axis, tooltip, height, clickDot, clickBar, Legend,
  RankedBars, Donut, PEOPLE_COLORS, type Recs,
} from "./chart-kit";
import { tt } from "@/lib/ledger";
import type { MonthRow, Slice } from "@/lib/overview-data";

export function MonthlyMoneyChart({ data, records }: { data: MonthRow[] } & Recs) {
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
      records={records}
      chart={(large, select) => (
        <>
          <ResponsiveContainer width="100%" height={height(large)}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
              <ReferenceLine y={0} stroke="#CBD5E1" />
              <Tooltip {...tooltip} />
              {lines.map((l) => (
                <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={clickDot(l.color, select)} activeDot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <Legend items={lines.map((l) => ({ name: l.name, color: l.color }))} />
        </>
      )}
    />
  );
}

export function RevenueToDateChart({ data, records }: { data: MonthRow[] } & Recs) {
  const last = data.at(-1)?.revenueToDate ?? 0;
  return (
    <ChartCard
      title="Total revenue earned to date"
      description={`Running total of every paid invoice since the business started, at the end of each month: ${tt(last)} now. A flat stretch means no invoices were paid that month.`}
      table={{ columns: ["Month", "Revenue to date", "Paid that month"], rows: data.map((d) => [d.month, tt(d.revenueToDate), tt(d.revenue)]) }}
      records={records}
      chart={(large, select) => (
        <ResponsiveContainer width="100%" height={height(large)}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
            <Tooltip {...tooltip} />
            <Line dataKey="revenueToDate" name="Revenue to date" stroke={SERIES[0]} strokeWidth={2} dot={clickDot(SERIES[0], select)} activeDot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    />
  );
}

export function ProfitBarsChart({ data, records }: { data: MonthRow[] } & Recs) {
  return (
    <ChartCard
      title="Profit or loss each month"
      description="Revenue minus expenses for each of the last 12 months. Blue bars above the line are profit; orange bars below it are a loss."
      table={{ columns: ["Month", "Profit or loss"], rows: data.map((d) => [d.month, tt(d.profit)]) }}
      records={records}
      chart={(large, select) => (
        <>
          <ResponsiveContainer width="100%" height={height(large)}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
              <ReferenceLine y={0} stroke="#94A3B8" />
              <Tooltip {...tooltip} />
              <Bar dataKey="profit" name="Profit or loss" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} onClick={clickBar(select, "month")} style={{ cursor: "pointer" }}>
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

export function OwedByClientChart({ data, records }: { data: Slice[] } & Recs) {
  return (
    <Donut
      title="Owed to us, by client"
      description="Unpaid balance on every sent invoice, split by client. The biggest slices are the clients to chase first. Click a slice to see their unpaid invoices."
      data={data}
      centre="Owed"
      records={records}
    />
  );
}

export function TopClientsChart({ data, records }: { data: Slice[] } & Recs) {
  return (
    <RankedBars
      title="Top clients by revenue (all time)"
      description="Paid invoices per client since the business started; smaller clients are grouped as Everything else. One client far ahead of the rest is a dependency risk."
      data={data}
      valueLabel="Paid revenue"
      records={records}
    />
  );
}

export function LeadsByStageChart({ data, records }: { data: Slice[] } & Recs) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title="Sales leads at each stage"
      description={`How many of the ${total} leads sit at each step of the pipeline, from first contact to won or lost. A pile-up at one stage shows where deals stall.`}
      table={{ columns: ["Stage", "Leads", "Share"], rows: data.map((d) => [d.name, d.value, pct(d.value, total)]) }}
      records={records}
      chart={(large, select) => (
        <ResponsiveContainer width="100%" height={height(large)}>
          <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(s: string) => (s === "Proposal Sent" ? "Proposal" : s)} />
            <YAxis {...axis} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip {...tooltip} formatter={(v: unknown) => `${v} leads`} />
            <Bar dataKey="value" name="Leads" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} onClick={clickBar(select, "name")} style={{ cursor: "pointer" }}
              label={{ position: "top", fill: INK, fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    />
  );
}

export function MoneyHeldChart({ data, records }: { data: Slice[] } & Recs) {
  return (
    <Donut
      title="Where the money is now"
      description="All money the business holds, by who has it: the business cash in the safe, and money Zane or Mikey collected that is not sorted yet."
      data={data}
      centre="Held"
      colors={PEOPLE_COLORS}
      records={records}
    />
  );
}

export function ServiceMixChart({ data, records }: { data: Slice[] } & Recs) {
  return (
    <Donut
      title="Revenue by service type (all time)"
      description="Paid invoices grouped by the service type of their project. Unspecified means the invoice's project has no service type set."
      data={data}
      centre="Revenue"
      records={records}
    />
  );
}
