// Exchanges a code (with its PKCE verifier) or a refresh token for tokens.
import { redeemCode, refreshTokens, type Tokens } from "@/lib/oauth-db";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";
const HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*", "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => Response.json({ error }, { status, headers: HEADERS });

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = type.includes("application/json")
    ? ((await request.json().catch(() => null)) ?? {})
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const p = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");

  let tokens: Tokens | null;
  if (p("grant_type") === "authorization_code") {
    if (!p("code") || !p("client_id") || !p("redirect_uri") || !p("code_verifier")) return bad("invalid_request");
    tokens = await redeemCode({ code: p("code"), clientId: p("client_id"), redirectUri: p("redirect_uri"), verifier: p("code_verifier") });
  } else if (p("grant_type") === "refresh_token") {
    if (!p("refresh_token") || !p("client_id")) return bad("invalid_request");
    tokens = await refreshTokens({ refreshToken: p("refresh_token"), clientId: p("client_id") });
  } else {
    return bad("unsupported_grant_type");
  }
  if (!tokens) return bad("invalid_grant");
  return Response.json(
    { access_token: tokens.accessToken, token_type: "Bearer", expires_in: tokens.expiresIn, refresh_token: tokens.refreshToken, scope: SCOPE },
    { headers: HEADERS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });
