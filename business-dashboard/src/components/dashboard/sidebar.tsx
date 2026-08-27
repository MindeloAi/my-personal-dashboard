"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * One entry per dashboard area. Each is its own route; the group layout keeps
 * this rail mounted across navigations.
 */
const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/finance", label: "Finance" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/leads", label: "Leads" },
  { href: "/tasks", label: "Tasks" },
  { href: "/dev", label: "Dev" },
  { href: "/ideas", label: "Ideas" },
  { href: "/automation", label: "Automation" },
  { href: "/vault", label: "Vault" },
  { href: "/ops", label: "Mindelo OPS" },
] as const;

export function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav
        aria-label="Dashboard sections"
        className="shrink-0 border-b border-white/10 bg-[#0e1116] px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-3 md:py-5"
      >
        <p className="hidden px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:block">
          MindeloAI
        </p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
          {NAV.map((entry) => {
            const isActive = pathname === entry.href;
            return (
              <li key={entry.href} className="shrink-0">
                <Link
                  href={entry.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-[#f5f5f5]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
