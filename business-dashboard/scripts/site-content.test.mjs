// Checks the public copy in the marketing site's data files.
//
//   CONTENT_BLOCKLIST_FILE=<path> npm run test:content
//
// The blocklist names terms that must never be published. It lives outside
// this repo on purpose: the repo is public, so committing the list would
// publish every name on it. Without it the test fails rather than skipping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { websites } from "../src/app/(site)/websites/_data.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const EM_DASH = "\u2014";

function strings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word and case-insensitive. A trailing "*" drops the closing word
// boundary, so "over engineer*" also matches "over engineering".
function blockedTerms(text, terms) {
  return terms.filter((term) => {
    const prefix = term.endsWith("*");
    const body = escapeRegExp(prefix ? term.slice(0, -1) : term);
    return new RegExp(`\\b${body}${prefix ? "" : "\\b"}`, "i").test(text);
  });
}

function loadBlocklist() {
  const file = process.env.CONTENT_BLOCKLIST_FILE;
  assert.ok(file, "Set CONTENT_BLOCKLIST_FILE to the private blocklist path");
  assert.ok(existsSync(file), `Blocklist not found: ${file}`);
  const terms = readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.ok(terms.length > 0, "Blocklist is empty");
  return terms;
}

function assertCleanCopy(label, value, terms) {
  for (const text of strings(value)) {
    assert.ok(!text.includes(EM_DASH), `${label}: em dash in "${text}"`);
    const hits = blockedTerms(text, terms);
    assert.deepEqual(hits, [], `${label}: blocked term ${hits.join(", ")} in "${text}"`);
  }
}

test("blocklist matcher is whole-word, case-insensitive, with * prefixes", () => {
  assert.deepEqual(blockedTerms("Bobby signed off", ["Bob"]), []);
  assert.deepEqual(blockedTerms("thanks, bob", ["Bob"]), ["Bob"]);
  assert.deepEqual(blockedTerms("we over engineered it", ["over engineer*"]), ["over engineer*"]);
  assert.deepEqual(blockedTerms("an Acme Widgets label", ["Acme Widgets"]), ["Acme Widgets"]);
});

test("websites: copy has no em dash and no blocked term", () => {
  const terms = loadBlocklist();
  for (const site of websites) assertCleanCopy(site.client, site, terms);
});

test("websites: slugs are unique and URLs are https", () => {
  const slugs = websites.map((site) => site.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug");
  for (const site of websites) {
    assert.match(site.slug, /^[a-z0-9-]+$/, `${site.client}: bad slug`);
    assert.equal(new URL(site.url).protocol, "https:", `${site.client}: not https`);
  }
});

test("websites: every screenshot exists and matches its slug", () => {
  for (const site of websites) {
    assert.equal(site.image, `/assets/websites/${site.slug}.webp`, `${site.client}: image path`);
    assert.ok(existsSync(path.join(ROOT, "public", site.image)), `${site.client}: missing ${site.image}`);
  }
});
