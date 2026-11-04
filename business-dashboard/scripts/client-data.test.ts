// Checks one client's money summary. No database.
//   bun scripts/client-data.test.ts
import assert from "node:assert/strict";
import { clientMoney } from "../src/lib/client-data";
import type { Invoice, Project } from "../src/lib/db";

const projects = [{ id: "p1", Name: "Site" }, { id: "p2", Name: "App" }] as Project[];
const invoices = [
  { id: "i1", Status: "Paid", Amount: 1000, Project: ["p1"], "Issue Date": "2026-09-01", "Paid Date": "2026-09-11" },
  { id: "i2", Status: "Sent", Amount: 500, "Paid So Far": 200, Project: ["p2"], "Issue Date": "2026-10-01" },
  { id: "i3", Status: "Draft", Amount: 900, Project: ["p1"] },
] as Invoice[];
const payments = [
  { invoiceId: "i2", amount: 200, paidAt: "2026-10-05T12:00:00Z" },
];

const m = clientMoney({ projects, invoices, payments, cutover: "2026-10-22" });
assert.equal(m.billed, 1500, "drafts are not billed");
assert.equal(m.paid, 1200);
assert.equal(m.owed, 300);
assert.deepEqual(m.byMonth, [{ label: "2026-09", paid: 1000 }, { label: "2026-10", paid: 200 }], "pre-ledger paid invoices count on their paid date");
assert.deepEqual(m.byProject, [{ name: "Site", value: 1000 }, { name: "App", value: 200 }], "largest first");
assert.equal(m.avgDaysToPay, 10, "issue to paid, invoices paid in full");

const empty = clientMoney({ projects: [], invoices: [], payments: [], cutover: "2026-10-22" });
assert.deepEqual([empty.billed, empty.paid, empty.owed, empty.avgDaysToPay, empty.byMonth.length], [0, 0, 0, null, 0]);

console.log("client-data: all checks pass");
