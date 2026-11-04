// Pure rules for the small OAuth 2.1 server behind the Claude connector.
//
// Who can get a token: only a founder who signs in on our own login page and
// presses Allow. Which apps can receive the code: only Claude (claude.ai and
// claude.com callbacks) and loopback addresses (Claude Code on a founder's
// machine). Client registration is therefore not a security boundary and is
// stateless; the redirect allow-list plus PKCE is. Secrets are stored as
// SHA-256 hashes only.
import { createHash, randomBytes } from "node:crypto";

export const CODE_TTL_S = 300;
export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 30 * 24 * 3600;
export const SCOPE = "mindelo";

const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (CLAUDE_CALLBACKS.includes(u.href)) return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

export const newSecret = () => randomBytes(32).toString("base64url");
export const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");

/** RFC 7636 S256. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** A same-site path to return to after sign-in, or null. Parsed the way a browser would (tabs, newlines, backslashes). */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  const u = new URL(next, "https://x.invalid");
  if (u.origin !== "https://x.invalid") return null;
  const out = u.pathname + u.search;
  // Dot segments can collapse "/..//evil.com" to "//evil.com", a protocol-relative URL.
  return out.startsWith("//") ? null : out;
}
