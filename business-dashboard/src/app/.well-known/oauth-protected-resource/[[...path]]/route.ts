// RFC 9728 metadata for /api/mcp. Answers both /.well-known/oauth-protected-resource
// and /.well-known/oauth-protected-resource/api/mcp.
import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    generateProtectedResourceMetadata({
      authServerUrls: [origin],
      resourceUrl: `${origin}/api/mcp`,
      additionalMetadata: { scopes_supported: [SCOPE] },
    }),
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
