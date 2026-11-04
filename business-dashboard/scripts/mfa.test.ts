// mfa.test.ts — where a signed-in founder goes next. No database.
//   bun scripts/mfa.test.ts
import assert from "node:assert/strict";
import { nextStep } from "../src/lib/mfa";

assert.equal(nextStep({ currentLevel: "aal2", nextLevel: "aal2" }), "done");
assert.equal(nextStep({ currentLevel: "aal1", nextLevel: "aal2" }), "code");
assert.equal(nextStep({ currentLevel: "aal1", nextLevel: "aal1" }), "setup");
assert.equal(nextStep({ currentLevel: null, nextLevel: null }), "setup");
console.log("All mfa checks pass");
