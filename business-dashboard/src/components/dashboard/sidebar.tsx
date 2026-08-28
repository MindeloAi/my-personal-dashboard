"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions";

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
] as const;

export function Sidebar({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  /** Signed-in admin, shown above the sign-out control. */
  adminEmail?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav
        aria-label="Dashboard sections"
        className="relative shrink-0 border-b border-white/10 bg-[#0e1116] px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-3 md:py-5"
      >
        <p className="hidden px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:block">
          Mindelo
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

        {/* Signed-in account and sign out. A plain form posting to a server
            action, so it works without client-side JavaScript. */}
        <div className="mt-3 border-t border-white/10 pt-3 md:mt-auto md:absolute md:bottom-5 md:w-[12.5rem]">
          {adminEmail && (
            <p className="truncate px-3 pb-1.5 text-[10px] text-zinc-600" title={adminEmail}>
              {adminEmail}
            </p>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
