// GET /admin/documents/<id>/pdf?version=N  -> the stored PDF of version N (rendered on first request)
// GET /admin/documents/<id>/pdf            -> a live preview of the current draft, never stored
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { ensurePdf, loadPdfData } from "@/lib/pdf/store";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { signedDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return new NextResponse("Not authorised", { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const raw = new URL(request.url).searchParams.get("version");
  const version = raw === null ? 0 : Number(raw);
  if (!Number.isInteger(version) || version < 0 || version > 2147483647) return new NextResponse("Bad version", { status: 400 });

  try {
    if (version === 0) {
      const data = await loadPdfData(id, 0);
      if (!data) return new NextResponse("Not found", { status: 404 });
      return new NextResponse(new Uint8Array(await renderDocumentPdf(data)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${slug(data.title)}-draft.pdf"`, "Cache-Control": "no-store" },
      });
    }
    const [v] = await getSql()`select title, pdf_path from document_versions where document_id = ${id} and version = ${version}`;
    if (!v) return new NextResponse("Not found", { status: 404 });
    const path = v.pdf_path ?? (await ensurePdf(id, version));
    return NextResponse.redirect(await signedDownload(path, `${slug(v.title)}-v${version}.pdf`), 302);
  } catch (e) {
    console.error("[documents/pdf]", e);
    return new NextResponse("The PDF could not be made. Try again.", { status: 500 });
  }
}
