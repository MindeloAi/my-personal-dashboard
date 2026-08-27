# Page Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single anchor-scrolled `/dashboard` route with 11 top-level routes, one per sidebar entry, and restore the auth gate that commit `a5cebf7` removed.

**Architecture:** A single `(app)` route group holds every gated page. Its layout renders the sidebar, the header and Quick Actions once, so they persist across navigation. Each page is an async Server Component fetching only the tables it renders. The two interactions that currently cross section boundaries become URL search params on `/finance`, seeded into the existing client-side filter state. `src/proxy.ts` gates everything except `/login`, `/intake` and `/healthz`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, `postgres` (porsager) via `src/lib/db.ts`, Web Crypto for passcode hashing.

**Spec:** `docs/superpowers/specs/2026-08-27-page-split-design.md`

---

## Testing note — read before starting

**This repo has no test framework.** There is no vitest, jest, or playwright in `package.json`, and no test files exist. Do not invent one as part of this plan; adding a test harness is its own decision.

Verification for every task is therefore:

```bash
cd business-dashboard
npx tsc --noEmit      # must print nothing
npm run lint          # must print nothing after the banner
```

plus, where a task changes rendered output, an HTTP check against a running dev server. Where a task says "expected: X", that is a real assertion — if you see something else, stop and report rather than continuing.

Run every command from `business-dashboard/`, not the repo root.

## Key facts you need that are not obvious

- **`searchParams` is a Promise** in Next 16 and must be awaited. Same for `cookies()`.
- **The file is `proxy.ts`, not `middleware.ts`** — Next 16 renamed the convention. It exports a function named `proxy` plus a `config.matcher`, and lives at `src/proxy.ts`, beside `app/`.
- **"Overdue" is derived, not stored.** `src/lib/invoices.ts` computes it from `Status === "Sent"` plus a past due date. Never filter for it in SQL; the numbers would disagree with the UI.
- **`src/lib/airtable.ts` is a re-export shim** for `src/lib/db.ts` (the backend is Postgres now). New files import from `@/lib/db`. Do **not** rewrite the existing components' `@/lib/airtable` type imports — that is deliberately deferred.
- **`dashboard-shell.tsx` is the source of truth** for what each page must render and with which props. Read it before starting; it is deleted in Task 13.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | Passcode hashing + cookie name. Shared by proxy and login action. |
| `src/proxy.ts` | Gate: no valid cookie → redirect to `/login`. |
| `src/app/login/page.tsx` | Passcode form + server action that sets the cookie. |
| `src/app/(app)/layout.tsx` | Sidebar, header, Quick Actions. Fetches clients + projects. |
| `src/app/(app)/<area>/page.tsx` | One per area. Fetches only its own tables. |
| `src/app/(app)/finance/finance-view.tsx` | Client component owning the three filter states. |
| `src/components/dashboard/sidebar.tsx` | Rewritten: `Link` + `usePathname`, no scroll logic. |
| `src/app/page.tsx`, `src/app/dashboard/page.tsx` | Redirects to `/overview`. |

**Deleted in Task 13:** `src/app/(dashboard)/` (whole group) and `src/components/dashboard/dashboard-shell.tsx`.

---

### Task 1: Auth helper

**Files:**
- Create: `business-dashboard/src/lib/auth.ts`

- [ ] **Step 1: Create the helper**

Web Crypto is used rather than `node:crypto` because `proxy.ts` runs on the Edge runtime, where `node:crypto` is unavailable.

