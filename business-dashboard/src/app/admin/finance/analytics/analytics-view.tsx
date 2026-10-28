"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, Treemap, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { analyticsAction } from "@/app/actions";
import { ChartCard, DataTable, type ChartTable } from "@/components/dashboard/chart-card";
import { SeriesChart, RankedBars, Donut, SERIES, GRID, INK, axis, tooltip, short, height, type SeriesRow } from "@/components/dashboard/chart-kit";
import {
  MEASURES, BREAKDOWNS, CHART_TYPES, ALLOWED, TIME, COLLECTOR_MEANING, labelOf, isAllowed,
  type AnalyticsQuery, type AnalyticsRow, type Breakdown, type ChartType, type Measure,
} from "@/lib/analytics";
import { waterfall, leadFunnel, revenueTree, paymentCalendar, sizeVsDays, yearOnYear, WEEKDAYS, type TreeNode } from "@/lib/gallery-data";
import { lastMonths, dayLabel } from "@/lib/finance-data";
import { names } from "@/lib/overview-data";
import { tt } from "@/lib/ledger";
import type { Client, Project, Invoice, Expense, Lead, FinanceHistory } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  leads: Lead[];
  history: FinanceHistory;
  today: string;
  initialQuery: AnalyticsQuery;
  initialRows: AnalyticsRow[];
};

const MEASURE_TEXT: Record<Measure, string> = {
  collected: "Money received from clients: recorded payments, plus invoices marked Paid before the ledger began, by payment date.",
  invoiced: "The value of invoices sent (drafts and voided invoices left out), by issue date.",
  outstanding: "The unpaid balance on sent invoices, placed on their due date. Only due dates inside the chosen dates count.",
  expenses: "Everything spent, by expense date.",
  profit: "Money collected minus expenses, before founder pay.",
  founder_pay: "Each founder's pay (base plus bonus) from the payments collected, by payment date.",
  cash: "Money held: the running balance at the end of each period, or the balance on the To date when broken down by holder. Starts at the ledger cutover.",
};

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const keyLabel = (b: Breakdown, k: string) => (b === "month" ? MONTH.format(new Date(`${k}-01T00:00:00Z`)) : labelOf(k));

/** Every period between From and To for time breakdowns, so empty ones show as zero. */
function periodKeys(q: AnalyticsQuery, rows: AnalyticsRow[]): string[] {
  const found = [...new Set(rows.map((r) => r.key))];
  if (!TIME.includes(q.breakdown)) return found;
  const keys: string[] = [];
  let [y, m] = q.from.split("-").map(Number);
  const [ty, tm] = q.to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const k = q.breakdown === "month" ? `${y}-${String(m).padStart(2, "0")}` : q.breakdown === "quarter" ? `${y}-Q${Math.ceil(m / 3)}` : String(y);
    if (!keys.includes(k)) keys.push(k);
    if (++m > 12) { m = 1; y++; }
  }
  // Cash keeps its running balance into empty periods; other measures are zero there.
  return [...new Set([...keys, ...found])].sort();
}

const selectCls = "min-h-10 rounded-[4px] border border-[#DCE1E8] bg-white px-2 text-sm text-[#1B2533]";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-[#4A5568]">
    {label}
    {children}
  </label>
);

