export const AUTH_COOKIE = "dashboard_auth";

/**
 * SHA-256 of `mindelo:<passcode>`, hex encoded. Web Crypto so this works in
 * both the Edge runtime (proxy.ts) and the Node runtime (the login action).
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`mindelo:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
