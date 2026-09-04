// subscriptions.test.mjs — the recurring-revenue maths, checked.
//
//   bun scripts/subscriptions.test.mjs
//
// Runs under bun for the same reason db:verify does: it imports the production
// TypeScript module directly, so there is no second copy of the logic to drift.
// No database and no env vars — lib/subscriptions.ts is pure by design.

import assert from "node:assert/strict";
import {
  isActive,
  mrr,
  nextInvoiceDate,
  dueSubscriptions,
} from "../src/lib/subscriptions.ts";

const TODAY = "2026-09-03";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

const sub = (over = {}) => ({
  id: "s1",
  Name: "Retainer",
  Amount: 1200,
  Frequency: "monthly",
  Status: "Active",
  "Start Date": "2026-01-15",
  ...over,
});

const inv = (over = {}) => ({
  id: "i1",
  Subscription: ["s1"],
  Status: "Sent",
  "Issue Date": "2026-08-15",
  ...over,
});

// ─── isActive ───────────────────────────────────────────────────────────────
test("paused and cancelled subscriptions are not active", () => {
  assert.equal(isActive(sub({ Status: "Paused" }), TODAY), false);
  assert.equal(isActive(sub({ Status: "Cancelled" }), TODAY), false);
  assert.equal(isActive(sub(), TODAY), true);
});

test("an end date in the past ends the subscription, today does not", () => {
  assert.equal(isActive(sub({ "End Date": "2026-09-02" }), TODAY), false);
  assert.equal(isActive(sub({ "End Date": TODAY }), TODAY), true);
  assert.equal(isActive(sub({ "End Date": "2026-09-04" }), TODAY), true);
});

// ─── mrr ────────────────────────────────────────────────────────────────────
test("frequency is divided down to a monthly figure", () => {
  assert.equal(mrr([sub({ Amount: 1200, Frequency: "monthly" })], TODAY), 1200);
  assert.equal(mrr([sub({ Amount: 1200, Frequency: "quarterly" })], TODAY), 400);
  assert.equal(mrr([sub({ Amount: 1200, Frequency: "yearly" })], TODAY), 100);
});

test("missing amount or frequency does not produce NaN", () => {
  assert.equal(mrr([sub({ Amount: undefined })], TODAY), 0);
  assert.equal(mrr([sub({ Amount: 900, Frequency: undefined })], TODAY), 900);
});

test("inactive subscriptions contribute nothing", () => {
  const subs = [sub(), sub({ id: "s2", Status: "Paused", Amount: 5000 })];
  assert.equal(mrr(subs, TODAY), 1200);
});

// ─── nextInvoiceDate ────────────────────────────────────────────────────────
test("never invoiced falls back to the start date", () => {
  assert.equal(nextInvoiceDate(sub(), []), "2026-01-15");
});

test("nothing to anchor to returns null", () => {
  assert.equal(nextInvoiceDate(sub({ "Start Date": undefined }), []), null);
});

test("one period after the LATEST invoice, not the first", () => {
  const invoices = [inv({ "Issue Date": "2026-07-15" }), inv({ id: "i2" })];
  assert.equal(nextInvoiceDate(sub(), invoices), "2026-09-15");
  assert.equal(nextInvoiceDate(sub({ Frequency: "quarterly" }), invoices), "2026-11-15");
  assert.equal(nextInvoiceDate(sub({ Frequency: "yearly" }), invoices), "2027-08-15");
});

test("a voided invoice does not push the schedule forward", () => {
  const invoices = [inv({ Status: "Void", "Issue Date": "2026-08-15" })];
  assert.equal(nextInvoiceDate(sub(), invoices), "2026-01-15");
});

test("another subscription's invoices are ignored", () => {
  assert.equal(nextInvoiceDate(sub(), [inv({ Subscription: ["other"] })]), "2026-01-15");
});

test("a month end clamps rather than overflowing", () => {
  const invoices = [inv({ "Issue Date": "2026-01-31" })];
  assert.equal(nextInvoiceDate(sub(), invoices), "2026-02-28");
});

// ─── dueSubscriptions ───────────────────────────────────────────────────────
test("due on the day, and not the day before", () => {
  const s = sub({ "Start Date": TODAY });
  assert.equal(dueSubscriptions([s], [], TODAY).length, 1);
  assert.equal(dueSubscriptions([s], [], TODAY)[0].daysOverdue, 0);
  assert.equal(dueSubscriptions([sub({ "Start Date": "2026-09-04" })], [], TODAY).length, 0);
});

test("days overdue counts calendar days since the due date", () => {
  const [due] = dueSubscriptions([sub()], [inv({ "Issue Date": "2026-07-15" })], TODAY);
  assert.equal(due.due, "2026-08-15");
  assert.equal(due.daysOverdue, 19);
});

test("a subscription invoiced this period is not due", () => {
  assert.equal(dueSubscriptions([sub()], [inv()], TODAY).length, 0);
});

test("paused and ended subscriptions are never due", () => {
  assert.equal(dueSubscriptions([sub({ Status: "Paused" })], [], TODAY).length, 0);
  assert.equal(dueSubscriptions([sub({ "End Date": "2026-08-01" })], [], TODAY).length, 0);
});

test("most overdue comes first", () => {
  const a = sub({ id: "a", "Start Date": "2026-09-01" });
  const b = sub({ id: "b", "Start Date": "2026-06-01" });
  assert.deepEqual(
    dueSubscriptions([a, b], [], TODAY).map((d) => d.sub.id),
    ["b", "a"],
  );
});

if (process.exitCode) {
  console.error("\nFAILED");
} else {
  console.log(`✓ ${passed} checks passed`);
}
