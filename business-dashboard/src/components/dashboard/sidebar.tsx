"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Every section is its own route, so links, browser back and AI agents each
 * address one section. Groups open and close; the group layout keeps this rail
 * mounted across navigations.
 */
const NAV: (NavItem | NavGroup)[] = [
  { href: "/admin/overview", label: "Overview" },
  {
    label: "Finance",
    items: [
      { href: "/admin/finance/received", label: "Money received" },
      { href: "/admin/finance/invoices", label: "Invoices" },
      { href: "/admin/finance/founder-pay", label: "Founder pay" },
      { href: "/admin/finance/cash", label: "Cash & safe" },
      { href: "/admin/finance/expenses", label: "Expenses" },
      { href: "/admin/finance/recurring", label: "Recurring" },
      { href: "/admin/finance/export", label: "Export" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads" },
      { href: "/admin/clients", label: "Clients" },
    ],
  },
  {
    label: "Projects",
    items: [
      { href: "/admin/projects", label: "All projects" },
      { href: "/admin/projects/internal", label: "Internal" },
    ],
  },
];

const ITEMS = NAV.flatMap((n) => ("items" in n ? n.items : [n]));

// The longest matching href wins, so /admin/clients/<id> keeps Clients active
// and /admin/projects/internal lights Internal, not All projects.
function activeItem(pathname: string) {
  return ITEMS.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

// Open/closed per group is remembered on this device. Storage can throw
// (private mode, blocked site data); the menu still works without it.
const GROUPS_KEY = "mindelo.nav.groups";
function readGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveGroup(label: string, open: boolean) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...readGroups(), [label]: open }));
  } catch {}
}

function NavLink({ item, active, onNavigate, large, nested }: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  large?: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center rounded-lg px-3 text-left font-medium transition-colors",
        large ? "min-h-12 text-base" : "py-2 text-sm",
        nested && "pl-6",
        active ? "bg-white/10 text-[#f5f5f5]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      {item.label}
    </Link>
  );
}

function NavLinks({ pathname, onNavigate, large }: { pathname: string; onNavigate?: () => void; large?: boolean }) {
  const active = activeItem(pathname);
  // Frozen at mount: if React re-diffed `open` on navigation, leaving a group
  // would remove the attribute, collapse it and save "closed" over the choice.
  const [firstActive] = useState(active);
  const list = useRef<HTMLUListElement>(null);

  // Native <details> does the opening and closing. After mount, restore what
  // this device last chose, except the group holding the current page, which
  // always starts open.
  useEffect(() => {
    const saved = readGroups();
    list.current?.querySelectorAll<HTMLDetailsElement>("details[data-group]").forEach((el) => {
      const label = el.dataset.group!;
      if (!el.dataset.current && label in saved) el.open = saved[label];
    });
  }, []);

  // Arriving in a group through an in-page link opens it. Never closes one.
  useEffect(() => {
    const group = NAV.find((n) => "items" in n && n.items.includes(active!));
    if (!group) return;
    const el = list.current?.querySelector<HTMLDetailsElement>(`details[data-group="${group.label}"]`);
    if (el) el.open = true;
  }, [active]);

  return (
    <ul ref={list} className="flex flex-col gap-0.5">
      {NAV.map((entry) => {
        if (!("items" in entry)) {
          return (
            <li key={entry.href}>
              <NavLink item={entry} active={entry === active} onNavigate={onNavigate} large={large} />
            </li>
          );
        }
        const holdsCurrent = entry.items.includes(firstActive!);
        return (
          <li key={entry.label}>
            <details
              data-group={entry.label}
              data-current={holdsCurrent ? "" : undefined}
              open={holdsCurrent || undefined}
              onToggle={(e) => saveGroup(entry.label, e.currentTarget.open)}
              className="group"
            >
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center justify-between rounded-lg px-3 font-medium text-zinc-300 transition-colors hover:bg-white/5 [&::-webkit-details-marker]:hidden",
                  large ? "min-h-12 text-base" : "py-2 text-sm",
                )}
              >
                {entry.label}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-zinc-500 transition-transform group-open:rotate-180">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {entry.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={item === active} onNavigate={onNavigate} large={large} nested />
                  </li>
                ))}
              </ul>
            </details>
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
  const current = activeItem(pathname)?.label ?? "Dashboard";

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
        <div className="flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <Account adminEmail={adminEmail} />
      </nav>

      <main className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</main>
    </div>
  );
}
