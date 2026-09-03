"use client";

import { useMemo, useState } from "react";
import { parseISO, startOfYear } from "date-fns";
import type { Client, Invoice, Project } from "@/lib/airtable";

type Range = "YTD" | "All-time";

type Props = {
  clients: Client[];
  invoices: Invoice[];
  projects: Project[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
};

type Row = {
  clientId: string;
  name: string;
  revenue: number;
  invoiceCount: number;
  pct: number;
};

export function TopClients({ clients, invoices, projects, selectedClientId, onSelectClient }: Props) {
  const [range, setRange] = useState<Range>("YTD");

  const { rows, concentrationWarn } = useMemo(() => {
    const ytdStart = startOfYear(new Date());

    const projectToClient = new Map<string, string | undefined>();
    for (const p of projects) {
      projectToClient.set(p.id, p.Client?.[0]);
    }

    const clientName = new Map<string, string>();
    for (const c of clients) clientName.set(c.id, c.Company || c.Name);

    const totalsById = new Map<string, { revenue: number; count: number }>();

    for (const inv of invoices) {
      if (inv.Status !== "Paid") continue;
      if (range === "YTD") {
        if (!inv["Paid Date"]) continue;
        if (parseISO(inv["Paid Date"]) < ytdStart) continue;
      }
      const directClient = inv.Client?.[0];
      const projectClient = inv.Project?.[0] ? projectToClient.get(inv.Project[0]) : undefined;
      const clientId = directClient ?? projectClient;
      if (!clientId) continue;
      const cur = totalsById.get(clientId) ?? { revenue: 0, count: 0 };
      cur.revenue += inv.Amount ?? 0;
      cur.count += 1;
      totalsById.set(clientId, cur);
    }

    const totalRevenue = Array.from(totalsById.values()).reduce((s, v) => s + v.revenue, 0);

    const rows: Row[] = Array.from(totalsById.entries())
      .map(([clientId, v]) => ({
        clientId,
        name: clientName.get(clientId) ?? "Unknown",
        revenue: v.revenue,
        invoiceCount: v.count,
        pct: totalRevenue === 0 ? 0 : Math.round((v.revenue / totalRevenue) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const concentrationWarn = rows.some((r) => r.pct > 40);

    return { rows, concentrationWarn };
  }, [clients, invoices, projects, range]);

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">Top clients</p>
          {concentrationWarn && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fbbf24]/12 text-[#fbbf24] font-medium">
              ⚠ concentration
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-[#0b0d10] rounded-xl p-1">
          {(["YTD", "All-time"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                range === r ? "bg-[#bfff3a] text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 py-6 text-center">No paid invoices in this range</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isSelected = selectedClientId === row.clientId;
            return (
              <button
                key={row.clientId}
                onClick={() => onSelectClient(isSelected ? null : row.clientId)}
                className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${
                  isSelected
                    ? "bg-[#bfff3a]/10 border border-[#bfff3a]/30"
                    : "border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white truncate pr-2">{row.name}</span>
                  <span className="text-xs font-semibold text-white tabular-nums shrink-0">
                    ${row.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#1f242a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.pct > 40 ? "bg-[#fbbf24]" : "bg-[#bfff3a]"
                      }`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                    {row.pct}% · {row.invoiceCount} {row.invoiceCount === 1 ? "inv" : "invs"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedClientId && (
        <button
          onClick={() => onSelectClient(null)}
          className="mt-3 text-[10px] text-zinc-500 hover:text-white transition-colors"
        >
          Clear filter ✕
        </button>
      )}
    </div>
  );
}