function Builder({ initialQuery, initialRows }: Pick<Props, "initialQuery" | "initialRows">) {
  // `q` is what the controls show; `shown` is what the chart draws. The chart
  // only changes when its numbers arrive, so a failed request never leaves a
  // new title over old numbers.
  const [q, setQ] = useState(initialQuery);
  const [shown, setShown] = useState({ q: initialQuery, rows: initialRows });
  const [type, setType] = useState<ChartType>("bar");
  const [pending, start] = useTransition();

  function run(next: AnalyticsQuery) {
    // Keep the breakdown and split valid for the new measure.
    const ok = ALLOWED[next.measure];
    const fixed = { ...next, breakdown: ok.includes(next.breakdown) ? next.breakdown : ok[0] };
    if (fixed.split && !isAllowed(fixed)) fixed.split = null;
    setQ(fixed);
    if (fixed.from > fixed.to) return toast.error("The From date is after the To date.");
    start(async () => {
      try {
        const res = await analyticsAction(fixed);
        if (res.ok) setShown({ q: fixed, rows: res.rows });
        else toast.error(res.error);
      } catch {
        // Signed out, or the server failed: keep the last chart and say so.
        toast.error("Could not load that chart. Refresh the page and try again.");
      }
    });
  }

  const splits = ALLOWED[q.measure].filter((b) => b !== q.breakdown && !TIME.includes(b));
  const { q: sq, rows } = shown;
  const series = [...new Set(rows.map((r) => r.series))];
  // Cash is a balance: a period with no movement keeps the last balance, it does not drop to zero.
  const carry = new Map<string, number>();
  const pivot: SeriesRow[] = periodKeys(sq, rows).map((k) => ({
    label: keyLabel(sq.breakdown, k),
    ...Object.fromEntries(series.map((s) => {
      const found = rows.find((r) => r.key === k && r.series === s)?.value;
      const v = found ?? (sq.measure === "cash" && TIME.includes(sq.breakdown) ? carry.get(s) ?? 0 : 0);
      carry.set(s, v);
      return [s || "value", v];
    })),
  }));
  const seriesDefs = series.map((s) => ({ key: s || "value", name: s ? labelOf(s) : MEASURES[sq.measure] }));
  const title = `${MEASURES[sq.measure]} by ${BREAKDOWNS[sq.breakdown].toLowerCase()}${sq.split ? `, split by ${BREAKDOWNS[sq.split].toLowerCase()}` : ""}`;
  const description = `${MEASURE_TEXT[sq.measure]} From ${dayLabel(sq.from)} ${sq.from.slice(0, 4)} to ${dayLabel(sq.to)} ${sq.to.slice(0, 4)}.`;
  const slices = pivot.map((r) => ({ name: r.label, value: seriesDefs.reduce((t, s) => t + Number(r[s.key] ?? 0), 0) }));
  const table: ChartTable = {
    columns: [BREAKDOWNS[sq.breakdown], ...seriesDefs.map((s) => s.name), ...(seriesDefs.length > 1 ? ["Total"] : [])],
    rows: pivot.map((r) => [r.label, ...seriesDefs.map((s) => tt(Number(r[s.key] ?? 0))), ...(seriesDefs.length > 1 ? [tt(seriesDefs.reduce((t, s) => t + Number(r[s.key] ?? 0), 0))] : [])]),
  };

  return (
    <section className="space-y-3 border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Chart builder</h2>
        <p className="mt-1 max-w-3xl text-xs text-[#4A5568]">
          Pick what to measure, how to break it down and the dates. The numbers are added up by the database, so they match the rest of the dashboard. The table and the downloads are in the enlarged view.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Field label="Measure">
          <select className={selectCls} value={q.measure} onChange={(e) => run({ ...q, measure: e.target.value as Measure })}>
            {Object.entries(MEASURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Break down by">
          <select className={selectCls} value={q.breakdown} onChange={(e) => run({ ...q, breakdown: e.target.value as Breakdown })}>
            {ALLOWED[q.measure].map((b) => <option key={b} value={b}>{b === "collector" ? COLLECTOR_MEANING[q.measure] ?? BREAKDOWNS[b] : BREAKDOWNS[b]}</option>)}
          </select>
        </Field>
        <Field label="Split by">
          <select className={selectCls} value={q.split ?? ""} onChange={(e) => run({ ...q, split: (e.target.value || null) as Breakdown | null })} disabled={splits.length === 0}>
            <option value="">Nothing</option>
            {splits.map((b) => <option key={b} value={b}>{b === "collector" ? COLLECTOR_MEANING[q.measure] ?? BREAKDOWNS[b] : BREAKDOWNS[b]}</option>)}
          </select>
        </Field>
        <Field label="Chart">
          <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as ChartType)}>
            {Object.entries(CHART_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="From">
          <input type="date" className={selectCls} value={q.from} max={q.to} onChange={(e) => e.target.value && run({ ...q, from: e.target.value })} />
        </Field>
        <Field label="To">
          <input type="date" className={selectCls} value={q.to} min={q.from} onChange={(e) => e.target.value && run({ ...q, to: e.target.value })} />
        </Field>
      </div>
      <div className={pending ? "opacity-60 transition-opacity" : ""} aria-busy={pending}>
        {type === "pie" ? (
          <Donut title={title} description={description} data={slices.filter((s) => s.value > 0)} centre={MEASURES[sq.measure]} />
        ) : type === "table" ? (
          <ChartCard title={title} description={description} table={table} chart={() => <DataTable table={table} />} />
        ) : (
          <SeriesChart title={title} description={description} rows={pivot} series={seriesDefs} kind={type === "stacked" ? "stacked" : type} total={seriesDefs.length > 1} labelHeader={BREAKDOWNS[sq.breakdown]} />
        )}
      </div>
    </section>
  );
}

export function AnalyticsView({ clients, projects, invoices, expenses, leads, history, today, initialQuery, initialRows }: Props) {
  const months = useMemo(() => lastMonths(today), [today]);
  const [month, setMonth] = useState(months[months.length - 1]);
  const nameOf = useMemo(() => names(clients, projects), [clients, projects]);
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.Name])), [projects]);
  const INV = ["Invoice", "Client", "Paid", "Amount", "Notes"];
  const invRow = (i: Invoice) => [i["Invoice Number"] ?? "", nameOf(i), i["Paid Date"] ?? "", tt(i.Amount ?? 0), i.Notes ?? ""];
  const paid = invoices.filter((i) => i.Status === "Paid");

  const steps = waterfall(month, invoices, expenses, history);
  const funnel = leadFunnel(leads, invoices, projects);
  const tree = revenueTree(invoices, projects, clients);
  const calendar = paymentCalendar(invoices, months);
  const calMax = Math.max(1, ...calendar.flat().map((c) => c.amount));
  const scatter = sizeVsDays(invoices, clients, projects);
  const yoy = yearOnYear(invoices, today);
  const year = Number(today.slice(0, 4));
  const monthName = MONTH.format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="space-y-4">
      <Builder initialQuery={initialQuery} initialRows={initialRows} />

      <h2 className="text-[15px] font-semibold text-[#1B2533]">Gallery</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard
          title={`Where ${monthName}'s money went`}
          description="A waterfall for one month: what was invoiced, what was collected, then expenses and founder pay coming off, leaving what the business kept. Pick the month below the chart."
          table={{ columns: ["Step", "Amount"], rows: steps.map((s) => [s.label, tt(s.kind === "down" ? -s.value : s.value)]) }}
          chart={(large) => (
            <>
              <ResponsiveContainer width="100%" height={height(large)}>
                <BarChart data={steps} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...axis} interval={0} tickFormatter={(t: string) => (t === "Kept by the business" ? "Kept" : t)} />
                  <YAxis {...axis} axisLine={false} tickFormatter={short} width={64} />
                  <Tooltip {...tooltip} formatter={(v: unknown, n: unknown) => (n === "base" ? null : tt(Number(v)))} />
                  <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {steps.map((s) => <Cell key={s.label} fill={s.kind === "down" ? SERIES[1] : s.label === "Kept by the business" ? SERIES[2] : SERIES[0]} />)}
                    <LabelList dataKey="value" position="top" fill={INK} fontSize={12} formatter={(v: unknown) => short(Number(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {!large && (
                <div className="mt-2 print:hidden" onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-[#4A5568]">
                    Month{" "}
                    <select className={selectCls} value={month} onChange={(e) => setMonth(e.target.value)}>
                      {[...months].reverse().map((m) => <option key={m} value={m}>{MONTH.format(new Date(`${m}-01T00:00:00Z`))}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </>
          )}
        />

        <RankedBars
          title="From lead to cash"
          description="Every lead, then the ones won, then those whose client has been invoiced, then those whose client has paid. A big drop between two steps shows where deals get lost."
          data={funnel.map((s) => ({ name: s.name, value: s.value }))}
          valueLabel="Leads"
          format="count"
          records={(name) => ({
            columns: ["Lead", "Business", "Stage"],
            rows: (funnel.find((s) => s.name === name)?.leads ?? []).map((l) => [l.Name, l["Business Name"] ?? "", l.Status ?? ""]),
          })}
        />

        <ChartCard
          title="Revenue by client and project (all time)"
          description="Each box is a client, sized by what they have paid; the boxes inside are their projects. Click a box to see its paid invoices."
          table={{ columns: ["Client", "Project", "Paid revenue"], rows: tree.flatMap((c) => (c.children ?? []).map((p) => [c.name, p.name, tt(p.value)])) }}
          records={(key) => {
            const [client, project] = key.split(" · ");
            return {
              columns: INV,
              rows: paid.filter((i) => nameOf(i) === client && (!project || ((i.Project?.[0] && projectName.get(i.Project[0])) || "No project") === project)).map(invRow),
            };
          }}
          chart={(large, select) => (
            <ResponsiveContainer width="100%" height={large ? 460 : 260}>
              <Treemap
                data={tree as unknown as Record<string, unknown>[]}
                dataKey="value"
                isAnimationActive={false}
                stroke="#fff"
                content={<TreeCell select={select} />}
              />
            </ResponsiveContainer>
          )}
        />

        <ChartCard
          title="When clients pay: weekday by month"
          description="Paid revenue by the weekday and month of each invoice's paid date. Darker squares mean more money came in. Useful for timing invoices and follow-ups. Click a square to see its invoices."
          table={{ columns: ["Weekday", ...months.map((m) => MONTH.format(new Date(`${m}-01T00:00:00Z`)))], rows: WEEKDAYS.map((d, r) => [d, ...calendar[r].map((c) => tt(c.amount))]) }}
          records={(key) => {
            const [d, m] = key.split("|");
            return { columns: INV, rows: paid.filter((i) => i["Paid Date"]?.startsWith(m) && WEEKDAYS[(new Date(`${i["Paid Date"]}T12:00:00Z`).getUTCDay() + 6) % 7] === d).map(invRow) };
          }}
          chart={(large, select) => (
            <div className="overflow-x-auto">
              <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `40px repeat(${months.length}, minmax(0, 1fr))` }}>
                <span />
                {months.map((m) => <span key={m} className="text-center text-[11px] text-[#5A6678]">{MONTH.format(new Date(`${m}-01T00:00:00Z`)).split(" ")[0]}</span>)}
                {WEEKDAYS.map((d, r) => [
                  <span key={d} className="text-[11px] leading-7 text-[#5A6678]">{d}</span>,
                  ...months.map((m, c) => {
                    const cell = calendar[r][c];
                    return (
                      <button
                        key={`${d}${m}`}
                        type="button"
                        aria-label={`${d}, ${MONTH.format(new Date(`${m}-01T00:00:00Z`))}: ${tt(cell.amount)} from ${cell.count} invoices`}
                        title={`${tt(cell.amount)} · ${cell.count} invoices`}
                        onClick={(e) => { e.stopPropagation(); if (cell.count) select(`${d}|${m}`); }}
                        className={`${large ? "h-10" : "h-7"} rounded-[3px] border border-[#EEF1F5]`}
                        style={{ background: cell.amount ? `rgba(42, 120, 214, ${0.15 + 0.85 * (cell.amount / calMax)})` : "#F7F8FA" }}
                      />
                    );
                  }),
                ])}
              </div>
            </div>
          )}
        />

        <ChartCard
          title="Invoice size against days to get paid"
          description="Each dot is a paid invoice: how big it was (across) and how many days it took to be paid (up). Dots high up are slow payers; a cluster high on the right means big invoices get paid late. Click a dot to see the invoice."
          table={{ columns: ["Invoice", "Client", "Amount", "Days to paid"], rows: scatter.map((p) => [p.name, p.client, tt(p.amount), String(p.days)]) }}
          records={(name) => ({ columns: INV, rows: paid.filter((i) => i["Invoice Number"] === name).map(invRow) })}
          chart={(large, select) => (
            <ResponsiveContainer width="100%" height={height(large)}>
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="amount" name="Amount" {...axis} tickFormatter={short} />
                <YAxis type="number" dataKey="days" name="Days" {...axis} axisLine={false} width={40} tickFormatter={(v: number) => `${v}d`} />
                <ZAxis range={[70, 70]} />
                <Tooltip {...tooltip} formatter={(v: unknown, n: unknown) => (n === "Amount" ? tt(Number(v)) : `${v} days`)} />
                <Scatter data={scatter} fill={SERIES[0]} isAnimationActive={false} style={{ cursor: "pointer" }}
                  onClick={(p: { payload?: { name?: string } }, _i: number, e: React.MouseEvent) => { e?.stopPropagation?.(); if (p?.payload?.name) select(p.payload.name); }} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        />

        <SeriesChart
          title={`Revenue through the year: ${year} against ${year - 1}`}
          description="Running total of paid invoices from January, this year against last year. The gap between the lines is how far ahead or behind the business is."
          rows={yoy}
          series={[{ key: "thisYear", name: String(year), color: SERIES[0] }, { key: "lastYear", name: String(year - 1), color: SERIES[1] }]}
          kind="line"
        />
      </div>
    </div>
  );
}

type CellProps = { x?: number; y?: number; width?: number; height?: number; depth?: number; name?: string; value?: number; index?: number; root?: TreeNode; select?: (key: string) => void };

/** One treemap box: clients are outlined blocks, projects fill them. */
function TreeCell({ x = 0, y = 0, width = 0, height: h = 0, depth = 0, name = "", value = 0, index = 0, root, select }: CellProps) {
  if (depth === 0) return null;
  const client = depth === 1 ? name : root?.name ?? "";
  const key = depth === 1 ? name : `${client} · ${name}`;
  const fill = depth === 1 ? SERIES[index % SERIES.length] : "rgba(255,255,255,0.18)";
  return (
    <g onClick={(e) => { e.stopPropagation(); select?.(key); }} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={width} height={h} fill={fill} stroke="#fff" strokeWidth={depth === 1 ? 2 : 1} />
      {width > 70 && h > 30 && depth === 1 && (
        <>
          <text x={x + 6} y={y + 16} fill="#fff" stroke="none" fontSize={12} fontWeight={600}>{name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + "…" : name}</text>
          <text x={x + 6} y={y + 31} fill="#fff" stroke="none" fontSize={11}>{short(value)}</text>
        </>
      )}
    </g>
  );
}
