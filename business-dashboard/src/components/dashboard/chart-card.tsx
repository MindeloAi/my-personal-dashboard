"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";

export type ChartTable = { columns: string[]; rows: (string | number)[][] };

type Props = {
  /** Plain-language name of what is plotted, e.g. "Owed to us, by client". */
  title: string;
  /** What the chart shows and how to read it. Visible text, so people and AI read the same words. */
  description: string;
  /** The numbers behind the chart, shown under the enlarged view. */
  table: ChartTable;
  /** Renders the chart; `large` is true inside the enlarged view. */
  chart: (large: boolean) => React.ReactNode;
  className?: string;
};

/** One chart panel. Clicking the chart opens it full size with its data table. */
export function ChartCard({ title, description, table, chart, className }: Props) {
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge chart: ${title}`}
        className="mt-4 block w-full cursor-zoom-in text-left"
      >
        {chart(false)}
      </button>
      {open && (
        <ModalShell title={title} onClose={() => setOpen(false)} maxWidthClass="max-w-5xl">
          <div className="space-y-5">
            <p className="text-sm text-[#4A5568]">{description}</p>
            {chart(true)}
            <DataTable table={table} />
          </div>
        </ModalShell>
      )}
    </section>
  );
}

function DataTable({ table }: { table: ChartTable }) {
  return (
    <div className="overflow-x-auto border border-[#DCE1E8]">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#F7F8FA] text-left text-xs text-[#4A5568]">
            {table.columns.map((c, i) => (
              <th key={c} className={`border-b border-[#DCE1E8] px-3 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`border-b border-[#EEF1F5] px-3 py-2 ${i > 0 ? "text-right" : "text-[#1B2533]"}`}>
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
