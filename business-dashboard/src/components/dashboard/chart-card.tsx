"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { DownloadButtons, useRegisterChart } from "./chart-export";

export type ChartTable = { columns: string[]; rows: (string | number)[][] };

type Props = {
  /** Plain-language name of what is plotted, e.g. "Owed to us, by client". */
  title: string;
  /** What the chart shows and how to read it. Visible text, so people and AI read the same words. */
  description: string;
  /** The numbers behind the chart, shown under the enlarged view. */
  table: ChartTable;
  /** The records behind one mark (a month, a client, a stage), listed when it is clicked. */
  records?: (key: string) => ChartTable;
  /** Renders the chart. `large` is true inside the enlarged view; call `select(key)` when a mark is clicked. */
  chart: (large: boolean, select: (key: string) => void) => React.ReactNode;
  className?: string;
};

/**
 * One chart panel. Clicking the chart opens it full size with its data table;
 * clicking a point, bar or slice also lists the records behind that mark.
 */
export function ChartCard({ title, description, table, records, chart, className }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // A mark's click runs before the panel's own click bubbles up, so the
  // enlarged view opens on that mark's records.
  const select = (key: string) => {
    setSelected(key);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setSelected(null);
  };
  const detail = selected && records ? records(selected) : null;
  useRegisterChart(title, table);

  return (
    <section className={`flex flex-col border border-[#DCE1E8] bg-white p-4 sm:p-5 break-inside-avoid ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1B2533]">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#4A5568]">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 min-h-9 rounded-[4px] border border-[#DCE1E8] px-2.5 text-xs text-[#334155] hover:border-[#94A3B8] hover:text-[#0E1A2B] print:hidden"
        >
          Enlarge
        </button>
      </div>
      <div
        onClick={() => setOpen(true)}
        className="mt-4 block w-full cursor-zoom-in"
        title={records ? "Click a point, bar or slice to see its records" : "Click to enlarge"}
      >
        {chart(false, select)}
      </div>
      {open && (
        <ModalShell title={title} onClose={close} maxWidthClass="max-w-5xl">
          <div className="space-y-5">
            <p className="text-sm text-[#4A5568]">
              {description}
              {records && " Click a point, bar or slice to list the records behind it."}
            </p>
            {chart(true, setSelected)}
            {detail && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[#1B2533]">
                    {selected}: {detail.rows.length} {detail.rows.length === 1 ? "record" : "records"}
                  </h4>
                  <button type="button" onClick={() => setSelected(null)} className="min-h-9 text-xs text-[#1D4ED8] hover:underline">
                    Back to all numbers
                  </button>
                </div>
                {detail.rows.length ? <DataTable table={detail} /> : <p className="text-sm text-[#5A6678]">No records.</p>}
              </div>
            )}
            {!detail && <DataTable table={table} />}
            <DownloadButtons title={detail ? `${title} - ${selected}` : title} table={detail ?? table} />
          </div>
        </ModalShell>
      )}
    </section>
  );
}

const MONEY = /^-?TT\$/;

export function DataTable({ table }: { table: ChartTable }) {
  const moneyCol = table.columns.map((_, i) => table.rows.some((r) => MONEY.test(String(r[i]))));
  return (
    <div className="overflow-x-auto border border-[#DCE1E8]">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#F7F8FA] text-left text-xs text-[#4A5568]">
            {table.columns.map((c, i) => (
              <th key={c} className={`border-b border-[#DCE1E8] px-3 py-2 font-semibold ${moneyCol[i] ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="align-top">
              {row.map((cell, i) => (
                <td key={i} className={`border-b border-[#EEF1F5] px-3 py-2 ${i === 0 ? "text-[#1B2533]" : "text-[#334155]"} ${moneyCol[i] ? "whitespace-nowrap text-right" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
