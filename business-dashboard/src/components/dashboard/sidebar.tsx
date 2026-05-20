"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One entry per dashboard area. Every module renders on the single
 * `/dashboard` route (so the `force-dynamic` parallel-fetch page and every
 * `revalidatePath` call keep working); selecting an entry smooth-scrolls to
 * that section's anchor. `overview` scrolls back to the top of the page.
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

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<SectionKey>("overview");

  function go(key: SectionKey) {
    setActive(key);
    if (key === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Nav rail — horizontal scroll on mobile, sticky left column on md+ */}
      <nav
        aria-label="Dashboard sections"
        className="shrink-0 border-b border-white/10 bg-[#0e1116] px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-3 md:py-5"
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
                  onClick={() => go(entry.key)}
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

      {/* Content area — every module renders here; nav scrolls to anchors. */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
