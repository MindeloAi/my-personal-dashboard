"use client";

import { useMemo } from "react";
import { parseISO, isAfter, startOfYear } from "date-fns";
import type { Project, Invoice } from "@/lib/airtable";

type Props = { projects: Project[]; invoices: Invoice[] };

const TYPE_COLORS: Record<string, string> = {
  "Web Dev": "#bfff3a",
  Automation: "#c44dff",
  Hybrid: "#3affd1",
  Unspecified: "#3a3f47",
};

const ACTIVE_STATUSES = new Set(["Lead", "In Progress", "Review"]);

function Donut({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 38;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce<{
    items: Array<{ name: string; value: number; length: number; offset: number; color: string; pct: number }>;
    cursor: number;
  }>(
    (acc, d) => {
      const pct = total === 0 ? 0 : d.value / total;
      const length = pct * circumference;
      acc.items.push({
        name: d.name,
        value: d.value,
        length,
        offset: acc.cursor,
        color: TYPE_COLORS[d.name] ?? "#3a3f47",
        pct,
      });
      acc.cursor += length;
      return acc;
    },
    { items: [], cursor: 0 },
  ).items;

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="relative" style={{ width: 110, height: 110 }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1f242a" strokeWidth={stroke} />
          {segments.map((s) => (
            <circle
              key={s.name}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.length} ${circumference}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-white tabular-nums">
            ${total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ServiceTypeSplit({ projects, invoices }: Props) {
  const { activeData, paidData, hasData } = useMemo(() => {
    const ytdStart = startOfYear(new Date());

    const projectTypeMap = new Map<string, string>();
    for (const p of projects) {
      projectTypeMap.set(p.id, p["Service Type"] ?? "Unspecified");
    }

    const activeMap = new Map<string, number>();
    for (const p of projects) {
      if (!ACTIVE_STATUSES.has(p.Status ?? "")) continue;
      const type = p["Service Type"] ?? "Unspecified";
      activeMap.set(type, (activeMap.get(type) ?? 0) + (p["Total Value"] ?? 0));
    }

    const paidMap = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.Status !== "Paid") continue;
      if (!inv["Paid Date"]) continue;
      const paidDate = parseISO(inv["Paid Date"]);
      if (!isAfter(paidDate, ytdStart) && paidDate.getTime() !== ytdStart.getTime()) {
        if (paidDate < ytdStart) continue;
      }
      const linkedProject = inv.Project?.[0];
      const type = (linkedProject && projectTypeMap.get(linkedProject)) || "Unspecified";
      paidMap.set(type, (paidMap.get(type) ?? 0) + (inv.Amount ?? 0));
    }

    const toData = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const activeData = toData(activeMap);
    const paidData = toData(paidMap);
    const total = activeData.reduce((s, d) => s + d.value, 0) + paidData.reduce((s, d) => s + d.value, 0);

    return { activeData, paidData, hasData: total > 0 };
  }, [projects, invoices]);

  const allLabels = Array.from(
    new Set([...activeData.map((d) => d.name), ...paidData.map((d) => d.name)])
  );

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-white">Service mix</p>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">YTD</span>
      </div>

      {!hasData ? (
        <div className="py-8 text-center">
          <p className="text-xs text-zinc-600">No service-type data yet</p>
          <p className="text-[10px] text-zinc-700 mt-1">Tag projects with Service Type in Airtable</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <Donut data={activeData} label="Active pipeline" />
            <Donut data={paidData} label="Paid revenue" />
          </div>

          <div className="mt-4 pt-3 border-t border-[#2a2e34] flex flex-wrap gap-x-4 gap-y-1.5">
            {allLabels.map((name) => (
              <div key={name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: TYPE_COLORS[name] ?? "#3a3f47" }}
                />
                <span className="text-[10px] text-zinc-400">{name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
