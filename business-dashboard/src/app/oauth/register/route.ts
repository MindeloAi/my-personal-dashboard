// RFC 7591 dynamic client registration, stateless. Any client may register;
// what protects the founders is the redirect allow-list and PKCE (lib/oauth.ts),
// so a registration records nothing.
import { randomUUID } from "node:crypto";
import { redirectAllowed } from "@/lib/oauth";

export const dynamic = "force-dynamic";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const uris: unknown = body?.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === "string" && redirectAllowed(u)))
    return Response.json({ error: "invalid_redirect_uri", error_description: "Only Claude and loopback redirect URIs are accepted" }, { status: 400, headers: CORS });
  return Response.json(
    {
      client_id: `mindelo-${randomUUID()}`,
      client_name: typeof body.client_name === "string" ? body.client_name : "Claude",
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
