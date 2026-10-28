"use client";

import { useMemo, useState } from "react";
import { parseISO, startOfYear } from "date-fns";
import type { Client, Invoice, Project } from "@/lib/airtable";
import { Explain } from "./explain";

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
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#1B2533]">Top clients</p>
          {concentrationWarn && (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#B45309]/12 text-[#B45309] font-medium">
              ⚠ concentration
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-[#F3F5F8] rounded-[4px] p-1">
          {(["YTD", "All-time"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[4px] text-[10px] font-medium transition-colors ${
                range === r ? "bg-[#1D4ED8] text-white" : "text-[#4A5568] hover:text-[#0E1A2B]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <Explain
        className="-mt-2 mb-4"
        shows="The five clients who have paid the most in the chosen range."
        watch="A client above 40% of revenue is flagged: the business depends heavily on them."
          />

      {rows.length === 0 ? (
        <p className="text-xs text-[#6B7789] py-6 text-center">No paid invoices in this range</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isSelected = selectedClientId === row.clientId;
            return (
              <button
                key={row.clientId}
                onClick={() => onSelectClient(isSelected ? null : row.clientId)}
                className={`w-full text-left rounded-[4px] px-3 py-2 transition-colors ${
                  isSelected
                    ? "bg-[#1D4ED8]/10 border border-[#1D4ED8]/30"
                    : "border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#1B2533] truncate pr-2">{row.name}</span>
                  <span className="text-xs font-semibold text-[#1B2533] tabular-nums shrink-0">
                    TT${row.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#EEF1F5] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.pct > 40 ? "bg-[#B45309]" : "bg-[#1D4ED8]"
                      }`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#5A6678] tabular-nums shrink-0">
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
          className="mt-3 text-[10px] text-[#5A6678] hover:text-[#0E1A2B] transition-colors"
        >
          Clear filter ✕
        </button>
      )}
    </div>
  );
}
