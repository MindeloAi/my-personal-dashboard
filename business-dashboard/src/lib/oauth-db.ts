// Authorization codes and tokens for the Claude connector (migration 024).
// Only SHA-256 hashes are stored. Every token check re-reads `profiles`, so
// removing a founder's profile ends Claude's access at the next call.
import { getSql } from "./db";
import { ACCESS_TTL_S, CODE_TTL_S, REFRESH_TTL_S, hashSecret, newSecret, pkceMatches, redirectAllowed } from "./oauth";

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export async function issueCode(a: { userId: string; clientId: string; redirectUri: string; codeChallenge: string }): Promise<string> {
  // Defence in depth: the authorize page checks these too.
  if (!redirectAllowed(a.redirectUri)) throw new Error("That redirect is not allowed");
  if (!/^[A-Za-z0-9_-]{43}$/.test(a.codeChallenge)) throw new Error("A code challenge must be S256 (43 characters)");
  const code = newSecret();
  const sql = getSql();
  await sql`delete from oauth_codes where expires_at < now() - interval '1 day'`;
  await sql`
    insert into oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at)
    values (${hashSecret(code)}, ${a.userId}, ${a.clientId}, ${a.redirectUri}, ${a.codeChallenge},
            now() + make_interval(secs => ${CODE_TTL_S}))`;
  return code;
}

async function issueTokens(userId: string, clientId: string): Promise<Tokens> {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const sql = getSql();
  await sql`delete from oauth_tokens where expires_at < now() - interval '1 day'`;
  await sql`
    insert into oauth_tokens (token_hash, kind, user_id, client_id, expires_at) values
      (${hashSecret(accessToken)}, 'access', ${userId}, ${clientId}, now() + make_interval(secs => ${ACCESS_TTL_S})),
      (${hashSecret(refreshToken)}, 'refresh', ${userId}, ${clientId}, now() + make_interval(secs => ${REFRESH_TTL_S}))`;
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
}

/** Single use: the code is spent by the first attempt, right or wrong. */
export async function redeemCode(a: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<Tokens | null> {
  const sql = getSql();
  const [row] = await sql`
    update oauth_codes set used_at = now()
     where code_hash = ${hashSecret(a.code)} and used_at is null and expires_at > now()
     returning user_id, client_id, redirect_uri, code_challenge`;
  if (!row) return null;
  if (row.client_id !== a.clientId || row.redirect_uri !== a.redirectUri || !pkceMatches(a.verifier, row.code_challenge)) return null;
  return issueTokens(String(row.user_id), a.clientId);
}

/**
 * Rotates: the old refresh token is revoked whether or not the new pair is used.
 * Presenting an already-revoked refresh token means it was copied, so every live
 * token of that founder and client is revoked too (RFC 9700 reuse detection).
 */
export async function refreshTokens(a: { refreshToken: string; clientId: string }): Promise<Tokens | null> {
  const sql = getSql();
  const [row] = await sql`
    update oauth_tokens set revoked_at = now()
     where token_hash = ${hashSecret(a.refreshToken)} and kind = 'refresh' and client_id = ${a.clientId}
       and revoked_at is null and expires_at > now()
       and exists (select 1 from profiles p where p.id = oauth_tokens.user_id and p.role = 'admin')
     returning user_id`;
  if (!row) {
    await sql`
      update oauth_tokens t set revoked_at = now()
        from oauth_tokens old
       where old.token_hash = ${hashSecret(a.refreshToken)} and old.kind = 'refresh' and old.revoked_at is not null
         and t.user_id = old.user_id and t.client_id = old.client_id and t.revoked_at is null`;
    return null;
  }
  return issueTokens(String(row.user_id), a.clientId);
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string; clientId: string; expiresAt: number } | null> {
  const sql = getSql();
  const [row] = await sql`
    select t.user_id, t.client_id, t.expires_at, p.email
      from oauth_tokens t join profiles p on p.id = t.user_id and p.role = 'admin'
     where t.token_hash = ${hashSecret(token)} and t.kind = 'access' and t.revoked_at is null and t.expires_at > now()`;
  return row
    ? { userId: String(row.user_id), email: String(row.email), clientId: String(row.client_id), expiresAt: new Date(row.expires_at).getTime() }
    : null;
}

/** Disconnect Claude: revoke every live token of one founder. Returns how many were revoked. */
export async function revokeAllForUser(userId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`update oauth_tokens set revoked_at = now() where user_id = ${userId} and revoked_at is null returning 1`;
  return rows.length;
}

/** How many Claude apps (OAuth clients) one founder has connected right now. */
export async function liveConnections(userId: string): Promise<number> {
  const sql = getSql();
  const [r] = await sql`
    select count(distinct client_id)::int as n from oauth_tokens
     where user_id = ${userId} and kind = 'refresh' and revoked_at is null and expires_at > now()`;
  return r.n;
}
