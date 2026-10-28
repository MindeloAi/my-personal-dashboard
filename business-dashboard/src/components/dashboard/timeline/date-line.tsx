"use client";

import { useState } from "react";
import { PANEL } from "@/components/dashboard/clients-list";
import {
  entryTag,
  groupDiamonds,
  groupDots,
  lineWindow,
  litFromEntry,
  litFromItems,
  MONTHS,
  owedItems,
  pct,
  plural,
  type ClientPromise,
  formatDay,
  type Diamond,
  type Dot,
  type Lit,
  type OwedBy,
  type TimelineEntry,
  type UnpaidInvoice,
} from "@/lib/timeline";
import { LATE } from "./form";

type Props = {
  entries: TimelineEntry[];
  promises: ClientPromise[];
  invoices: UnpaidInvoice[];
  today: string;
  lit: Lit | null;
  // scroll is true only for a dot click, so the history scrolls to the entry.
  onLight: (l: Lit, opts?: { scroll?: boolean }) => void;
};

type Tip = { at: number; title: string; lines: string[] };

const DOT_COLOR = { received: "#1E6B3A", sent: "#2563EB", both: "#B45309" } as const;
const SIDE_COLOR: Record<OwedBy, string> = { client: "#B45309", us: "#2563EB" };
const SIDE_LABEL: Record<OwedBy, string> = { client: "Client owes", us: "We owe" };
// Vertical centre of each row inside the strip, in px. Client and us diamonds get their own row so both stay clickable.
const ROW = { dot: 24, axis: 50, client: 68, us: 96 } as const;
const RING = "0 0 0 3px rgba(96,165,250,.45)";

