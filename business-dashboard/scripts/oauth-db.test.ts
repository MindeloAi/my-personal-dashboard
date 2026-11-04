// oauth-db.test.ts — codes and tokens, against the THROWAWAY local database only.
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/oauth-db.test.ts
import postgres from "postgres";
import { issueCode, liveConnections, redeemCode, refreshTokens, revokeAllForUser, verifyAccessToken } from "../src/lib/oauth-db";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "claude-test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "a".repeat(43);
const CHALLENGE = "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA";

async function reset() {
  await sql`delete from oauth_codes`;
  await sql`delete from oauth_tokens`;
  await sql`delete from profiles where id = ${USER}`;
}

try {
  // Production has profiles (migration 005, tied to auth.users). The throwaway DB may not.
  await sql`create table if not exists profiles (id uuid primary key, email text not null, role text not null default 'admin')`;
  await reset();
  await sql`insert into profiles (id, email, role) values (${USER}, 'admin@mindelo.site', 'admin')`;

  const code = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  check("wrong verifier gets nothing", (await redeemCode({ code, clientId: CLIENT, redirectUri: REDIRECT, verifier: "b".repeat(43) })) === null);
  check("a code is burned by a failed attempt", (await redeemCode({ code, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER })) === null);

  const code2 = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  check("wrong redirect gets nothing", (await redeemCode({ code: code2, clientId: CLIENT, redirectUri: "http://localhost:1/cb", verifier: VERIFIER })) === null);

  const code3 = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  const t = await redeemCode({ code: code3, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER });
  check("a good code gives tokens", !!t?.accessToken && !!t.refreshToken && t.expiresIn === 3600);
  check("a code works once", (await redeemCode({ code: code3, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER })) === null);

  const who = await verifyAccessToken(t!.accessToken);
  check("the access token names the founder", who?.email === "admin@mindelo.site" && who.userId === USER && who.clientId === CLIENT);
  check("a refresh token is not an access token", (await verifyAccessToken(t!.refreshToken)) === null);
  check("garbage is not a token", (await verifyAccessToken("nope")) === null);

  const t2 = await refreshTokens({ refreshToken: t!.refreshToken, clientId: CLIENT });
  check("refresh gives a new pair", !!t2 && t2.accessToken !== t!.accessToken);
  check("refresh for another client is refused", (await refreshTokens({ refreshToken: t2!.refreshToken, clientId: "other" })) === null);
  check("a refresh token works once", (await refreshTokens({ refreshToken: t!.refreshToken, clientId: CLIENT })) === null);
  check("replaying a spent refresh token revokes the new access token", (await verifyAccessToken(t2!.accessToken)) === null);
  check("replaying a spent refresh token revokes the new refresh token", (await refreshTokens({ refreshToken: t2!.refreshToken, clientId: CLIENT })) === null);

  const fresh = async () => redeemCode({
    code: await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE }),
    clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER,
  });

  await sql`update oauth_tokens set expires_at = now() - interval '1 second' where kind = 'access'`;
  check("an expired access token is refused", (await verifyAccessToken(t!.accessToken)) === null);

  // Housekeeping: rows expired over a day ago are deleted when new ones are issued.
  await sql`insert into oauth_tokens (token_hash, kind, user_id, client_id, expires_at) values ('old-token', 'access', ${USER}, ${CLIENT}, now() - interval '2 days')`;
  await sql`insert into oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at)
            values ('old-code', ${USER}, ${CLIENT}, ${REDIRECT}, ${CHALLENGE}, now() - interval '2 days')`;
  await fresh();
  check("expired tokens are cleaned up", (await sql`select 1 from oauth_tokens where token_hash = 'old-token'`).length === 0);
  check("expired codes are cleaned up", (await sql`select 1 from oauth_codes where code_hash = 'old-code'`).length === 0);

  // issueCode checks its own input
  for (const [name, bad] of [
    ["a redirect off the allow-list", { redirectUri: "https://evil.com/cb", codeChallenge: CHALLENGE }],
    ["a malformed code challenge", { redirectUri: REDIRECT, codeChallenge: "short" }],
  ] as const) {
    let threw = false;
    try {
      await issueCode({ userId: USER, clientId: CLIENT, ...bad });
    } catch {
      threw = true;
    }
    check(`issueCode refuses ${name}`, threw);
  }

  // A code redeemed four times at once has exactly one winner.
  const raced = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  const results = await Promise.all(Array.from({ length: 4 }, () => redeemCode({ code: raced, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER })));
  check("four concurrent redeems give one winner", results.filter(Boolean).length === 1, String(results.filter(Boolean).length));

  // Disconnect Claude
  const a1 = await fresh();
  const a2 = await fresh();
  check("two sign-ins from one app count as one connection", (await liveConnections(USER)) === 1);
  check("revokeAllForUser counts the live tokens it revoked", (await revokeAllForUser(USER)) >= 4);
  check("after disconnect there are no connections", (await liveConnections(USER)) === 0);
  check("after disconnect no access token works", (await verifyAccessToken(a1!.accessToken)) === null && (await verifyAccessToken(a2!.accessToken)) === null);
  check("after disconnect no refresh token works", (await refreshTokens({ refreshToken: a1!.refreshToken, clientId: CLIENT })) === null);

  const t3 = await fresh();
  // An admin profile whose address is not on ADMIN_EMAILS gets nothing.
  await sql`update profiles set email = 'zaneadams@mindelo.site' where id = ${USER}`;
  check("an admin off the email list has no access", (await verifyAccessToken(t3!.accessToken)) === null);
  const off = await fresh();
  check("an admin off the email list cannot refresh", (await refreshTokens({ refreshToken: off!.refreshToken, clientId: CLIENT })) === null);
  await sql`update profiles set email = 'Admin@Mindelo.site' where id = ${USER}`;
  check("the email list ignores case", (await verifyAccessToken(t3!.accessToken)) !== null);
  await sql`delete from profiles where id = ${USER}`;
  check("a token stops working when the profile goes", (await verifyAccessToken(t3!.accessToken)) === null);
  check("refresh stops working when the profile goes", (await refreshTokens({ refreshToken: t3!.refreshToken, clientId: CLIENT })) === null);

  const stored = await sql`select token_hash from oauth_tokens`;
  check("only hashes are stored", stored.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash)) && !stored.some((r) => r.token_hash === t3!.accessToken));
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll oauth-db checks pass");
process.exit(failures ? 1 : 0);
