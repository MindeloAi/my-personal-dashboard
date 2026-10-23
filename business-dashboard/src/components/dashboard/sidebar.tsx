"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions";

/**
 * One entry per dashboard area. Each is its own route; the group layout keeps
 * this rail mounted across navigations.
 */
const NAV = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/leads", label: "Leads" },
] as const;

// A sub-path such as /admin/clients/<id> keeps its parent entry active.
function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({ pathname, onNavigate, large }: { pathname: string; onNavigate?: () => void; large?: boolean }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((entry) => {
        const isActive = isActivePath(pathname, entry.href);
        return (
          <li key={entry.href}>
            <Link
              href={entry.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center rounded-lg px-3 text-left font-medium transition-colors",
                large ? "min-h-12 text-base" : "py-2 text-sm",
                isActive ? "bg-white/10 text-[#f5f5f5]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
              )}
            >
              {entry.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Signed-in account and sign out. A plain form posting to a server action, so it works without JavaScript. */
function Account({ adminEmail, large }: { adminEmail?: string; large?: boolean }) {
  return (
    <div className="border-t border-white/10 pt-3">
      {adminEmail && (
        <p className="truncate px-3 pb-1.5 text-[10px] text-zinc-600" title={adminEmail}>
          {adminEmail}
        </p>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className={cn(
            "flex w-full items-center whitespace-nowrap rounded-lg px-3 text-left font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300",
            large ? "min-h-12 text-base" : "py-2 text-sm",
          )}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  /** Signed-in admin, shown above the sign-out control. */
  adminEmail?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = NAV.find((n) => isActivePath(pathname, n.href))?.label ?? "Dashboard";

  // While the menu is open: Escape closes it, the page behind cannot scroll,
  // and focus moves into the menu (and back to the hamburger on close).
  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Phone: app bar with a hamburger. Padded under the notch, since the
          installed app draws beneath a translucent status bar. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0e1116]/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="dashboard-menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/5 active:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <p className="text-base font-semibold text-[#f5f5f5]">{current}</p>
        </div>
      </header>

      {/* Phone: slide-in menu. Always mounted so it can animate; inert while closed. */}
      <div
        className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn("absolute inset-0 bg-black/60 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        />
        <nav
          id="dashboard-menu"
          aria-label="Dashboard sections"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-white/10 bg-[#0e1116] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 items-center justify-between pl-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Mindelo</p>
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} large />
          </div>
          <Account adminEmail={adminEmail} large />
        </nav>
      </div>

      {/* Desktop: fixed rail. */}
      <nav
        aria-label="Dashboard sections"
        className="relative hidden shrink-0 border-r border-white/10 bg-[#0e1116] px-3 py-5 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col"
      >
        <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Mindelo</p>
        <div className="flex-1">
          <NavLinks pathname={pathname} />
        </div>
        <Account adminEmail={adminEmail} />
      </nav>

      <main className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</main>
    </div>
  );
}