// First day of each month inside the window, by string arithmetic.
function monthStarts(start: string, end: string): { day: string; label: string }[] {
  const out: { day: string; label: string }[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  for (;;) {
    const day = `${y}-${String(m).padStart(2, "0")}-01`;
    if (day > end) return out;
    if (day >= start) out.push({ day, label: MONTHS[m - 1] });
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
}

export function DateLine({ entries, promises, invoices, today, lit, onLight }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);

  const owed = (["client", "us"] as const).map((side) => ({ side, items: owedItems(promises, invoices, side) }));
  const dated = owed.flatMap(({ items }) =>
    items.flatMap((i) => {
      const date = i.type === "promise" ? i.promise.dueOn : i.invoice.dueOn;
      return date ? [{ date, late: date < today }] : [];
    }),
  );
  const w = lineWindow(today, dated);
  const dots = groupDots(entries, w);
  const diamonds = owed.flatMap(({ side, items }) => groupDiamonds(items, side, today, w));

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const promiseById = new Map(promises.map((p) => [p.id, p]));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const litEntries = new Set(lit?.entries);
  const litPromises = new Set(lit?.promises);
  const litInvoices = new Set(lit?.invoices);

  const dotOn = (d: Dot) => d.entryIds.some((id) => litEntries.has(id));
  const diaOn = (d: Diamond) =>
    d.promiseIds.some((id) => litPromises.has(id)) || d.invoiceIds.some((id) => litInvoices.has(id));

  const dotTip = (d: Dot): Tip => ({
    at: pct(d.date, w),
    title: formatDay(d.date),
    lines: d.entryIds.flatMap((id) => {
      const e = entryById.get(id);
      return e ? [`${entryTag(e.kind, e.direction)}: ${e.summary}`] : [];
    }),
  });
  const diaTip = (d: Diamond): Tip => ({
    at: pct(d.date, w),
    title: `${formatDay(d.date)} · ${SIDE_LABEL[d.side]}${d.late ? " · late" : ""}`,
    lines: [
      ...d.promiseIds.flatMap((id) => promiseById.get(id)?.what ?? []),
      ...d.invoiceIds.flatMap((id) => {
        const inv = invoiceById.get(id);
        return inv ? [`Invoice ${inv.number}`] : [];
      }),
    ],
  });

  const show = (t: Tip) => ({
    onMouseEnter: () => setTip(t),
    onFocus: () => setTip(t),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const hit =
    "group absolute -ml-3.5 hover:z-20 focus:z-20 size-7 flex items-center justify-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400";
  const mark = "block size-3 transition-transform duration-150 group-hover:scale-[1.45] group-focus-visible:scale-[1.45]";

  return (
    <section className={`${PANEL} p-4`} aria-label="Date line">
      <div className="mb-2 flex flex-wrap justify-between gap-x-3 text-sm font-semibold text-[#1B2533]">
        <span>
          {formatDay(w.start).slice(4)} to {formatDay(w.end).slice(4)}
        </span>
        <span className="text-[11px] font-medium text-[#5A6678]">
          top row = contact · bottom rows = due dates (amber client, blue us)
        </span>
      </div>
      <div
        className="relative isolate mx-3 h-[114px]"
        onPointerDown={(e) => {
          // Touch never fires mouseleave, so a press outside any marker closes the card.
          if (!(e.target as Element).closest("button")) setTip(null);
        }}
      >
        <div className="absolute inset-x-0 h-0.5 bg-[#CBD5E1]" style={{ top: ROW.axis - 1 }} />
        {monthStarts(w.start, w.end).map(({ day, label }) => (
          <span
            key={day}
            className="absolute -translate-x-1/2 text-[10px] text-[#5A6678]"
            style={{ left: `${pct(day, w)}%`, top: ROW.axis - 20 }}
          >
            {label}
          </span>
        ))}
        <div className="absolute inset-y-0.5 -ml-px w-0.5 bg-blue-600" style={{ left: `${pct(today, w)}%` }}>
          <span className="absolute -top-0.5 left-1.5 text-[10px] font-bold text-blue-400">Today</span>
        </div>

        {dots.map((d) => {
          const on = dotOn(d);
          const n = d.entryIds.length;
          const first = entryById.get(d.entryIds[0]);
          const what = n === 1 && first ? entryTag(first.kind, d.direction) : plural(n, "entry", "entries");
          const t = dotTip(d);
          return (
            <span key={d.date}>
              <button
                type="button"
                className={`${hit}${on ? " z-10" : ""}`}
                style={{ left: `${pct(d.date, w)}%`, top: ROW.dot - 14 }}
                aria-label={`${what}, ${formatDay(d.date)}`}
                aria-pressed={on}
                onClick={() => {
                  setTip(t);
                  const parts = d.entryIds.map((id) => litFromEntry(id, promises));
                  onLight({
                    entries: parts.flatMap((p) => p.entries),
                    promises: [...new Set(parts.flatMap((p) => p.promises))],
                    invoices: [],
                  }, { scroll: true });
                }}
                {...show(t)}
              >
                <span
                  className={`${mark} rounded-full ${on ? "scale-[1.45]" : ""}`}
                  style={{ background: DOT_COLOR[d.direction], boxShadow: on ? RING : undefined }}
                />
                {n > 1 && (
                  <span className="pointer-events-none absolute right-0 top-0 text-[10px] font-bold leading-none text-[#334155]">
                    {n}
                  </span>
                )}
              </button>
            </span>
          );
        })}

        {diamonds.map((d) => {
          const on = diaOn(d);
          const n = d.promiseIds.length + d.invoiceIds.length;
          const row = ROW[d.side];
          const t = diaTip(d);
          return (
            <span key={d.side + d.date}>
              <button
                type="button"
                className={`${hit}${on ? " z-10" : ""}`}
                style={{ left: `${pct(d.date, w)}%`, top: row - 14 }}
                aria-label={`${SIDE_LABEL[d.side]}: ${plural(n, "item")} due ${formatDay(d.date)}${d.late ? ", late" : ""}`}
                aria-pressed={on}
                onClick={() => {
                  setTip(t);
                  onLight(litFromItems(d.promiseIds, d.invoiceIds, promises));
                }}
                {...show(t)}
              >
                <span
                  className={`${mark} rotate-45 border-2 ${on ? "scale-[1.45]" : ""}`}
                  style={{
                    borderColor: SIDE_COLOR[d.side],
                    background: d.late ? LATE : "#F3F5F8",
                    boxShadow: on ? RING : undefined,
                  }}
                />
                {n > 1 && (
                  <span
                    className="pointer-events-none absolute right-0 top-0 text-[10px] font-bold leading-none"
                    style={{ color: SIDE_COLOR[d.side] }}
                  >
                    {n}
                  </span>
                )}
              </button>
            </span>
          );
        })}

        {tip && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 w-[230px] max-w-full -translate-x-1/2 rounded-[4px] border border-[#DCE1E8] bg-[#FFFFFF] px-2.5 py-2 text-[11.5px] text-[#334155] shadow-md"
            style={{ top: 118, left: `clamp(115px, ${tip.at}%, calc(100% - 115px))` }}
          >
            <b className="text-[#1B2533]">{tip.title}</b>
            {tip.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
