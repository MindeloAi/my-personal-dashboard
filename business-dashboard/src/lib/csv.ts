// CSV cells, shared by the accounts export (server) and chart downloads (browser).

export type Cell = string | number | null;

/** RFC 4180 field, with a leading ' on text Excel would run as a formula. */
export function csvField(v: Cell): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One table as CSV text, with a BOM so Excel opens accented names as UTF-8. */
export function toCsv(columns: string[], rows: Cell[][]): string {
  return "﻿" + [columns, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** "TT$1,234.50" / "-TT$20.00" back to a number; anything else unchanged. */
export function moneyToNumber(v: Cell): Cell {
  if (typeof v !== "string") return v;
  const m = /^(-?)TT\$([\d,]+(?:\.\d+)?)$/.exec(v.trim());
  return m ? Number(`${m[1]}${m[2].replace(/,/g, "")}`) : v;
}
