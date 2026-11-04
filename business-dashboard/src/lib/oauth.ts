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
  if (u.protocol === "https:" && CLAUDE_CALLBACKS.includes(`${u.origin}${u.pathname}`)) return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

export const newSecret = () => randomBytes(32).toString("base64url");
export const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");

/** RFC 7636 S256. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** A same-site path to return to after sign-in, or null. */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
