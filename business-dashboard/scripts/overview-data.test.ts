// Checks the Overview chart calculations. No database.
//   bun scripts/overview-data.test.ts
import assert from "node:assert/strict";
import { monthlyMoney, owedByClient, revenueByClient, revenueByService, leadsByStage, topWithOther, owedSplit } from "../src/lib/overview-data";
import type { Client, Project, Invoice, Expense, Lead } from "../src/lib/db";

const clients = [{ id: "c1", Company: "Acme" }, { id: "c2", Name: "Bea" }] as Client[];
const projects = [
  { id: "p1", Client: ["c1"], "Service Type": "Web Dev" },
  { id: "p2", Client: ["c2"], "Service Type": "Automation" },
] as Project[];
const invoices = [
  { id: "i1", Status: "Paid", Amount: 1000, "Paid Date": "2026-10-03", Project: ["p1"] },
  { id: "i2", Status: "Paid", Amount: 500, "Paid Date": "2026-09-15", Client: ["c2"] },
  { id: "i3", Status: "Paid", Amount: 200, "Paid Date": "2025-01-10", Project: ["p1"] }, // before the 12-month window
  { id: "i4", Status: "Sent", Amount: 800, "Paid So Far": 300, "Due Date": "2026-10-01", Project: ["p2"] },
  { id: "i5", Status: "Sent", Amount: 400, "Due Date": "2026-12-01", Project: ["p1"] },
  { id: "i6", Status: "Draft", Amount: 999, Project: ["p1"] },
  { id: "i7", Status: "Void", Amount: 999, Project: ["p1"] },
] as Invoice[];
const expenses = [{ id: "e1", Amount: 150, Date: "2026-10-20" }] as Expense[];

const months = monthlyMoney(invoices, expenses, "2026-10-28");
assert.equal(months.length, 12);
assert.equal(months[11].month, "Oct 26");
assert.deepEqual([months[11].revenue, months[11].expenses, months[11].profit], [1000, 150, 850]);
assert.equal(months[10].revenue, 500);
assert.equal(months[0].revenueToDate, 200, "revenue to date starts from money before the window");
assert.equal(months[11].revenueToDate, 1700);

const owed = owedByClient(invoices, projects, clients);
assert.deepEqual(owed, [{ name: "Bea", value: 500 }, { name: "Acme", value: 400 }]);

assert.deepEqual(revenueByClient(invoices, projects, clients), [{ name: "Acme", value: 1200 }, { name: "Bea", value: 500 }]);
assert.deepEqual(revenueByService(invoices, projects), [{ name: "Web Dev", value: 1200 }, { name: "Unspecified", value: 500 }]);

const split = owedSplit(invoices, new Date("2026-10-28T12:00:00Z"));
assert.deepEqual(split, { overdue: 500, overdueCount: 1, notDue: 400, notDueCount: 1 });

const leads = [{ Status: "New" }, { Status: "New" }, { Status: "Won" }] as Lead[];
assert.deepEqual(leadsByStage(leads).map((s) => s.value), [2, 0, 0, 1, 0]);

const many = [5, 4, 3, 2, 1].map((v, i) => ({ name: "s" + i, value: v }));
assert.deepEqual(topWithOther(many, 3).at(-1), { name: "Other", value: 3 });
assert.equal(topWithOther(many.slice(0, 4), 3).length, 4, "folding one item into Other is pointless");

console.log("overview-data: all checks pass");
