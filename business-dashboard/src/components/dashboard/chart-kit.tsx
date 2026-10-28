"use client";

// The shared chart pieces for every dashboard chart: one palette, one set of
// axes and tooltips, one click rule. Each chart sits in a ChartCard (title,
// explanation, enlarge, numbers table, records behind a clicked mark).
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ChartCard, type ChartTable } from "./chart-card";
import { tt } from "@/lib/ledger";

// Validated categorical order (dataviz reference palette, light mode): blue,
// orange, aqua, yellow, magenta, violet. The lighter ones sit under 3:1 on
// white, so every chart also prints its values (legend, labels, the table).
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
export const INK = "#1B2533";
export const MUTED = "#5A6678";
export const GRID = "#EEF1F5";

export const short = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${n < 0 ? "-" : ""}TT$${s}`;
};
export const pct = (v: number, total: number) => (total ? `${Math.round((v / total) * 100)}%` : "0%");
export const axis = { stroke: GRID, tick: { fill: MUTED, fontSize: 12 }, tickLine: false } as const;
export const tooltip = {
  formatter: (v: unknown) => tt(Number(v)),
  contentStyle: { border: "1px solid #DCE1E8", borderRadius: 4, fontSize: 12, color: INK },
  cursor: { fill: "#0E1A2B0D", stroke: "#94A3B8" },
} as const;
export const height = (large: boolean) => (large ? 420 : 220);

export type Recs = { records?: (key: string) => ChartTable };

// Clicks go on each dot and bar, not the chart: the chart only knows which
// category is under the pointer after a hover, which a tap on a phone never gives.
type DotProps = { cx?: number; cy?: number; index?: number; payload?: Record<string, unknown> };
/** A visible 8px dot inside a larger invisible hit circle that selects its row. */
export const clickDot = (color: string, select: (key: string) => void, field = "month") =>
  function ClickDot({ cx, cy, index, payload }: DotProps) {
    if (cx == null || cy == null) return <g key={index} />;
    return (
      <g key={index} onClick={(e) => { e.stopPropagation(); if (payload?.[field] != null) select(String(payload[field])); }} style={{ cursor: "pointer" }}>
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />
      </g>
    );
  };
/** Bar click: recharts passes the bar's data row. */
export const clickBar = (select: (key: string) => void, field: string) =>
  (bar: { payload?: Record<string, unknown> }, _i: number, e: React.MouseEvent) => {
    e?.stopPropagation?.();
    const key = bar?.payload?.[field];
    if (key != null) select(String(key));
  };

export function Legend({ items }: { items: { name: string; color: string; value?: string }[] }) {
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

export type Format = "money" | "count" | "days";
const FMT: Record<Format, { full: (n: number) => string; tick: (n: number) => string; width: number }> = {
  money: { full: tt, tick: short, width: 64 },
  count: { full: (n) => n.toLocaleString("en-US"), tick: (n) => n.toLocaleString("en-US"), width: 36 },
  days: { full: (n) => `${Math.round(n)} days`, tick: (n) => `${Math.round(n)}d`, width: 40 },
};

export type SeriesRow = { label: string } & Record<string, string | number>;
export type Series = { key: string; name: string; color?: string };

/**
 * Bars, stacked bars or lines over categories (usually months). Every bar and
 * dot opens the records behind its row; `records` gets the row's label.
 */
export function SeriesChart({
  title, description, rows, series, kind, format = "money", records, signColors, signNames = ["Above zero", "Below zero"], total, shortTicks,
}: {
  title: string;
  description: string;
  rows: SeriesRow[];
  series: Series[];
  kind: "bar" | "stacked" | "line";
  format?: Format;
  /** Single-series bars: colour negative values with the second colour (loss, shortfall). */
  signColors?: [string, string];
  /** Legend names for the two sign colours. */
  signNames?: [string, string];
  /** Add a Total column to the table (stacked charts). */
  total?: boolean;
  /** Category labels too long for the axis: show only their first two words there. */
  shortTicks?: boolean;
} & Recs) {
  const f = FMT[format];
  const color = (i: number, s: Series) => s.color ?? SERIES[i % SERIES.length];
  const num = (r: SeriesRow, k: string) => Number(r[k] ?? 0);
  const table: ChartTable = {
    columns: ["", ...series.map((s) => s.name), ...(total ? ["Total"] : [])],
    rows: rows.map((r) => [
      r.label,
      ...series.map((s) => f.full(num(r, s.key))),
      ...(total ? [f.full(series.reduce((t, s) => t + num(r, s.key), 0))] : []),
    ]),
  };
  const hasNegative = rows.some((r) => series.some((s) => num(r, s.key) < 0));
  return (
    <ChartCard
      title={title}
      description={description}
      table={table}
      records={records}
      chart={(large, select) =>
        rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#5A6678]">Nothing to show yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={height(large)}>
              {kind === "line" ? (
                <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} axisLine={false} tickFormatter={f.tick} width={f.width} />
                  {hasNegative && <ReferenceLine y={0} stroke="#CBD5E1" />}
                  <Tooltip {...tooltip} formatter={(v: unknown) => f.full(Number(v))} />
                  {series.map((s, i) => (
                    <Line key={s.key} dataKey={s.key} name={s.name} stroke={color(i, s)} strokeWidth={2} dot={clickDot(color(i, s), select, "label")} activeDot={false} isAnimationActive={false} connectNulls />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...axis} interval={rows.length > 8 ? "preserveStartEnd" : 0}
                    tickFormatter={shortTicks ? (t: string) => t.split(" ").slice(0, 2).join(" ") : undefined} />
                  <YAxis {...axis} axisLine={false} tickFormatter={f.tick} width={f.width} allowDecimals={format !== "count"} />
                  {hasNegative && <ReferenceLine y={0} stroke="#94A3B8" />}
                  <Tooltip {...tooltip} formatter={(v: unknown) => f.full(Number(v))} />
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.name}
                      fill={color(i, s)}
                      stackId={kind === "stacked" ? "a" : undefined}
                      radius={kind === "stacked" && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                      maxBarSize={kind === "stacked" ? 40 : 32}
                      stroke={kind === "stacked" ? "#fff" : undefined}
                      strokeWidth={kind === "stacked" ? 1 : 0}
                      isAnimationActive={false}
                      onClick={clickBar(select, "label")}
                      style={{ cursor: "pointer" }}
                    >
                      {signColors && rows.map((r) => <Cell key={r.label} fill={num(r, s.key) < 0 ? signColors[1] : signColors[0]} />)}
                    </Bar>
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
            {(series.length > 1 || signColors) && (
              <Legend
                items={
                  signColors
                    ? [{ name: signNames[0], color: signColors[0] }, { name: signNames[1], color: signColors[1] }]
                    : series.map((s, i) => ({ name: s.name, color: color(i, s) }))
                }
              />
            )}
          </>
        )
      }
    />
  );
}

export type Slice = { name: string; value: number };

/** Horizontal bars for a ranked list of named amounts. */
export function RankedBars({ title, description, data, valueLabel, records, format = "money" }: { title: string; description: string; data: Slice[]; valueLabel: string; format?: Format } & Recs) {
  const f = FMT[format];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      table={{ columns: ["Name", valueLabel, "Share"], rows: [...data.map((d) => [d.name, f.full(d.value), pct(d.value, total)]), ["Total", f.full(total), "100%"]] }}
      records={records}
      chart={(large, select) =>
        data.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#5A6678]">Nothing to show yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(large ? 320 : 160, data.length * (large ? 44 : 32) + 24)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={large ? 180 : 120} />
              <Tooltip {...tooltip} formatter={(v: unknown) => f.full(Number(v))} />
              <Bar dataKey="value" name={valueLabel} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} onClick={clickBar(select, "name")} style={{ cursor: "pointer" }}
                label={{ position: "right", fill: INK, fontSize: 12, formatter: (v: unknown) => f.tick(Number(v)) }} />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}

/** Donut with a clickable value legend beside it. */
export function Donut({ title, description, data, centre, records, format = "money" }: { title: string; description: string; data: Slice[]; centre: string; format?: Format } & Recs) {
  const f = FMT[format];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      table={{ columns: ["Name", "Amount", "Share"], rows: [...data.map((d) => [d.name, f.full(d.value), pct(d.value, total)]), ["Total", f.full(total), "100%"]] }}
      records={records}
      chart={(large, select) => (
        <div className={`flex flex-col items-center gap-4 ${large ? "sm:flex-row" : ""}`}>
          <div className="relative shrink-0" style={{ width: large ? 320 : 170, height: large ? 320 : 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false} onClick={(d: { name?: string }, _i: number, e: React.MouseEvent) => { e?.stopPropagation?.(); if (d?.name) select(d.name); }} style={{ cursor: "pointer" }}>
                  {data.map((d, i) => <Cell key={d.name} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Tooltip {...tooltip} formatter={(v: unknown) => f.full(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-[#5A6678]">{centre}</span>
              <span className={`${large ? "text-2xl" : "text-base"} font-semibold text-[#1B2533]`}>{f.tick(total)}</span>
            </div>
          </div>
          <ul className="w-full space-y-2 text-sm">
            {data.map((d, i) => (
              <li key={d.name} className="border-b border-[#EEF1F5]">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); select(d.name); }}
                  className="flex min-h-9 w-full items-center justify-between gap-3 text-left hover:bg-[#F7F8FA]"
                >
                  <span className="flex items-center gap-2 text-[#334155]">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SERIES[i % SERIES.length] }} />
                    {d.name}
                  </span>
                  <span className="text-right">
                    <span className="font-semibold text-[#1B2533]">{f.full(d.value)}</span>
                    <span className="ml-2 text-xs text-[#5A6678]">{pct(d.value, total)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    />
  );
}
