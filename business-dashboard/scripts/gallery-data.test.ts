// Checks the Analytics gallery calculations. No database.
//   bun scripts/gallery-data.test.ts
import assert from "node:assert/strict";
import { waterfall, leadFunnel, revenueTree, paymentCalendar, sizeVsDays, yearOnYear } from "../src/lib/gallery-data";
import type { Client, Project, Invoice, Expense, Lead, FinanceHistory } from "../src/lib/db";

const clients = [{ id: "c1", Company: "Acme" }, { id: "c2", Name: "Bea" }] as Client[];
const projects = [{ id: "p1", Name: "Site", Client: ["c1"] }, { id: "p2", Name: "App", Client: ["c2"] }] as Project[];
const invoices = [
  { id: "i1", "Invoice Number": "INV-0001", Status: "Paid", Amount: 1000, "Issue Date": "2026-10-01", "Paid Date": "2026-10-05", Project: ["p1"] }, // Monday
  { id: "i2", "Invoice Number": "INV-0002", Status: "Paid", Amount: 400, "Issue Date": "2025-03-01", "Paid Date": "2025-03-11", Project: ["p2"] },
  { id: "i3", Status: "Sent", Amount: 700, "Issue Date": "2026-10-10", Project: ["p2"] },
  { id: "i4", Status: "Draft", Amount: 999, "Issue Date": "2026-10-10", Project: ["p2"] },
] as Invoice[];
const expenses = [{ id: "e1", Name: "Host", Amount: 100, Date: "2026-10-02" }] as Expense[];
const history = {
  collected: [{ month: "2026-10", source: "zane", amount: 1000 }],
  payouts: [{ month: "2026-10", founder: "zane", base: 200, bonus: 50, paidOut: 0, due: 250 }],
} as unknown as FinanceHistory;

const w = waterfall("2026-10", invoices, expenses, history);
assert.deepEqual(w.map((s) => s.value), [1700, 1000, 100, 250, 650], "invoiced (no drafts), collected, expenses, founder pay, kept");
assert.deepEqual(w.map((s) => s.base), [0, 0, 900, 650, 0], "falling steps float from what is left");

const leads = [
  { id: "l1", Name: "A", Status: "Won", Client: ["c1"] },
  { id: "l2", Name: "B", Status: "Won", Client: ["c2"] },
  { id: "l3", Name: "C", Status: "New" },
] as Lead[];
assert.deepEqual(leadFunnel(leads, invoices, projects).map((s) => s.value), [3, 2, 2, 2]);
assert.deepEqual(leadFunnel(leads, invoices.filter((i) => i.id !== "i2"), projects).map((s) => s.value), [3, 2, 2, 1], "Bea invoiced but not paid");

const tree = revenueTree(invoices, projects, clients);
assert.deepEqual(tree.map((t) => [t.name, t.value]), [["Acme", 1000], ["Bea", 400]]);
assert.equal(tree[0].children![0].name, "Site");

const cal = paymentCalendar(invoices, ["2026-09", "2026-10"]);
assert.equal(cal[0][1].amount, 1000, "5 Oct 2026 is a Monday");
assert.equal(cal.flat().reduce((s, c) => s + c.count, 0), 1, "the 2025 payment is outside the months shown");

assert.deepEqual(sizeVsDays(invoices, clients, projects).map((p) => [p.amount, p.days]), [[1000, 4], [400, 10]]);

const yoy = yearOnYear(invoices, "2026-10-28");
assert.equal(yoy[2].lastYear, 400);
assert.equal(yoy[9].thisYear, 1000);
assert.equal(yoy[10].thisYear, null, "months still to come are left empty");

console.log("gallery-data: all checks pass");
