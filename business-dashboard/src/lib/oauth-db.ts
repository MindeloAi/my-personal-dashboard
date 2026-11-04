// Authorization codes and tokens for the Claude connector (migration 024).
// Only SHA-256 hashes are stored. Every token check re-reads `profiles`, so
// removing a founder's profile ends Claude's access at the next call.
import { getSql } from "./db";
import { ACCESS_TTL_S, CODE_TTL_S, REFRESH_TTL_S, hashSecret, newSecret, pkceMatches } from "./oauth";

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export async function issueCode(a: { userId: string; clientId: string; redirectUri: string; codeChallenge: string }): Promise<string> {
  const code = newSecret();
  const sql = getSql();
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

/** Rotates: the old refresh token is revoked whether or not the new pair is used. */
export async function refreshTokens(a: { refreshToken: string; clientId: string }): Promise<Tokens | null> {
  const sql = getSql();
  const [row] = await sql`
    update oauth_tokens set revoked_at = now()
     where token_hash = ${hashSecret(a.refreshToken)} and kind = 'refresh' and client_id = ${a.clientId}
       and revoked_at is null and expires_at > now()
     returning user_id`;
  return row ? issueTokens(String(row.user_id), a.clientId) : null;
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
