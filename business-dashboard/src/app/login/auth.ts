// Shared auth helpers used by both the proxy (request gating) and the login
// server action (cookie minting). Kept free of `next/headers` and other
// server-only imports so it is safe to import from `proxy.ts`.

export const AUTH_COOKIE = "dashboard_auth";

/**
 * Derive the session token from the shared passcode. We store a SHA-256 hash
 * of the passcode in the cookie rather than the raw secret, so the passcode
 * itself never travels in the cookie jar. Uses Web Crypto, which is available
 * in both the Node.js and Edge runtimes.
 */
export async function deriveToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`mindelo:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The token expected for the currently configured passcode, or null if unset. */
export async function expectedToken(): Promise<string | null> {
  const passcode = process.env.DASHBOARD_PASSCODE;
  if (!passcode) return null;
  return deriveToken(passcode);
}

/** Constant-time-ish comparison of the cookie value against the expected token. */
export function tokenMatches(
  cookieValue: string | undefined,
  expected: string | null,
): boolean {
  if (!cookieValue || !expected) return false;
  if (cookieValue.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
