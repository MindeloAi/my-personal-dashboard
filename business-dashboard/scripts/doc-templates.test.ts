// doc-templates.test.ts — pure rules for templates. No database.
//   bun scripts/doc-templates.test.ts
import assert from "node:assert/strict";
import {
  DEFAULT_SECTIONS,
  addDays,
  applyChange,
  firstCareInvoice,
  formatMoney,
  invoiceTypeFor,
  itemsProblem,
  nextChangeRef,
  parseItems,
} from "../src/lib/doc-templates";
import { missingFacts } from "../src/lib/documents";

// Defaults block finalising until filled in
assert.ok(missingFacts(DEFAULT_SECTIONS.proposal!).length > 0);
assert.ok(DEFAULT_SECTIONS.quote!.some((s) => s.key === "items"));
assert.ok(DEFAULT_SECTIONS.invoice!.some((s) => s.key === "items"));

// Items
assert.deepEqual(parseItems("Website build | 3,250.00\n\n  Hosting setup | TT$500 "), {
  items: [{ description: "Website build", amount: 3250 }, { description: "Hosting setup", amount: 500 }],
  bad: [],
});
assert.deepEqual(parseItems("no amount here").bad, ["no amount here"]);
assert.deepEqual(parseItems(" | 50").bad, ["| 50"]);
assert.deepEqual(parseItems("Thing | -5").bad, ["Thing | -5"]);
assert.equal(parseItems("A | x | 10").items[0].description, "A | x");
assert.deepEqual(parseItems("Hosting |").bad, ["Hosting |"], "no amount is refused, not zero");
assert.deepEqual(parseItems("Design | 0x10").bad, ["Design | 0x10"], "hex is not money");
assert.deepEqual(parseItems("Design | 1.234").bad, ["Design | 1.234"]);
assert.equal(itemsProblem("A | 0.10\nB | 0.20", 0.3), null); // cents, not floats
assert.match(itemsProblem("A | 100", 150)!, /add up to TT\$100\.00 but the total is TT\$150\.00/);
assert.match(itemsProblem("", null)!, /at least one item/);
assert.match(itemsProblem("oops", null)!, /description \| amount/);
assert.equal(itemsProblem("A | 100", null), null);

// Money
assert.equal(formatMoney(6500), "TT$6,500.00");
assert.equal(formatMoney(0.5), "TT$0.50");
assert.equal(formatMoney(10, "USD"), "USD 10.00");

// Invoice types
assert.equal(invoiceTypeFor(0, 1), "one_off");
assert.equal(invoiceTypeFor(0, 2), "deposit");
assert.equal(invoiceTypeFor(1, 2), "final");
assert.equal(invoiceTypeFor(1, 3), "milestone");

// Dates
assert.equal(addDays("2026-12-25", 14), "2027-01-08");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");

// Agreements, care plans, change requests: house style, and they block finalising
for (const type of ["service_agreement", "care_plan", "change_request"] as const) {
  const sections = DEFAULT_SECTIONS[type]!;
  assert.ok(sections.every((s) => !`${s.heading}${s.body}`.includes("—")), `${type} has an em dash`);
  assert.ok(missingFacts(sections).length > 0, `${type} should block finalising`);
}

// Change requests add to the price and the last payment
const lines = [
  { label: "Deposit", amount: 2500, trigger: "On acceptance" },
  { label: "Final", amount: 2500, trigger: "On completion" },
];
const changed = applyChange(5000, lines, 800);
assert.equal(changed.price, 5800);
assert.deepEqual(changed.schedule[0], lines[0]);
assert.equal(changed.schedule[1].amount, 3300);
assert.equal(lines[1].amount, 2500, "input not mutated");
assert.deepEqual(applyChange(5000, [], 800), { price: 5800, schedule: [] });
assert.deepEqual(applyChange(null, [], 800), { price: 800, schedule: [] });
assert.equal(applyChange(0.1, [{ label: "All", amount: 0.1, trigger: "x" }], 0.2).schedule[0].amount, 0.3);

// First care invoice: one month after the start, clamped to month end
assert.equal(firstCareInvoice("2026-01-31"), "2026-02-28");
assert.equal(firstCareInvoice("2028-01-31"), "2028-02-29");
assert.equal(firstCareInvoice("2026-11-04"), "2026-12-04");
assert.equal(firstCareInvoice("2026-12-15"), "2027-01-15");

// Change request references
assert.equal(nextChangeRef("TC-2026-01", []), "TC-2026-01-CR1");
assert.equal(nextChangeRef("TC-2026-01", ["Change request TC-2026-01-CR1", "TC-2026-01-CR2"]), "TC-2026-01-CR3");
assert.equal(nextChangeRef("TC-2026-01", ["TC-2026-02-CR5", "XTC-2026-01-CR7"]), "TC-2026-01-CR1");

console.log("All doc-templates checks pass");
