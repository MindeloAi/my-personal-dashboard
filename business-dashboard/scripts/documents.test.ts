// Checks the document and deal rules. No database.
//   bun scripts/documents.test.ts
import assert from "node:assert/strict";
import {
  canMove,
  mergeSections,
  missingFacts,
  nextReference,
  scheduleProblem,
  suggestPrefix,
  type Section,
} from "../src/lib/documents";

// References
assert.equal(nextReference("IB", 2026, []), "IB-2026-01");
assert.equal(nextReference("ib", 2026, ["IB-2026-01", "IB-2026-03", "IB-2025-07"]), "IB-2026-04", "next after the highest that year");
assert.equal(nextReference("A&B Co", 2026, []), "ABCO-2026-01", "non-alphanumerics dropped");
assert.throws(() => nextReference("X", 2026, []), /two letters/);
assert.equal(suggestPrefix("Island Bites"), "IB");
assert.equal(suggestPrefix("Acme"), "ACME");
assert.equal(suggestPrefix("The Plumbing Solutions Limited"), "PS", "filler words skipped");
assert.equal(suggestPrefix("!!"), "CL", "fallback");

// Payment schedule
assert.equal(scheduleProblem(null, []), null, "no schedule is fine");
assert.equal(scheduleProblem(6500, [
  { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
  { label: "Payment 2", amount: 3250, trigger: "On handover" },
]), null);
assert.equal(scheduleProblem(0.3, [
  { label: "a", amount: 0.1, trigger: "x" },
  { label: "b", amount: 0.2, trigger: "y" },
]), null, "compared in cents");
assert.match(scheduleProblem(6500, [{ label: "P1", amount: 3000, trigger: "x" }]) ?? "", /add up to 3000\.00/);
assert.match(scheduleProblem(null, [{ label: "P1", amount: 10, trigger: "x" }]) ?? "", /total price/);
assert.match(scheduleProblem(10, [{ label: "", amount: 10, trigger: "x" }]) ?? "", /label/);
assert.match(scheduleProblem(10, [{ label: "P1", amount: 0, trigger: "x" }]) ?? "", /more than zero/);

// Status transitions
assert.equal(canMove("draft", "finalised"), true);
assert.equal(canMove("draft", "sent"), false, "must be finalised before it is sent");
assert.equal(canMove("sent", "draft"), true, "revising a sent document starts a new draft");
assert.equal(canMove("signed", "draft"), false, "signed is final");
assert.equal(canMove("void", "draft"), false, "void is final");

// Missing facts
const secs: Section[] = [
  { key: "parties", heading: "The client", body: "{{missing: client address}}\nRepresented by {{ missing: signatory title }}" },
  { key: "fees", heading: "Fees", body: "Total {{missing: client address}}" },
];
assert.deepEqual(missingFacts(secs), ["client address", "signatory title"], "deduplicated, in order");
assert.deepEqual(missingFacts([{ key: "a", heading: "A", body: "all there" }]), []);

// Section merge
const base: Section[] = [
  { key: "a", heading: "A", body: "1" },
  { key: "b", heading: "B", body: "2" },
];
assert.deepEqual(mergeSections(base, [{ key: "b", heading: "B", body: "new" }]).map((s) => s.body), ["1", "new"], "replaced in place");
assert.deepEqual(mergeSections(base, [{ key: "c", heading: "C", body: "3" }]).map((s) => s.key), ["a", "b", "c"], "new keys appended");
assert.deepEqual(
  mergeSections(base, [{ key: "c", heading: "C", body: "x" }, { key: "c", heading: "C", body: "y" }]).map((s) => s.body),
  ["1", "2", "y"],
  "a key given twice: last wins, appended once",
);

console.log("documents: all checks pass");
