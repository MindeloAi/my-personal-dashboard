"use client";

import { useMemo } from "react";
import { parseISO, differenceInDays, startOfYear } from "date-fns";
import type { Client, Project, Invoice } from "@/lib/airtable";
import { isOverdue } from "@/lib/invoices";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  onJumpToOverdue?: () => void;
};

const CLOSE_PROBABILITY: Record<string, number> = {
  Lead: 0.2,
  "In Progress": 0.6,
  Review: 0.85,
  Done: 1,
};

export function BusinessCounters({ clients, projects, invoices, onJumpToOverdue }: Props) {
  const stats = useMemo(() => {
    const ytdStart = startOfYear(new Date());

    const activeClients = clients.filter((c) => c.Status === "Active" || !c.Status).length;
    const activeProjects = projects.filter(
      (p) => p.Status === "In Progress" || p.Status === "Review"
    ).length;
    const leads = projects.filter((p) => p.Status === "Lead").length;
    const doneProjects = projects.filter((p) => p.Status === "Done").length;

    const overdueInvoices = invoices.filter((i) => isOverdue(i));
    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.Amount ?? 0), 0);

    const pipelineValue = projects
      .filter((p) => p.Status === "Lead" || p.Status === "In Progress" || p.Status === "Review")
      .reduce((s, p) => s + (p["Total Value"] ?? 0), 0);

    const weightedPipeline = projects
      .filter((p) => p.Status === "Lead" || p.Status === "In Progress" || p.Status === "Review")
      .reduce((s, p) => {
        const prob = CLOSE_PROBABILITY[p.Status ?? ""] ?? 0;
        return s + (p["Total Value"] ?? 0) * prob;
      }, 0);

    const winRate = (() => {
      const closed = projects.filter((p) => p.Status === "Done" || p.Status === "Cancelled").length;
      if (closed === 0) return null;
      return Math.round((doneProjects / closed) * 100);
    })();

    // Avg time-to-paid (YTD)
    const paidYtd = invoices.filter(
      (i) =>
        i.Status === "Paid" &&
        i["Issue Date"] &&
        i["Paid Date"] &&
        parseISO(i["Paid Date"]) >= ytdStart
    );
    const avgTimeToPaid = paidYtd.length === 0
      ? null
      : Math.round(
          paidYtd.reduce(
            (s, i) => s + differenceInDays(parseISO(i["Paid Date"]!), parseISO(i["Issue Date"]!)),
            0
          ) / paidYtd.length
        );

    // Owner split YTD (by paid invoices linked to a project's Owner)
    const projectOwner = new Map<string, string>();
    for (const p of projects) {
      if (p.Owner) projectOwner.set(p.id, p.Owner);
    }
    const ownerTotals = new Map<string, number>();
    for (const inv of paidYtd) {
      const projectId = inv.Project?.[0];
      const owner = projectId ? projectOwner.get(projectId) : undefined;
      if (!owner) continue;
      ownerTotals.set(owner, (ownerTotals.get(owner) ?? 0) + (inv.Amount ?? 0));
    }
    const ownerSplit = Array.from(ownerTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      activeClients,
      activeProjects,
      leads,
      doneProjects,
      overdueCount,
      overdueAmount,
      pipelineValue,
      weightedPipeline,
      winRate,
      avgTimeToPaid,
      ownerSplit,
    };
  }, [clients, projects, invoices]);

  const ttpColor =
    stats.avgTimeToPaid === null
      ? "#52525b"
      : stats.avgTimeToPaid <= 14
      ? "#bfff3a"
      : stats.avgTimeToPaid <= 30
      ? "#fbbf24"
      : "#ff4d8b";

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <p className="text-sm font-semibold text-white">At a glance</p>

      {/* Counts */}
      <div className="flex flex-col gap-2">
        {[
          { label: "Clients", value: String(stats.activeClients), color: "#3affd1" },
          { label: "Active projects", value: String(stats.activeProjects), color: "#bfff3a" },
          { label: "Project leads", value: String(stats.leads), color: "#c44dff" },
          { label: "Completed", value: String(stats.doneProjects), color: "#4d9fff" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs text-zinc-400">{label}</span>
            </div>
            <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-[#2a2e34]" />

      {/* Pipeline + win rate */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Pipeline</span>
          <span className="text-sm font-semibold text-white tabular-nums">${stats.pipelineValue.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Weighted pipeline</span>
          <span className="text-sm font-semibold text-zinc-300 tabular-nums" title="Total Value × probability of close (Lead 20% · In Progress 60% · Review 85%)">
            ${Math.round(stats.weightedPipeline).toLocaleString()}
          </span>
        </div>
        {stats.winRate !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Win rate</span>
            <span className="text-sm font-semibold text-white tabular-nums">{stats.winRate}%</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Avg time to paid</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: ttpColor }}>
            {stats.avgTimeToPaid === null ? "—" : `${stats.avgTimeToPaid}d`}
          </span>
        </div>
      </div>

      {/* Owner split */}
      {stats.ownerSplit.length > 0 && (
        <>
          <div className="h-px bg-[#2a2e34]" />
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Owner split YTD</p>
            {stats.ownerSplit.map(([owner, amt]) => (
              <div key={owner} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{owner}</span>
                <span className="text-xs font-semibold text-white tabular-nums">${amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Overdue (clickable) */}
      <div className="h-px bg-[#2a2e34]" />
      <button
        onClick={onJumpToOverdue}
        disabled={stats.overdueCount === 0}
        className="flex items-center justify-between -m-2 p-2 rounded-lg hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {stats.overdueCount > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff4d8b] animate-pulse shrink-0" />
          )}
          <span className="text-xs text-zinc-400">Overdue invoices</span>
        </div>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: stats.overdueCount > 0 ? "#ff4d8b" : "#52525b" }}
        >
          {stats.overdueCount > 0
            ? `${stats.overdueCount} · $${stats.overdueAmount.toLocaleString()} →`
            : "—"}
        </span>
      </button>
    </div>
  );
}
