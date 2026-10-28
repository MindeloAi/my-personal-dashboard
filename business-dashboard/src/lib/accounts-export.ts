// Accounts export files: one .xlsx workbook, or the same tables as a zip of CSVs.
// Pure: takes getAccountsExport()'s data, never touches the database.
// Spec: docs/superpowers/specs/2026-10-23-accounts-export-design.md

import ExcelJS from "exceljs";
import { zipSync, strToU8 } from "fflate";
import type { AccountsExport } from "@/lib/db";
import { csvField, type Cell } from "@/lib/csv";
import { HOLDERS, HOLDER_LABEL, FOUNDER_LABEL, type Holder, type Founder } from "@/lib/ledger";


const holder = (v: string | null) => (v ? (HOLDER_LABEL[v as Holder] ?? v) : null);
const founder = (v: string | null) => (v ? (FOUNDER_LABEL[v as Founder] ?? v) : null);
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

export type AccountsSummary = {
  income: number;
  expenses: number;
  netProfit: number;
  payoutsPaidOut: number;
  payoutsDue: number;
};

/** Derived from the rows themselves, so the Summary always equals its tabs. */
export function summarize(d: AccountsExport): AccountsSummary {
  const income = sum(d.income.map((r) => r.amount));
  const expenses = sum(d.expenses.map((r) => r.amount));
  return {
    income,
    expenses,
    netProfit: sum([income, -expenses]),
    payoutsPaidOut: sum(d.founderPay.filter((r) => r.status === "paid_out").map((r) => r.total)),
    payoutsDue: sum(d.founderPay.filter((r) => r.status === "due").map((r) => r.total)),
  };
}

export function exportFileName(d: Pick<AccountsExport, "from" | "to">, ext: "xlsx" | "zip") {
  return `mindelo-accounts-${d.from}-to-${d.to}.${ext}`;
}

