// The Claude connector. Claude Code and the Claude app call this with an OAuth
// bearer token (see app/oauth/*). The token names a founder; the tools are the
// fixed list in lib/connector/tools.ts and nothing else.
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TOOLS } from "@/lib/connector/tools";
import { DocumentRuleError } from "@/lib/documents-db";
import { verifyAccessToken } from "@/lib/oauth-db";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) });

const handler = createMcpHandler(
  (server) => {
    for (const t of TOOLS) {
      server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.input }, async (args, ctx) => {
        const email = ctx.http?.authInfo?.extra?.email;
        if (typeof email !== "string") return text("Not signed in. Reconnect the Mindelo connector.", true);
        try {
          return text(JSON.stringify(await t.run(args, email), null, 2));
        } catch (e) {
          if (e instanceof DocumentRuleError) return text(e.message, true);
          console.error(`[mcp] ${t.name}`, e);
          // Not "nothing was saved": save_draft sets the payee and the sections in two steps.
          return text("That did not work on the dashboard side. Check what was saved (get_document or find) before trying again, or tell a founder.", true);
        }
      });
    }
  },
  { serverInfo: { name: "mindelo", version: "1.0.0" } },
);

const authed = withMcpAuth(
  handler,
  async (_req, token) => {
    if (!token) return undefined;
    const who = await verifyAccessToken(token);
    if (!who) return undefined;
    return { token, clientId: who.clientId, scopes: [SCOPE], expiresAt: Math.floor(who.expiresAt / 1000), extra: { email: who.email, userId: who.userId } };
  },
  { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource" },
);

export { authed as GET, authed as POST, authed as DELETE };
