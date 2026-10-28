// Checks the Finance Summary and subpage chart calculations. No database.
//   bun scripts/finance-data.test.ts
import assert from "node:assert/strict";
import { buildFinance, lastMonths } from "../src/lib/finance-data";
import type { Client, Project, Invoice, Expense, Subscription, FinanceHistory, Ledger } from "../src/lib/db";

const today = "2026-10-28";
const clients = [{ id: "c1", Company: "Acme" }, { id: "c2", Name: "Bea" }] as Client[];
const projects = [
  { id: "p1", Client: ["c1"], "Service Type": "Website" },
  { id: "p2", Client: ["c2"], "Service Type": "Automation" },
] as Project[];
const invoices = [
  // Paid before the ledger: counts as collected in its paid month.
  { id: "i1", "Invoice Number": "INV-0001", Status: "Paid", Amount: 1000, "Issue Date": "2026-09-01", "Paid Date": "2026-09-11", Project: ["p1"] },
  // Paid through the ledger: its payment is the collected figure.
  { id: "i2", "Invoice Number": "INV-0002", Status: "Paid", Amount: 600, "Issue Date": "2026-10-01", "Paid Date": "2026-10-24", Project: ["p2"] },
  { id: "i3", "Invoice Number": "INV-0003", Status: "Sent", Amount: 800, "Paid So Far": 300, "Issue Date": "2026-08-01", "Due Date": "2026-08-15", Project: ["p2"] }, // 74 days late
  { id: "i4", "Invoice Number": "INV-0004", Status: "Sent", Amount: 400, "Issue Date": "2026-10-20", "Due Date": "2026-11-20", Project: ["p1"] }, // not yet due
  { id: "i5", Status: "Draft", Amount: 999, Project: ["p1"] },
] as Invoice[];
const expenses = [
  { id: "e1", Name: "Hosting", Category: "Hosting", Amount: 100, Date: "2026-10-05", "Paid From": "business" },
  { id: "e2", Name: "Laptop", Category: "Hardware", Amount: 50, Date: "2026-10-06", "Paid Personally By": "zane" },
] as Expense[];
const subscriptions = [
  { id: "s1", Name: "Acme retainer", Client: ["c1"], Amount: 300, Frequency: "monthly", Status: "Active", "Start Date": "2026-09-01" },
  { id: "s2", Name: "Bea yearly", Client: ["c2"], Amount: 1200, Frequency: "yearly", Status: "Active", "Start Date": "2026-12-15" },
] as Subscription[];
const history = {
  collected: [
    { month: "2026-09", source: "before", amount: 1000 },
    { month: "2026-10", source: "zane", amount: 600 },
  ],
  split: [{ month: "2026-10", business: 378, michael: 111, zane: 111 }],
  cash: [{ day: "2026-10-28", location: "zane", balance: 600 }],
  toSort: [],
  intoSafe: [],
  daysToSafe: [],
  counts: [],
  payouts: [{ month: "2026-10", founder: "zane", base: 100, bonus: 11, paidOut: 0, due: 111 }],
} as unknown as FinanceHistory;
const ledger = {
  cutover: "2026-10-22",
  payments: [{ id: "pay1", invoiceId: "i2", amount: 600, paidAt: "2026-10-24", receivedBy: "zane" }],
  payouts: [],
  movements: [],
  collections: [],
} as unknown as Ledger;

const f = buildFinance({ invoices, expenses, projects, clients, subscriptions, history, ledger }, today);
const money = (n: number) => n.toFixed(2);
const r = f.records(money);
const sumCol = (rows: string[][], col: number) => rows.reduce((t, x) => t + Number(x[col]), 0);
const row = (rows: { label: string }[], label: string) => rows.find((x) => x.label === label) as Record<string, number> & { label: string };

assert.deepEqual(lastMonths(today, 3), ["2026-08", "2026-09", "2026-10"]);
assert.equal(f.collected.length, 12);
assert.equal(row(f.collected, "Sep 26").collected, 1000);
assert.equal(row(f.collected, "Oct 26").collected, 600);
assert.equal(sumCol(r.collected("Oct 26").rows, 3), 600, "Oct collected records = the ledger payment");
assert.equal(sumCol(r.collected("Sep 26").rows, 3), 1000, "Sep collected records = the pre-ledger paid invoice");

assert.equal(row(f.invoicedVsCollected, "Oct 26").invoiced, 1000, "drafts are not invoiced");
assert.equal(row(f.profit, "Oct 26").profit, 600 - 150);
assert.equal(sumCol(r.profit("Oct 26").rows, 4), 600 - 150, "profit records: collected minus expenses");
assert.equal(sumCol(r.collector("Sep 26").rows, 3), 0, "collector bars are ledger-only, so are their records");

const ages = Object.fromEntries(f.ages.map((a) => [a.label, a.value]));
assert.equal(ages["Not yet due"], 400);
assert.equal(ages["60+ days late"], 500);
assert.equal(sumCol(r.age("60+ days late").rows, 3), 500);

assert.equal(row(f.expensesByMonth, "Oct 26").Hosting, 100);
assert.deepEqual(f.byPayer.map((p) => p.name), ["Paid from business cash", "Paid personally, still owed back"]);

assert.equal(row(f.mrr, "Oct 26").mrr, 300, "the yearly subscription has not started yet");
assert.equal(row(f.daysToPaid, "Sep 26").days, 10);
assert.deepEqual(f.expected.map((e) => e.amount), [600, 300, 1500], "Oct: missed Sep + Oct retainer; Nov: retainer; Dec: retainer + yearly start");
assert.equal(sumCol(r.expected("Dec 26").rows, 2), 1500);

assert.equal(f.founders.find((x) => x.key === "zane")!.due, 111);
assert.equal(row(f.split, "Oct 26").business, 378);
assert.equal(f.split.length, 1, "ledger charts start at the cutover month");
assert.deepEqual(f.splitTotals.map((x) => x.value), [378, 111, 111]);
assert.deepEqual(f.serviceTotals, [{ name: "Website", value: 1000 }, { name: "Automation", value: 600 }]);
assert.equal(sumCol(r.serviceType("Automation").rows, 3), 600, "pie slice records sum to the slice");
assert.equal(sumCol(r.categoryInYear("Hosting").rows, 3), 100);

console.log("finance-data: all checks pass");
