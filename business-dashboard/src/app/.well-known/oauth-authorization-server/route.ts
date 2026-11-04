// RFC 8414 metadata for the connector's authorization server (this app).
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" };

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      scopes_supported: [SCOPE],
    },
    { headers: CORS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