```ts
// src/lib/auth.ts
export const AUTH_COOKIE = "dashboard_auth";

/**
 * SHA-256 of `mindelo:<passcode>`, hex encoded. Web Crypto so this works in
 * both the Edge runtime (proxy.ts) and the Node runtime (the login action).
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`mindelo:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/lib/auth.ts
git commit -m "feat(auth): add passcode hashing helper"
```

---

### Task 2: The proxy gate

**Files:**
- Create: `business-dashboard/src/proxy.ts`

- [ ] **Step 1: Create the proxy**

```ts
// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, hashPasscode } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const passcode = process.env.DASHBOARD_PASSCODE;

  // With no passcode configured the gate cannot be satisfied. Send the user to
  // /login, which explains that rather than silently rejecting every attempt.
  if (!passcode) {
    return NextResponse.redirect(new URL("/login?reason=unconfigured", request.url));
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await hashPasscode(passcode))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except: the login page itself, the public lead form, the health
  // check, Next's internals, and files with an extension (favicon, images).
  matcher: ["/((?!login|intake|healthz|_next/static|_next/image|.*\\..*).*)"],
};
```

- [ ] **Step 2: Verify it typechecks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output from either.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/proxy.ts
git commit -m "feat(auth): gate all routes behind the passcode proxy"
```

---

### Task 3: The login page

**Files:**
- Create: `business-dashboard/src/app/login/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/login/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, hashPasscode } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const passcode = process.env.DASHBOARD_PASSCODE;
  if (!passcode) redirect("/login?reason=unconfigured");

  const entered = String(formData.get("passcode") ?? "");
  if (entered !== passcode) redirect("/login?reason=invalid");

  const store = await cookies();
  store.set(AUTH_COOKIE, await hashPasscode(passcode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/overview");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white flex items-center justify-center p-6">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[#f5f5f5]">MindeloAI Dashboard</p>
          <p className="text-xs text-zinc-500">Enter the shared passcode to continue.</p>
        </div>

        {reason === "invalid" && (
          <p className="text-xs text-[#ff4d8b]">That passcode is not correct.</p>
        )}
        {reason === "unconfigured" && (
          <p className="text-xs text-[#fbbf24]">
            DASHBOARD_PASSCODE is not set on this deployment, so login is impossible.
            Set it in the environment and redeploy.
          </p>
        )}

        <input
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-lg bg-[#0b0d10] border border-[#2a2e34] px-3 py-2 text-sm outline-none focus:border-[#bfff3a]/40"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-[#bfff3a] text-black text-sm font-semibold px-3 py-2 hover:bg-[#bfff3a]/90 transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/app/login/page.tsx
git commit -m "feat(auth): add the login page"
```

---

### Task 4: Rewrite the sidebar to navigate

**Files:**
- Modify: `business-dashboard/src/components/dashboard/sidebar.tsx` (replace entirely)

- [ ] **Step 1: Replace the file**

The current version holds `active` in React state and calls `scrollIntoView`. Both go away. Keep the markup and Tailwind classes identical so nothing shifts visually.

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output. (The old `/dashboard` page still renders; the sidebar links 404 until Task 5+ — that is expected at this point.)

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/components/dashboard/sidebar.tsx
git commit -m "refactor(nav): sidebar navigates by route instead of scrolling"
```

---

### Task 5: The `(app)` group layout

**Files:**
- Create: `business-dashboard/src/app/(app)/layout.tsx`

- [ ] **Step 1: Create the layout**

The header markup and the outer wrapper classes are lifted verbatim from `dashboard-shell.tsx` so spacing is unchanged.

```tsx
// src/app/(app)/layout.tsx
import { format } from "date-fns";
import { Sidebar } from "@/components/dashboard/sidebar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getClients, getProjects } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Quick Actions' create-invoice / create-project modals need these lists on
  // every page. Two queries per page rather than the eight the single-page
  // dashboard used to run.
  const [clients, projects] = await Promise.all([getClients(), getProjects()]);
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <Sidebar>
        <div className="p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
            <div>
              <p className="text-xl font-bold text-[#f5f5f5]">MindeloAI Dashboard</p>
              <p className="text-xs text-zinc-500 mt-0.5">{today}</p>
            </div>
            <QuickActions clients={clients} projects={projects} />
          </div>
          {children}
        </div>
      </Sidebar>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "business-dashboard/src/app/(app)/layout.tsx"
git commit -m "feat(nav): add the shared app layout"
```

---

### Task 6: Overview page

**Files:**
- Create: `business-dashboard/src/app/(app)/overview/page.tsx`
- Create: `business-dashboard/src/app/(app)/overview/overview-view.tsx`

- [ ] **Step 1: Create the client view**

`BusinessCounters` keeps its existing `onJumpToOverdue?: () => void` prop — **do not modify that component.** A thin client wrapper turns the callback into navigation, which keeps its disabled state and button semantics intact.

```tsx
// src/app/(app)/overview/overview-view.tsx
"use client";

