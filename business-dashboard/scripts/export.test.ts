// export.test.ts: acceptance checks for the accounts export
// (docs/superpowers/specs/2026-10-23-accounts-export-design.md).
//
// Runs getAccountsExport + the file builders against a THROWAWAY database. It
// deletes invoices, payments, expenses and transfers, so it refuses anything
// that is not localhost. Same setup as ledger.test.ts (see its header), then:
//
//   DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres bun scripts/export.test.ts

import postgres from "postgres";
import ExcelJS from "exceljs";
import { unzipSync, strFromU8 } from "fflate";
import { getAccountsExport, recordPayment, createTransfer, closeDb } from "../src/lib/db";
import { summarize, toXlsx, toCsvZip, csvField } from "../src/lib/accounts-export";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

const FROM = "2026-01-01";
const TO = "2026-10-23";
const ME = "michaeltaylorwalker@mindelo.site";
const TRICKY_NAME = '=HYPERLINK("x")';
const TRICKY_NOTE = 'a, "b"\nc';

try {
  // One transaction: deleting payments before transfers dips a pot below zero
  // midway, and the cash_never_negative guard (013) judges the end state.
  await sql.begin(async (tx) => {
    await tx`delete from payments`;
    await tx`delete from cash_movements where kind <> 'opening'`;
    await tx`delete from invoices`;
    await tx`delete from expenses`;
  });

  const [client] = await sql`insert into clients (name, company) values ('Tricky', ${TRICKY_NAME}) returning id`;
  const inv = async (number: string, amount: number, status: string, issue: string, paid: string | null, share: number | null) =>
    String((await sql`
      insert into invoices (invoice_number, client_id, amount, status, issue_date, due_date, paid_date,
                            michael_bonus_share, zane_bonus_share)
      values (${number}, ${client.id}, ${amount}, ${status}, ${issue}, ${issue}, ${paid},
              ${share}, ${share == null ? null : 1 - share})
      returning id`)[0].id);

  // Pre-ledger: one in range, one the day before FROM.
  await inv("PRE-IN", 1000, "Paid", "2026-03-01", "2026-03-05", null);
  await inv("PRE-OUT", 500, "Paid", "2025-12-30", "2025-12-31", null);
  // Ledger era: one paid in full and paid out, one part-paid with payouts still due.
  const l1 = await inv("LED-1", 2700, "Sent", "2026-10-22", null, 1);
  const l2 = await inv("LED-2", 1000, "Sent", TO, null, 0.5);
  await recordPayment({ invoiceId: l1, amount: 2700, paidAt: TO, receivedBy: "mikey", method: "Bank", note: TRICKY_NOTE, payOutFrom: "mikey", createdBy: ME });
  await recordPayment({ invoiceId: l2, amount: 400, paidAt: TO, receivedBy: "zane", method: "Cash", note: null, payOutFrom: null, createdBy: ME });
  await createTransfer({ movedAt: TO, fromLoc: "mikey", toLoc: "vantage", amount: 100, note: null, createdBy: ME });
  // Expenses on both edges and a day outside each.
  await sql`insert into expenses (name, amount, date, notes) values
    ('edge-from', 100, ${FROM}, ${TRICKY_NOTE}), ('edge-to', 50, ${TO}, null),
    ('before', 999, '2025-12-31', null), ('after', 999, '2026-10-24', null)`;

  const d = await getAccountsExport(FROM, TO, TO);
  const s = summarize(d);

  // 1 Summary equals its tabs, and the cash equals cash_by_location.
  check("1 income = sum of Income rows (1000 pre-ledger + 2700 + 400)", s.income === 4100, String(s.income));
  check("  expenses = sum of Expenses rows (edges only)", s.expenses === 150, String(s.expenses));
  check("  net profit = income minus expenses", s.netProfit === 3950, String(s.netProfit));
  const due = d.founderPay.filter((r) => r.status === "due").reduce((a, r) => a + r.total, 0);
  check("  founder pay split into paid out (2700's) and due (400's)", s.payoutsPaidOut > 0 && Math.abs(s.payoutsDue - due) < 0.001 && due > 0);
  const live = Object.fromEntries((await sql`select location, balance from cash_by_location`).map((r) => [r.location, Number(r.balance)]));
  check("  cash at end matches cash_by_location", ["mikey", "zane", "vantage"].every((h) => d.cashAtEnd[h as "mikey"] === live[h]), JSON.stringify(d.cashAtEnd));
  check("  owed to us now = 1000 - 400 still owed on LED-2", d.owedToUsNow === 600, String(d.owedToUsNow));

  // 2 Inclusive edges.
  const names = d.expenses.map((r) => r.name);
  check("2 expenses dated exactly FROM and TO are in", names.includes("edge-from") && names.includes("edge-to"));
  check("  expenses a day outside are out", !names.includes("before") && !names.includes("after"));
  check("  pre-ledger income the day before FROM is out", !d.income.some((r) => r.invoiceNumber === "PRE-OUT"));

  // 3 Pre-ledger flagged, nothing double-counted.
  const pre = d.income.find((r) => r.invoiceNumber === "PRE-IN");
  check("3 pre-ledger income is flagged 'Before ledger'", pre?.source === "Before ledger");
  const ledgerNumbers = d.income.filter((r) => r.source === "Ledger").map((r) => r.invoiceNumber);
  check("  ledger invoices only come from payments", !d.income.some((r) => r.source === "Before ledger" && ledgerNumbers.includes(r.invoiceNumber)));
  check("  invoices tab: LED-2 paid so far 400, PRE-IN 1000", d.invoices.find((r) => r.invoiceNumber === "LED-2")?.paidSoFar === 400 && d.invoices.find((r) => r.invoiceNumber === "PRE-IN")?.paidSoFar === 1000);

  // 4 CSV escaping and formula safety.
  const csv = unzipSync(toCsvZip(d));
  check("4 zip holds the six CSVs", ["summary.csv", "income.csv", "expenses.csv", "founder-pay.csv", "cash-movements.csv", "invoices.csv"].every((f) => f in csv), Object.keys(csv).join(","));
  const incomeCsv = strFromU8(csv["income.csv"]);
  check("  formula-looking client name is prefixed with '", incomeCsv.includes(csvField(TRICKY_NAME)) && csvField(TRICKY_NAME).startsWith(`"'=`), csvField(TRICKY_NAME));
  check("  comma/quote/newline note is quoted and doubled", incomeCsv.includes('"a, ""b""\nc"'));
  // Raw bytes: TextDecoder drops a BOM when decoding, so check before decoding.
  check("  CSV starts with a UTF-8 BOM", csv["income.csv"].slice(0, 3).join() === "239,187,191");
  check("  numbers are not prefixed", csvField(-5) === "-5");

  // 5 The workbook reopens with the six tabs in order.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await toXlsx(d)));
  const tabs = wb.worksheets.map((w) => w.name);
  check("5 xlsx has Summary, Income, Expenses, Founder pay, Cash movements, Invoices", tabs.join("|") === "Summary|Income|Expenses|Founder pay|Cash movements|Invoices", tabs.join("|"));
  const amountCell = wb.getWorksheet("Income")!.getRow(2).getCell(5);
  check("  amounts are real numbers in TT$ format", typeof amountCell.value === "number" && String(amountCell.numFmt).includes("TT$"));
  check("  the formula-looking name is stored as text, not a formula", wb.getWorksheet("Income")!.getRow(2).getCell(3).value === TRICKY_NAME);
} finally {
  await sql.end();
  await closeDb();
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
