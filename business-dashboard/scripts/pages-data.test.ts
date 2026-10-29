// Checks the Leads / Clients / Projects summaries and the Needs action list. No database.
//   bun scripts/pages-data.test.ts
import assert from "node:assert/strict";
import { leadsSummary, clientsSummary, projectsSummary, needsAction } from "../src/lib/pages-data";
import type { Client, Project, Invoice, Lead, Subscription, Ledger } from "../src/lib/db";

const today = "2026-10-28";
const leads = [
  { id: "l1", Name: "Ann", Status: "New", Source: "Website", Created: "2026-10-02", "Follow-up Date": "2026-10-27" },
  { id: "l2", Name: "Bo", Status: "Contacted", Source: "Website", Created: "2026-10-05", "Follow-up Date": "2026-11-05" },
  { id: "l3", Name: "Cy", Status: "Won", Source: "Referral", Created: "2026-09-10" },
  { id: "l4", Name: "Di", Status: "Lost", Source: " referral", Created: "2026-09-12", "Follow-up Date": "2026-10-01" },
] as Lead[];
const L = leadsSummary(leads, today);
assert.deepEqual([L.open, L.won, L.winRate, L.followUps], [2, 1, 50, 1], "lost leads are never follow-ups");
assert.deepEqual(L.bySource, [{ name: "Website", value: 2 }, { name: "Referral", value: 2 }], "referral and Referral are one source");
assert.equal(L.winRateByMonth.find((m) => m.key === "2026-09")!.rate, 50);
assert.equal(L.arrivedByMonth.find((m) => m.key === "2026-10")!.leads, 2);

const clients = [
  { id: "c1", Name: "Acme", Status: "Active", Created: "2026-10-01" },
  { id: "c2", Name: "Bea", Status: "Inactive", Created: "2026-08-01" },
] as Client[];
const projects = [
  { id: "p1", Name: "Site", Client: ["c1"], Status: "In Progress", "Total Value": 3000, "Service Type": "Website" },
  { id: "p2", Name: "App", Client: ["c2"], Status: "Review", "Total Value": 2000 },
  { id: "p3", Name: "Old", Client: ["c2"], Status: "Done", "Total Value": 500 },
] as Project[];
const invoices = [
  { id: "i1", "Invoice Number": "INV-0001", Status: "Paid", Amount: 1000, "Paid Date": "2026-10-03", Project: ["p1"] },
  { id: "i2", "Invoice Number": "INV-0002", Status: "Paid", Amount: 500, "Paid Date": "2026-09-03", Project: ["p2"] },
  { id: "i3", "Invoice Number": "INV-0003", Status: "Sent", Amount: 800, "Due Date": "2026-10-20", Project: ["p2"] },
  { id: "i4", "Invoice Number": "INV-0004", Status: "Sent", Amount: 300, "Due Date": "2026-10-30", Project: ["p1"] },
  { id: "i5", "Invoice Number": "INV-0005", Status: "Sent", Amount: 300, "Due Date": "2026-12-30", Project: ["p1"] },
] as Invoice[];
const C = clientsSummary(clients, invoices, projects, today);
assert.deepEqual([C.active, C.earned, C.average, C.paying], [1, 1500, 750, 2]);
assert.equal(C.newByMonth.find((m) => m.key === "2026-10")!.clients, 1);

const P = projectsSummary(projects);
assert.deepEqual([P.inProgress, P.inReview, P.activeValue], [1, 1, 5000], "Done work is not active value");
assert.deepEqual(P.byService, [{ name: "Unspecified", value: 2 }, { name: "Website", value: 1 }]);

const subs = [{ id: "s1", Name: "Acme retainer", Amount: 500, Status: "Active", "Start Date": "2026-10-01", Frequency: "monthly" }] as Subscription[];
const items = needsAction({ invoices, leads, subscriptions: subs, clients, projects, ledger: { toSort: { received: 0, handover: 100, business: 0, giveZane: 0, mikeyKeeps: 0 } } as Pick<Ledger, "toSort"> }, today, (n) => n.toFixed(2));
assert.deepEqual(items.map((i) => i.kind), ["overdue", "due-soon", "follow-up", "retainer", "to-sort"], "most urgent first; due in 2 months is not listed");
assert.match(items[0].title, /INV-0003 overdue: Bea/);

console.log("pages-data: all checks pass");
