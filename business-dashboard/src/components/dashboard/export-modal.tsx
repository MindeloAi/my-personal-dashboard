"use client";

import { useState } from "react";
import { endOfMonth, endOfQuarter, format, parseISO, startOfQuarter, subMonths } from "date-fns";
import { ModalShell } from "@/components/ui/modal-shell";
import { today as tradingDay } from "@/lib/subscriptions";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors";
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Preset ranges, all from Trinidad's today. "All time" starts at the first dated record. */
function presets(today: string, firstDate: string) {
  const t = parseISO(today);
  const lastMonth = subMonths(t, 1);
  const y = t.getFullYear();
  return [
    { label: "This month", from: today.slice(0, 8) + "01", to: ymd(endOfMonth(t)) },
    { label: "Last month", from: ymd(lastMonth).slice(0, 8) + "01", to: ymd(endOfMonth(lastMonth)) },
    { label: "This quarter", from: ymd(startOfQuarter(t)), to: ymd(endOfQuarter(t)) },
    { label: "This year", from: `${y}-01-01`, to: `${y}-12-31` },
    { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: "All time", from: firstDate, to: today },
  ];
}

export function ExportButton({ firstDate }: { firstDate: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
      >
        Export
      </button>
      {open && <ExportModal firstDate={firstDate} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportModal({ firstDate, onClose }: { firstDate: string; onClose: () => void }) {
  const today = tradingDay();
  const options = presets(today, firstDate < today ? firstDate : today);
  const [range, setRange] = useState({ from: options[3].from, to: options[3].to });
  const valid = !!range.from && !!range.to && range.from <= range.to;
  const href = (fmt: "xlsx" | "csv") => `/admin/export?from=${range.from}&to=${range.to}&format=${fmt}`;

  return (
    <ModalShell title="Export accounts" onClose={onClose}>
      <p className="text-xs text-zinc-500 mb-4">
        Income, expenses, founder pay, cash movements and invoices for the dates you pick, with a summary. Read-only.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {options.map((p) => {
          const active = p.from === range.from && p.to === range.to;
          return (
            <button
              key={p.label}
              onClick={() => setRange({ from: p.from, to: p.to })}
              className={`min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                active ? "bg-[#bfff3a] text-black border-[#bfff3a]" : "border-[#2a2e34] text-zinc-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-400">From</span>
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-400">To</span>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={inputCls} />
        </label>
      </div>
      {!valid && <p className="text-xs text-[#ff4d8b] mb-2">Pick a From date on or before the To date.</p>}
      <div className="flex flex-col sm:flex-row gap-2 justify-end mt-5">
        {/* Plain links: the route streams the file with Content-Disposition: attachment. */}
        {(["xlsx", "csv"] as const).map((fmt) => (
          <a
            key={fmt}
            href={valid ? href(fmt) : undefined}
            aria-disabled={!valid}
            className={`min-h-11 sm:min-h-0 flex items-center justify-center text-xs px-4 py-2 rounded-xl font-semibold transition-colors ${
              fmt === "xlsx" ? "bg-[#bfff3a] text-black hover:bg-[#d4ff70]" : "border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500"
            } ${valid ? "" : "opacity-40 pointer-events-none"}`}
          >
            {fmt === "xlsx" ? "Download Excel" : "Download CSVs (.zip)"}
          </a>
        ))}
      </div>
    </ModalShell>
  );
}
