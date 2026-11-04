import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { getAttachment } from "@/lib/documents-db";
import { signedDownload } from "@/lib/storage";

/**
 * GET /admin/files/:id — redirects to a five-minute signed download URL. A plain
 * link (no client-side window.open after an await), so popup blockers leave it alone.
 * The proxy only proves a session exists; the admin check here is the real gate.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return new Response("Not authorised", { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Unknown file", { status: 404 });
  const att = await getAttachment(id);
  if (!att) return new Response("That file no longer exists", { status: 404 });
  return Response.redirect(await signedDownload(att.storagePath, att.filename), 302);
}
