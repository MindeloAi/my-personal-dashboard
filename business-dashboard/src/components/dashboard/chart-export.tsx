"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";
import { toCsv } from "@/lib/csv";
import type { ChartTable } from "./chart-card";

const fileName = (title: string) => `mindelo-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const asRows = (t: ChartTable) => t.rows.map((r) => r.map((c) => (typeof c === "number" ? c : String(c))));

export function downloadCsv(title: string, table: ChartTable) {
  save(new Blob([toCsv(table.columns, asRows(table))], { type: "text/csv;charset=utf-8" }), `${fileName(title)}.csv`);
}

/** Excel is built on the server (exceljs stays out of the browser bundle). */
export async function downloadXlsx(file: string, sheets: { name: string; table: ChartTable }[]) {
  const res = await fetch("/admin/finance/analytics/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: fileName(file), sheets: sheets.map((s) => ({ name: s.name, columns: s.table.columns, rows: asRows(s.table) })) }),
  });
  if (!res.ok) {
    toast.error("The Excel download failed. Try again, or use CSV.");
    return;
  }
  save(await res.blob(), `${fileName(file)}.xlsx`);
}

/** Download buttons for one table. */
export function DownloadButtons({ title, table }: { title: string; table: ChartTable }) {
  const cls = "min-h-9 rounded-[4px] border border-[#DCE1E8] px-2.5 text-xs text-[#334155] hover:border-[#94A3B8] hover:text-[#0E1A2B]";
  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" className={cls} onClick={() => downloadCsv(title, table)}>Download CSV</button>
      <button type="button" className={cls} onClick={() => downloadXlsx(title, [{ name: title, table }])}>Download Excel</button>
    </div>
  );
}

// Every ChartCard inside a ChartRegistry adds its title and numbers here, so
// "Export all" can put each chart on its own sheet. A ref, not state: charts
// registering must not re-render the page.
type Registry = Map<string, ChartTable>;
const RegistryContext = createContext<React.RefObject<Registry> | null>(null);

export function ChartRegistry({ children }: { children: React.ReactNode }) {
  const ref = useRef<Registry>(new Map());
  return <RegistryContext.Provider value={ref}>{children}</RegistryContext.Provider>;
}

export function useRegisterChart(title: string, table: ChartTable) {
  const reg = useContext(RegistryContext);
  useEffect(() => {
    if (!reg) return;
    const map = reg.current;
    map.set(title, table);
    return () => void map.delete(title);
  }, [reg, title, table]);
}

export function ExportAllButton({ file }: { file: string }) {
  const reg = useContext(RegistryContext);
  return (
    <button
      type="button"
      onClick={() => reg && downloadXlsx(file, [...reg.current].map(([name, table]) => ({ name, table })))}
      className="min-h-10 rounded-[4px] bg-[#1D4ED8] px-4 text-sm font-medium text-white hover:bg-[#1E40AF]"
    >
      Export all analytics (Excel)
    </button>
  );
}