import { useRouter } from "next/navigation";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { MrrCard } from "@/components/dashboard/mrr-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { BusinessCounters } from "@/components/dashboard/business-counters";
import { ServiceTypeSplit } from "@/components/dashboard/service-type-split";
import type { Client, Project, Invoice, Expense } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
};

export function OverviewView({ clients, projects, invoices, expenses }: Props) {
  const router = useRouter();

  return (
    <>
      <HeroCards invoices={invoices} expenses={expenses} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RevenueChart invoices={invoices} expenses={expenses} />
        <BusinessCounters
          clients={clients}
          projects={projects}
          invoices={invoices}
          onJumpToOverdue={() => router.push("/finance?status=Overdue")}
        />
        <div className="grid grid-cols-1 gap-3">
          <MrrCard projects={projects} invoices={invoices} />
          <ServiceTypeSplit projects={projects} invoices={invoices} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/(app)/overview/page.tsx
import { getClients, getProjects, getInvoices, getExpenses } from "@/lib/db";
import { OverviewView } from "./overview-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverviewPage() {
  const [clients, projects, invoices, expenses] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
  ]);

  return (
    <OverviewView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
    />
  );
}
```

- [ ] **Step 3: Verify it renders**

```bash
npm run dev -- --port 5599 &
sleep 12
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5599/login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5599/overview
```

Expected: `/login` → `200`. `/overview` → `307` (redirected by the proxy, because you have no cookie yet). That redirect **is** the auth gate working.

- [ ] **Step 4: Commit**

```bash
git add "business-dashboard/src/app/(app)/overview"
git commit -m "feat(nav): add the overview page"
```

---

### Task 7: Finance page

**Files:**
- Create: `business-dashboard/src/app/(app)/finance/page.tsx`
- Create: `business-dashboard/src/app/(app)/finance/finance-view.tsx`

- [ ] **Step 1: Create the client view**

This holds exactly the three state values `dashboard-shell.tsx` holds today, seeded from the URL.

```tsx
// src/app/(app)/finance/finance-view.tsx
"use client";

