// doc-templates.test.ts — pure rules for templates. No database.
//   bun scripts/doc-templates.test.ts
import assert from "node:assert/strict";
import { DEFAULT_SECTIONS, addDays, formatMoney, invoiceTypeFor, itemsProblem, parseItems } from "../src/lib/doc-templates";
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

console.log("All doc-templates checks pass");