function tables(d: AccountsExport): Table[] {
  const s = summarize(d);
  const summaryRows: Cell[][] = [
    ["Period", `${d.from} to ${d.to}`],
    ["Exported", d.today],
    ["Income", s.income],
    ["Expenses", s.expenses],
    ["Net profit (income minus expenses; founder pay not deducted)", s.netProfit],
    ["Founder pay paid out", s.payoutsPaidOut],
    ["Founder pay still due", s.payoutsDue],
    ...HOLDERS.map((h): Cell[] => [`${h === "business" ? "Business cash (safe)" : `Held by ${HOLDER_LABEL[h]}`}, as at ${d.to}`, d.cashAtEnd[h] ?? 0]),
    [`Owed to us, as of ${d.today}`, d.owedToUsNow],
  ];
  if (d.from < d.cutover) {
    summaryRows.push([
      "Note",
      `Founder pay, cash and transfers start on ${d.cutover}. Earlier income comes from invoice paid dates.`,
    ]);
  }

  return [
    {
      name: "Summary",
      columns: [{ header: "Item", kind: "text", width: 58 }, { header: "Value", kind: "money", width: 22 }],
      rows: summaryRows,
    },
    {
      name: "Income",
      columns: [
        { header: "Date", kind: "date" }, { header: "Invoice", kind: "text" }, { header: "Client", kind: "text", width: 30 },
        { header: "Project", kind: "text", width: 30 }, { header: "Amount", kind: "money" }, { header: "Method", kind: "text" },
        { header: "Received by", kind: "text" }, { header: "Note", kind: "text", width: 30 }, { header: "Source", kind: "text" },
      ],
      rows: d.income.map((r) => [
        r.date, r.invoiceNumber, r.client, r.project, r.amount, r.method, holder(r.receivedBy), r.note, r.source,
      ]),
    },
    {
      name: "Expenses",
      columns: [
        { header: "Date", kind: "date" }, { header: "Name", kind: "text", width: 30 }, { header: "Category", kind: "text" },
        { header: "Amount", kind: "money" }, { header: "USD amount", kind: "money" }, { header: "Paid from", kind: "text" },
        { header: "Paid personally by", kind: "text" }, { header: "Reimbursed on", kind: "date" },
        { header: "Reimbursed from", kind: "text" }, { header: "Recurring", kind: "text" },
        { header: "Reference", kind: "text" }, { header: "Notes", kind: "text", width: 30 },
      ],
      rows: d.expenses.map((r) => [
        r.date, r.name, r.category, r.amount, r.usdAmount, holder(r.paidFrom), founder(r.paidPersonallyBy),
        r.reimbursedAt, holder(r.reimbursedFrom), r.recurring ? "Yes" : "No", r.reference, r.notes,
      ]),
    },
    {
      name: "Founder pay",
      columns: [
        { header: "Payout", kind: "text" }, { header: "Founder", kind: "text" }, { header: "Invoice", kind: "text" },
        { header: "Payment date", kind: "date" }, { header: "Base", kind: "money" }, { header: "Bonus", kind: "money" },
        { header: "Total", kind: "money" }, { header: "Status", kind: "text" }, { header: "Paid out on", kind: "date" },
        { header: "Paid from", kind: "text" },
      ],
      rows: d.founderPay.map((r) => [
        r.number, founder(r.founder), r.invoiceNumber, r.paymentDate, r.base, r.bonus, r.total,
        r.status === "paid_out" ? "Paid out" : "Due", r.paidOutAt, holder(r.paidFrom),
      ]),
    },
    {
      name: "Cash movements",
      columns: [
        { header: "Date", kind: "date" }, { header: "Type", kind: "text" }, { header: "From", kind: "text" },
        { header: "To", kind: "text" }, { header: "Amount", kind: "money" }, { header: "Note", kind: "text", width: 30 },
      ],
      rows: d.cashMovements.map((r) => [
        r.date, r.kind === "opening" ? "Opening" : "Transfer", holder(r.from), holder(r.to), r.amount, r.note,
      ]),
    },
    {
      name: "Invoices",
      columns: [
        { header: "Invoice", kind: "text" }, { header: "Client", kind: "text", width: 30 }, { header: "Project", kind: "text", width: 30 },
        { header: "Type", kind: "text" }, { header: "Issue date", kind: "date" }, { header: "Due date", kind: "date" },
        { header: "Amount", kind: "money" }, { header: "Paid so far", kind: "money" }, { header: "Status", kind: "text" },
        { header: "Paid date", kind: "date" },
      ],
      rows: d.invoices.map((r) => [
        r.invoiceNumber, r.client, r.project, r.type, r.issueDate, r.dueDate, r.amount, r.paidSoFar, r.status, r.paidDate,
      ]),
    },
  ];
}

// "YYYY-MM-DD" as a UTC midnight Date, so Excel shows the same calendar day everywhere.
const excelDate = (v: string) => new Date(`${v}T00:00:00Z`);

export async function toXlsx(d: AccountsExport): Promise<Uint8Array> {
  return writeWorkbook(tables(d));
}

export type Table = { name: string; columns: { header: string; kind: Kind; width?: number }[]; rows: Cell[][] };
export type Kind = "text" | "money" | "date";

/** Any set of tables as one workbook, a sheet each. Also used by the Analytics downloads. */
export async function writeWorkbook(sheets: Table[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mindelo Dashboard";
  for (const t of sheets) {
    const ws = wb.addWorksheet(t.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.columns.map((c) => ({
      header: c.header,
      width: c.width ?? (c.kind === "text" ? 18 : 14),
      style: c.kind === "money" ? { numFmt: '"TT$"#,##0.00' } : c.kind === "date" ? { numFmt: "dd mmm yyyy" } : {},
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of t.rows) {
      // Summary's value column holds money AND text (period, note): type each cell by its value.
      ws.addRow(row.map((v, i) => (v != null && t.columns[i]?.kind === "date" ? excelDate(String(v)) : v)));
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export { csvField };

export function toCsvZip(d: AccountsExport): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const t of tables(d)) {
    const lines = [t.columns.map((c) => csvField(c.header)), ...t.rows.map((r) => r.map(csvField))];
    // BOM so Excel opens accented names as UTF-8.
    files[`${t.name.toLowerCase().replace(/ /g, "-")}.csv`] = strToU8("﻿" + lines.map((l) => l.join(",")).join("\r\n") + "\r\n");
  }
  return zipSync(files);
}