import { useState } from "react";
import { InvoicesTable, type InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { Cashflow } from "@/components/dashboard/cashflow";
import { ExpensesBreakdown } from "@/components/dashboard/expenses-breakdown";
import { ExpensesList } from "@/components/dashboard/expenses-list";
import type { Client, Project, Invoice, Expense } from "@/lib/db";

type Props = {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  initialStatus: InvoiceStatusFilter;
  initialClientId: string | null;
};

export function FinanceView({
  clients,
  projects,
  invoices,
  expenses,
  initialStatus,
  initialClientId,
}: Props) {
  const [expenseCategory, setExpenseCategory] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>(initialStatus);
  const [invoiceClient, setInvoiceClient] = useState<string | null>(initialClientId);

  const selectedClient = invoiceClient ? clients.find((c) => c.id === invoiceClient) : null;
  const selectedClientName = selectedClient?.Company || selectedClient?.Name || null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <InvoicesTable
            invoices={invoices}
            projects={projects}
            statusFilter={invoiceStatus}
            onStatusFilterChange={setInvoiceStatus}
            clientFilter={invoiceClient}
            onClearClientFilter={() => setInvoiceClient(null)}
            clientName={selectedClientName}
          />
        </div>
        <Cashflow invoices={invoices} projects={projects} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ExpensesBreakdown
          expenses={expenses}
          selectedCategory={expenseCategory}
          onSelectCategory={setExpenseCategory}
        />
        <div className="lg:col-span-2">
          <ExpensesList
            expenses={expenses}
            categoryFilter={expenseCategory}
            onClearCategoryFilter={() => setExpenseCategory(null)}
          />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create the page**

`InvoiceStatusFilter` is a union exported by `invoices-table.tsx`. Validate the URL value against the known set rather than casting, so a hand-typed `?status=nonsense` falls back to `All` instead of putting the table into an impossible state.

```tsx
// src/app/(app)/finance/page.tsx
import { getClients, getProjects, getInvoices, getExpenses } from "@/lib/db";
import type { InvoiceStatusFilter } from "@/components/dashboard/invoices-table";
import { FinanceView } from "./finance-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Verified against invoices-table.tsx:11 — this union has no "Void" member,
// even though the Invoice schema has a Void status.
const STATUSES: InvoiceStatusFilter[] = ["All", "Sent", "Overdue", "Paid", "Draft"];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string }>;
}) {
  const { status, client } = await searchParams;

  const [clients, projects, invoices, expenses] = await Promise.all([
    getClients(),
    getProjects(),
    getInvoices(),
    getExpenses(),
  ]);

  const initialStatus = STATUSES.includes(status as InvoiceStatusFilter)
    ? (status as InvoiceStatusFilter)
    : "All";

  return (
    <FinanceView
      clients={clients}
      projects={projects}
      invoices={invoices}
      expenses={expenses}
      initialStatus={initialStatus}
      initialClientId={client ?? null}
    />
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "business-dashboard/src/app/(app)/finance"
git commit -m "feat(nav): add the finance page with URL-driven filters"
```

---

### Task 8: Projects and Clients pages

**Files:**
- Create: `business-dashboard/src/app/(app)/projects/page.tsx`
- Create: `business-dashboard/src/app/(app)/clients/page.tsx`
- Create: `business-dashboard/src/app/(app)/clients/clients-view.tsx`

- [ ] **Step 1: Projects page**

`ProjectBoard` is already a client component and needs no wrapper.

```tsx
// src/app/(app)/projects/page.tsx
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([getProjects(), getClients()]);
  return <ProjectBoard projects={projects} clients={clients} />;
}
```

- [ ] **Step 2: Clients view**

`TopClients` keeps its `selectedClientId` / `onSelectClient` props unchanged. Selecting now navigates to Finance instead of filtering in place, so `selectedClientId` is always `null` here.

```tsx
// src/app/(app)/clients/clients-view.tsx
"use client";

import { useRouter } from "next/navigation";
import { TopClients } from "@/components/dashboard/top-clients";
import type { Client, Invoice, Project } from "@/lib/db";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsView({ clients, invoices, projects }: Props) {
  const router = useRouter();

  return (
    <TopClients
      clients={clients}
      invoices={invoices}
      projects={projects}
      selectedClientId={null}
      onSelectClient={(clientId) => {
        if (clientId) router.push(`/finance?client=${encodeURIComponent(clientId)}`);
      }}
    />
  );
}
```

- [ ] **Step 3: Clients page**

```tsx
// src/app/(app)/clients/page.tsx
import { getClients, getInvoices, getProjects } from "@/lib/db";
import { ClientsView } from "./clients-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientsPage() {
  const [clients, invoices, projects] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
  ]);
  return <ClientsView clients={clients} invoices={invoices} projects={projects} />;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "business-dashboard/src/app/(app)/projects" "business-dashboard/src/app/(app)/clients"
git commit -m "feat(nav): add the projects and clients pages"
```

---

### Task 9: Leads, Tasks and Ideas pages

**Files:**
- Create: `business-dashboard/src/app/(app)/leads/page.tsx`
- Create: `business-dashboard/src/app/(app)/tasks/page.tsx`
- Create: `business-dashboard/src/app/(app)/ideas/page.tsx`

Each keeps the `Section` wrapper with the same `title`/`description` strings the single page used, so the headings are unchanged.

- [ ] **Step 1: Leads page** (one table — down from eight)

```tsx
// src/app/(app)/leads/page.tsx
import { Section } from "@/components/dashboard/section";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  const leads = await getLeads();
  return (
    <Section title="Leads" description="Inbound and tracked sales pipeline.">
      <LeadsTable leads={leads} />
    </Section>
  );
}
```

- [ ] **Step 2: Tasks page**

```tsx
// src/app/(app)/tasks/page.tsx
import { Section } from "@/components/dashboard/section";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { getTasks, getProjects } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
  return (
    <Section title="Tasks" description="Work queue shared with the Claude-Code bridge.">
      <TasksPanel tasks={tasks} projects={projects} />
    </Section>
  );
}
```

- [ ] **Step 3: Ideas page**

```tsx
// src/app/(app)/ideas/page.tsx
import { Section } from "@/components/dashboard/section";
import { IdeasPanel } from "@/components/dashboard/ideas-panel";
import { getIdeas } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IdeasPage() {
  const ideas = await getIdeas();
  return (
    <Section title="Ideas" description="Business ideas backlog.">
      <IdeasPanel ideas={ideas} />
    </Section>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "business-dashboard/src/app/(app)/leads" "business-dashboard/src/app/(app)/tasks" "business-dashboard/src/app/(app)/ideas"
git commit -m "feat(nav): add the leads, tasks and ideas pages"
```

---

### Task 10: Dev and Automation pages

**Files:**
- Create: `business-dashboard/src/app/(app)/dev/page.tsx`
- Create: `business-dashboard/src/app/(app)/automation/page.tsx`

- [ ] **Step 1: Dev page**

`DevHub` is an async Server Component that fetches its own data. On its own route it is rendered directly — the `devHub` React-node prop workaround in `dashboard-shell.tsx` is no longer needed. Keep the `Suspense` fallback: it fetches GitHub over the network.

```tsx
// src/app/(app)/dev/page.tsx
import { Suspense } from "react";
import { Section } from "@/components/dashboard/section";
import { DevHub } from "@/components/dashboard/dev-hub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DevPage() {
  return (
    <Section title="Dev" description="Repos, live deploy links, and coding-task queue.">
      <Suspense
        fallback={
          <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 text-sm text-zinc-500">
            Loading repos…
          </div>
        }
      >
        <DevHub />
      </Suspense>
    </Section>
  );
}
```

- [ ] **Step 2: Automation page**

```tsx
// src/app/(app)/automation/page.tsx
import { Section } from "@/components/dashboard/section";
import { AutomationLauncher } from "@/components/dashboard/automation-launcher";
import { getProjects, getLeads } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AutomationPage() {
  const [projects, leads] = await Promise.all([getProjects(), getLeads()]);
  return (
    <Section title="Automation" description="One-click workflows and invoice generation.">
      <AutomationLauncher projects={projects} leads={leads} />
    </Section>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "business-dashboard/src/app/(app)/dev" "business-dashboard/src/app/(app)/automation"
git commit -m "feat(nav): add the dev and automation pages"
```

---

### Task 11: Vault page

**Files:**
- Create: `business-dashboard/src/app/(app)/vault/page.tsx`

- [ ] **Step 1: Create the page**

Vault data is a committed static JSON snapshot read synchronously — no database, no network. Markup lifted from `dashboard-shell.tsx`.

```tsx
// src/app/(app)/vault/page.tsx
import { format } from "date-fns";
import { Section } from "@/components/dashboard/section";
import { VaultProjects } from "@/components/dashboard/vault-projects";
import { VaultActivity } from "@/components/dashboard/vault-activity";
import { getVaultProjects, getVaultActivity, getVaultSyncedAt } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VaultPage() {
  const projects = getVaultProjects();
  const activity = getVaultActivity();
  const syncedAt = getVaultSyncedAt();

  return (
    <Section
      title="Vault"
      description="Visual index of the Obsidian vault — every project note, filterable."
      action={
        syncedAt ? (
          <span className="text-[10px] text-zinc-600">
            Synced {format(new Date(syncedAt), "MMM d, h:mm a")}
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <VaultProjects projects={projects} />
        {activity.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Recent activity
            </p>
            <VaultActivity activity={activity} />
          </div>
        )}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "business-dashboard/src/app/(app)/vault"
git commit -m "feat(nav): add the vault page"
```

---

### Task 12: Mindelo OPS placeholder

**Files:**
- Create: `business-dashboard/src/app/(app)/ops/page.tsx`

- [ ] **Step 1: Create the page**

Route only. No data, no canvas, no dependencies — the flow chart is a separate spec.

```tsx
// src/app/(app)/ops/page.tsx
import { Section } from "@/components/dashboard/section";

export default function OpsPage() {
  return (
    <Section
      title="Mindelo OPS"
      description="How we operate with a client, end to end."
    >
      <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 text-sm text-zinc-500">
        The operating-procedure flow chart lands here next.
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "business-dashboard/src/app/(app)/ops"
git commit -m "feat(nav): add the Mindelo OPS route"
```

---

### Task 13: Retire the old dashboard route

**Files:**
- Delete: `business-dashboard/src/app/(dashboard)/` (entire directory)
- Delete: `business-dashboard/src/components/dashboard/dashboard-shell.tsx`
- Modify: `business-dashboard/src/app/page.tsx`
- Create: `business-dashboard/src/app/dashboard/page.tsx`

The deletion and the redirect are one task because they touch the same route: `(dashboard)/dashboard/page.tsx` and `dashboard/page.tsx` both resolve to `/dashboard`, and Next fails the build with a duplicate-route error if both exist. Delete first, then add the redirect.

- [ ] **Step 1: Confirm nothing imports the shell**

Run: `grep -rn "dashboard-shell" business-dashboard/src/`

Expected: matches only inside `(dashboard)/dashboard/page.tsx` and the shell file itself. **If anything else imports it, stop and report.**

- [ ] **Step 2: Delete the old group and the shell**

```bash
rm -rf "business-dashboard/src/app/(dashboard)"
rm business-dashboard/src/components/dashboard/dashboard-shell.tsx
```

- [ ] **Step 3: Verify the deletion is clean**

Run: `npx tsc --noEmit`
Expected: no output. A missing-module error means a component still referenced the shell — restore with `git checkout` and report.

- [ ] **Step 4: Root redirect**

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/overview");
}
```

- [ ] **Step 5: Legacy `/dashboard` redirect**

```tsx
// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

/** The dashboard used to live entirely on this route. Keeps old bookmarks working. */
export default function LegacyDashboard() {
  redirect("/overview");
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: build succeeds; the route list shows `/overview`, `/finance`, … and no duplicate-route error for `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add -A business-dashboard/src/app business-dashboard/src/components
git commit -m "refactor(nav): retire the single-page dashboard, redirect to /overview"
```

---

### Task 14: Point revalidation at every page

**Files:**
- Modify: `business-dashboard/src/app/actions.ts` (24 call sites)

- [ ] **Step 1: Replace every call**

Marking an invoice paid changes figures on Overview, Finance *and* Clients, so per-page revalidation would leave stale numbers on the pages you were not looking at. `"layout"` revalidates everything under the root layout.

```bash
cd business-dashboard
sed -i 's|revalidatePath("/dashboard")|revalidatePath("/", "layout")|g' src/app/actions.ts
```

- [ ] **Step 2: Confirm none were missed**

Run: `grep -c 'revalidatePath("/", "layout")' src/app/actions.ts && grep -c '"/dashboard"' src/app/actions.ts`
Expected: `24` then `0`. (`grep -c` prints `0` and exits non-zero when there are no matches — a `0` on the second line is the pass condition.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add business-dashboard/src/app/actions.ts
git commit -m "fix(nav): revalidate all routes after every mutation"
```

---

### Task 15: End-to-end verification

**Files:** none — this task only runs checks.

- [ ] **Step 1: Capture the current production output for comparison**

Do this **before** deploying, while production still serves the single-page dashboard.

```bash
curl -s https://my-personal-dashboard-brown.vercel.app/dashboard -o /tmp/before.html
sed 's/<[^>]*>/\n/g' /tmp/before.html | grep -oE '\$[0-9,]+(\.[0-9]+)?' | sort | uniq -c | sort -rn > /tmp/before.nums
wc -l /tmp/before.nums
```

Expected: a non-empty count of distinct currency figures.

- [ ] **Step 2: Start the app and log in**

```bash
cd business-dashboard
npm run build && npm run start -- --port 5599 &
sleep 12
PASSCODE=$(grep '^DASHBOARD_PASSCODE=' .env.local | cut -d= -f2)
curl -s -c /tmp/jar.txt -X POST -d "passcode=$PASSCODE" http://localhost:5599/login -o /dev/null
```

- [ ] **Step 3: Check every route responds**

```bash
for r in overview finance projects clients leads tasks dev ideas automation vault ops; do
  printf "%-12s %s\n" "$r" "$(curl -s -b /tmp/jar.txt -o /dev/null -w '%{http_code}' http://localhost:5599/$r)"
done
```

Expected: `200` for all 11.

- [ ] **Step 4: Check the redirects and the gate**

```bash
curl -s -b /tmp/jar.txt -o /dev/null -w "dashboard: %{http_code} -> %{redirect_url}\n" http://localhost:5599/dashboard
curl -s -o /dev/null -w "no-cookie finance: %{http_code} -> %{redirect_url}\n" http://localhost:5599/finance
curl -s -o /dev/null -w "intake: %{http_code}\n" http://localhost:5599/intake
curl -s -o /dev/null -w "healthz: %{http_code}\n" http://localhost:5599/healthz
```

Expected: `/dashboard` → `307` to `/overview`; `/finance` without a cookie → `307` to `/login`; `/intake` → `200`; `/healthz` → `200`.

- [ ] **Step 5: Confirm no figure changed**

```bash
curl -s -b /tmp/jar.txt http://localhost:5599/overview -o /tmp/a.html
curl -s -b /tmp/jar.txt http://localhost:5599/finance  -o /tmp/b.html
cat /tmp/a.html /tmp/b.html | sed 's/<[^>]*>/\n/g' | grep -oE '\$[0-9,]+(\.[0-9]+)?' | sort | uniq -c | sort -rn > /tmp/after.nums
comm -23 <(awk '{print $2}' /tmp/before.nums | sort -u) <(awk '{print $2}' /tmp/after.nums | sort -u)
```

Expected: **no output.** Every currency figure that appeared on the old single page still appears across Overview + Finance. Any line printed is a figure that has gone missing — stop and investigate.

- [ ] **Step 6: Check the cross-page filters**

```bash
curl -s -b /tmp/jar.txt -o /dev/null -w "status filter: %{http_code}\n" "http://localhost:5599/finance?status=Overdue"
curl -s -b /tmp/jar.txt -o /dev/null -w "bad status:    %{http_code}\n" "http://localhost:5599/finance?status=nonsense"
```

Expected: both `200`. The second must not error — an unknown status falls back to `All`.

- [ ] **Step 7: Manual pass in a browser**

Open `http://localhost:5599`, then confirm by hand:

1. It lands on `/overview` and the sidebar highlights **Overview**.
2. Clicking each sidebar entry navigates and highlights the right item.
3. On Overview, clicking **Overdue invoices** lands on Finance with the status filter already set to Overdue.
4. On Clients, clicking a client lands on Finance filtered to that client, with their name shown in the filter chip.
5. On Finance, clicking an expense category filters the list below it.
6. Mark an invoice paid on Finance, then go to Overview — the hero cards reflect it.
7. Quick Actions appears in the header on every page and its modals list clients and projects.

- [ ] **Step 8: Stop the server**

```bash
netstat -ano | grep ':5599' | grep LISTENING | awk '{print $5}' | sort -u | while read pid; do taskkill //PID $pid //F; done
```

- [ ] **Step 9: Report before deploying**

Deployment is Taylor's decision, not part of this plan. Report: route status codes, the figure-comparison result, and anything from the manual pass that looked wrong.

---

## Notes for the implementer

- **Do not modify any component in `src/components/dashboard/`** except `sidebar.tsx` (Task 4). The pages adapt to the components, not the other way round. If a component seems to need changing, stop and report — it probably means a page is passing the wrong props.
- **Do not add `"use client"` to a page.** Pages are Server Components that fetch; the small `*-view.tsx` files are the client boundary.
- **Do not filter by derived status in SQL.** See the key-facts section.
- If `npm run dev` and `npm run start` fight over port 5599, pick another port; nothing depends on the number.
