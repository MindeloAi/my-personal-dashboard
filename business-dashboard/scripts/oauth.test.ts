// oauth.test.ts — pure OAuth rules. No database.
//   bun scripts/oauth.test.ts
import assert from "node:assert/strict";
import { hashSecret, newSecret, pkceMatches, redirectAllowed, safeNext } from "../src/lib/oauth";

// Redirects: Claude's callbacks and loopback only
assert.ok(redirectAllowed("https://claude.ai/api/mcp/auth_callback"));
assert.ok(redirectAllowed("https://claude.com/api/mcp/auth_callback"));
assert.ok(redirectAllowed("http://localhost:33418/callback"));
assert.ok(redirectAllowed("http://127.0.0.1:5000/oauth/callback"));
assert.ok(!redirectAllowed("http://claude.ai/api/mcp/auth_callback"));
assert.ok(!redirectAllowed("https://claude.ai.evil.com/api/mcp/auth_callback"));
assert.ok(!redirectAllowed("https://claude.ai/api/mcp/auth_callback#x"));
assert.ok(!redirectAllowed("https://claude.ai/other"));
assert.ok(!redirectAllowed("https://localhost/callback"));
assert.ok(!redirectAllowed("http://localhost.evil.com/callback"));
assert.ok(!redirectAllowed("not a url"));
assert.ok(redirectAllowed("http://[::1]:5000/cb"), "IPv6 loopback");
assert.ok(!redirectAllowed("https://claude.ai/api/mcp/auth_callback?x=1"), "Claude callbacks match exactly");
assert.ok(!redirectAllowed("https://claude.ai@evil.com/api/mcp/auth_callback"));

// PKCE S256
const verifier = "a".repeat(43);
assert.ok(pkceMatches(verifier, "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA"));
assert.ok(!pkceMatches("b".repeat(43), "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA"));
assert.ok(!pkceMatches("short", "anything"));

// Secrets
const a = newSecret();
assert.ok(/^[A-Za-z0-9_-]{43}$/.test(a));
assert.notEqual(a, newSecret());
assert.equal(hashSecret(a), hashSecret(a));
assert.match(hashSecret(a), /^[0-9a-f]{64}$/);

// Login ?next=
assert.equal(safeNext("/oauth/authorize?x=1"), "/oauth/authorize?x=1");
assert.equal(safeNext("//evil.com"), null);
assert.equal(safeNext("/\\evil.com"), null);
assert.equal(safeNext("https://evil.com"), null);
assert.equal(safeNext(undefined), null);
assert.equal(safeNext("/\t/evil.com"), null, "browsers drop tabs: //evil.com");
assert.equal(safeNext("/\n/evil.com"), null);
assert.equal(safeNext("/%2F%2Fevil.com"), "/%2F%2Fevil.com");
for (const bad of ["/..//evil.com", "/.//evil.com", "/a/..//evil.com", "/%2e%2e//evil.com"])
  assert.equal(safeNext(bad), null, `dot segments collapse to //: ${bad}`);

console.log("All oauth checks pass");
