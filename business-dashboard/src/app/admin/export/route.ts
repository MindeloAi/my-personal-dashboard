import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { getAccountsExport } from "@/lib/db";
import { today } from "@/lib/subscriptions";
import { exportFileName, toCsvZip, toXlsx } from "@/lib/accounts-export";

/**
 * Accounts export download: GET /admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv
 *
 * Read-only (getAccountsExport runs in a read-only transaction). The proxy only
 * proves a session exists, so the admin check here is the real gate, as on
 * every admin page. Spec: docs/superpowers/specs/2026-10-23-accounts-export-design.md
 */

export const dynamic = "force-dynamic";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d)), "not a real date");
const Query = z
  .object({ from: Day, to: Day, format: z.enum(["xlsx", "csv"]) })
  .refine((q) => q.from <= q.to, "the From date is after the To date");

export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("Not authorised", { status: 401 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) {
    return new Response(`Bad export request: ${parsed.error.issues.map((i) => i.message).join("; ")}`, { status: 400 });
  }
  const { from, to, format } = parsed.data;

  const data = await getAccountsExport(from, to, today());
  const [body, type, ext] =
    format === "xlsx"
      ? [await toXlsx(data), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx" as const]
      : [toCsvZip(data), "application/zip", "zip" as const];

  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${exportFileName(data, ext)}"`,
      "Cache-Control": "no-store",
    },
  });
}
