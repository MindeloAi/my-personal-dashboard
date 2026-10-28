import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { writeWorkbook, type Table } from "@/lib/accounts-export";
import { moneyToNumber } from "@/lib/csv";

/**
 * Chart downloads as Excel: POST { file, sheets: [{ name, columns, rows }] }.
 *
 * The browser sends the numbers it is already showing (each chart's table), so
 * this never touches the database; it only lays them out as a workbook. Money
 * text ("TT$1,200.00") becomes a real number in a TT$ column so it can be summed.
 * The proxy only proves a session exists; the admin check here is the gate.
 */

export const dynamic = "force-dynamic";

const CellSchema = z.union([z.string().max(2000), z.number(), z.null()]);
const Sheet = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(z.string().max(200)).min(1).max(40),
  rows: z.array(z.array(CellSchema).max(40)).max(5000),
});
const Body = z.object({ file: z.string().min(1).max(100), sheets: z.array(Sheet).min(1).max(60) });

// Excel sheet names: 31 characters, none of : \ / ? * [ ], and unique.
function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || "Sheet";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 27)} (${i++})`;
  used.add(n.toLowerCase());
  return n;
}

export async function POST(request: Request) {
  if (!(await getAdmin())) return new Response("Not authorised", { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad export request", { status: 400 });

  const used = new Set<string>();
  const tables: Table[] = parsed.data.sheets.map((s) => {
    const rows = s.rows.map((r) => r.map(moneyToNumber));
    return {
      name: sheetName(s.name, used),
      columns: s.columns.map((header, i) => ({
        header: header || " ",
        kind: rows.some((r) => typeof r[i] === "number") && s.rows.some((r) => typeof r[i] === "string" && r[i]!.toString().includes("TT$")) ? "money" : "text",
        width: i === 0 ? 24 : 16,
      })),
      rows,
    };
  });
  const body = await writeWorkbook(tables);
  const file = parsed.data.file.replace(/[^\w .-]/g, "").slice(0, 80) || "mindelo-chart";
  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
