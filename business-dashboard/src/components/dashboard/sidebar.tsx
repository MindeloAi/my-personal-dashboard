"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/dashboard/section";

/**
 * One entry per dashboard area. Selecting an entry toggles which section is
 * shown in-page — we deliberately stay on the single `/dashboard` route so the
 * existing `force-dynamic` parallel-fetch page and every `revalidatePath`
 * call keep working. Modules are mounted into these sections in a follow-up.
 */
const NAV = [
  { key: "overview", label: "Overview" },
  { key: "finance", label: "Finance" },
  { key: "projects", label: "Projects" },
  { key: "clients", label: "Clients" },
  { key: "leads", label: "Leads" },
  { key: "tasks", label: "Tasks" },
  { key: "dev", label: "Dev" },
  { key: "ideas", label: "Ideas" },
  { key: "automation", label: "Automation" },
] as const;

type SectionKey = (typeof NAV)[number]["key"];

/**
 * Areas whose modules already render today. The existing dashboard page bundles
 * Finance/Projects/Clients into one view, so it lives under "Overview"; the
 * dedicated per-area mounts (and splitting that view apart) happen in a
 * follow-up issue.
 */
const LIVE_SECTIONS: ReadonlySet<SectionKey> = new Set(["overview"]);

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<SectionKey>("overview");
  const activeEntry = NAV.find((n) => n.key === active) ?? NAV[0];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Nav rail — horizontal scroll on mobile, fixed left column on md+ */}
      <nav
        aria-label="Dashboard sections"
        className="shrink-0 border-b border-white/10 bg-[#0e1116] px-3 py-3 md:w-56 md:border-b-0 md:border-r md:px-3 md:py-5"
      >
        <p className="hidden px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:block">
          MindeloAI
        </p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
          {NAV.map((entry) => {
            const isActive = entry.key === active;
            return (
              <li key={entry.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(entry.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-[#f5f5f5]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                  )}
                >
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content area — one section visible at a time. */}
      <main className="min-w-0 flex-1">
        {/* Live areas render the existing dashboard (Finance/Projects/Clients). */}
        <div className={cn(LIVE_SECTIONS.has(active) ? "block" : "hidden")}>
          {children}
        </div>

        {/* Placeholder for areas whose modules mount in a follow-up issue. */}
        {!LIVE_SECTIONS.has(active) && (
          <div className="p-5">
            <Section
              title={activeEntry.label}
              description="This module mounts into the dashboard in an upcoming update."
            >
              <div className="rounded-xl border border-dashed border-white/10 bg-[#0e1116] p-10 text-center text-sm text-zinc-500">
                {activeEntry.label} section is ready and will be wired up next.
              </div>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}
