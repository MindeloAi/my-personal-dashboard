# Page split: one route per feature

> Design doc. Written 2026-08-27. Covers the routing restructure and the
> restoration of the auth gate. The Mindelo OPS flow chart gets its own spec;
> this delivers only the `/ops` route.

## Context

`my-personal-dashboard` (Next.js 16, app in `business-dashboard/`, Vercel)
renders every feature on a single `/dashboard` route. The sidebar does not
navigate — it smooth-scrolls to anchors, and a ~180-line client component
(`dashboard-shell.tsx`) holds all cross-section state.

That shape was forced by the old backend: Airtable's REST API paginates at 100
records/page and rate-limits at 5 req/s, so "fetch only what this page needs"
was impractical and one route fetched all 8 tables on every load. The
[Airtable → Supabase migration](2026-08-26-airtable-to-supabase-migration-design.md)
shipped on 2026-08-26 and removed that constraint, which is why this work is
possible now.

Two things came out of exploring the code that this spec has to deal with:

- **There is no auth.** Commit `a5cebf7` removed the passcode gate; there is no
  `proxy.ts`/`middleware.ts` and nothing reads `DASHBOARD_PASSCODE` or the
  `dashboard_auth` cookie, though the env var is still set on Vercel. An
  unauthenticated request to the production URL returns full client names,
  invoice amounts, revenue figures and lead contact details. Adding ten more
  routes to a publicly readable financial dashboard is not acceptable, so the
  gate is restored here.
- **"Overdue" is derived, not stored.** `lib/invoices.ts` computes it at render
  time from `Status === "Sent"` plus a past due date. It therefore cannot be a
  SQL `WHERE`, which constrains how the cross-page status filter works.

## Goals

- One route per sidebar entry; the sidebar navigates instead of scrolling.
- Each page fetches only the data it renders.
- No figure on screen changes. Same components, same numbers.
- The auth gate is restored before the new routes exist.

## Non-goals

- The Mindelo OPS flow chart. `/ops` ships as a real route rendering a page
  title and a one-line note that the operating-procedure chart is coming — no
  data, no canvas, no dependencies. The editable drag-and-drop canvas is a
  separate spec.
- **Rewriting the `@/lib/airtable` import specifiers.** New page files import
  from `@/lib/db` directly; the 21 existing components keep their `import type
  { … } from "@/lib/airtable"` lines untouched, so the shim stays and this diff
  stays focused on routing. The full rewrite belongs to Pass 2.
- Pass 2 of the migration (Milestones CRUD, missing deletes, unplugging
  Airtable). Unrelated to routing.
- Any redesign. This moves components between routes; it does not restyle them.

## Decisions

| Decision | Choice |
|---|---|
| URL shape | Top-level (`/finance`), not nested (`/dashboard/finance`) |
| Old URL | `/dashboard` redirects to `/overview` so existing bookmarks work |
| Cross-page filters | URL search params, seeding client-side filter state |
| Auth | Restored in this spec, as `src/proxy.ts` |
| Revalidation | `revalidatePath("/", "layout")` — every page, every mutation |
| Shared data | Layout fetches clients + projects for Quick Actions |
| OPS | Route only; flow chart is its own project |

## Route structure

```
src/
  proxy.ts                    auth gate (new)
  app/
    (app)/
      layout.tsx              sidebar + header + QuickActions
      overview/page.tsx       hero cards, revenue chart, counters, MRR, service mix
      finance/page.tsx        invoices, cashflow, expenses breakdown + list
      projects/page.tsx       project board
      clients/page.tsx        top clients
      leads/page.tsx          leads table
      tasks/page.tsx          tasks panel
      dev/page.tsx            dev hub
      ideas/page.tsx          ideas panel
      automation/page.tsx     automation launcher
      vault/page.tsx          vault projects + activity
      ops/page.tsx            Mindelo OPS — route only
    page.tsx                  redirect -> /overview
    dashboard/page.tsx        redirect -> /overview
    login/page.tsx            (new)
    intake/page.tsx           public, unchanged
    healthz/route.ts          public, unchanged
```

The existing `(dashboard)` route group is replaced by `(app)`. The sidebar and
header live in the group layout so they render once and persist across
navigation rather than remounting per page.

### `dashboard-shell.tsx` is deleted

It exists only to hold cross-section state on one large page. Once each area is
its own route it has no job: the header moves to the layout, and each page
renders its components directly.

One workaround disappears with it. `DevHub` is an async Server Component that
cannot be imported into a client tree, so `dashboard/page.tsx` currently renders
it and passes it down as a `devHub` React-node prop (see the comment at
`dashboard-shell.tsx:38-40`). On its own `/dev` route it is rendered directly.

## Data fetching

| Route | Tables |
|---|---|
| layout (shared) | clients, projects — Quick Actions' create modals |
| `/overview` | invoices, expenses, clients, projects |
| `/finance` | invoices, projects, expenses |
| `/projects` | projects, clients |
| `/clients` | clients, invoices, projects |
| `/leads` | leads |
| `/tasks` | tasks, projects |
| `/dev` | projects (+ GitHub, already cached via `unstable_cache`) |
| `/ideas` | ideas |
| `/automation` | projects, leads |
| `/vault` | none — committed static JSON |
| `/ops` | none |

Today every page load costs 8 round trips. `/leads` and `/ideas` drop to one;
`/vault` and `/ops` to zero.

Quick Actions needs client and project lists for its create-invoice and
create-project modals, so those two queries are paid on every page. That is a
deliberate trade: 2 queries instead of 8, in exchange for keeping Quick Actions
available everywhere as it is today.

Pages keep `export const dynamic = "force-dynamic"` and `revalidate = 0`, as the
current dashboard page does — this data is live and must never be snapshotted at
build time.

## Cross-page filters

Three interactions currently cross what become page boundaries. One does not
move: expenses breakdown → expenses list, since both land on `/finance`.

The other two become links:

- `BusinessCounters`' overdue counter → `Link` to `/finance?status=Overdue`
  (replacing the `onJumpToOverdue` callback and its `scrollIntoView`)
- `TopClients` rows → `Link` to `/finance?client=<id>` (replacing
  `onSelectClient`)

`/finance` awaits `searchParams` — **a Promise in Next 16, confirmed against
`node_modules/next/dist/docs`** — and seeds a `FinanceView` client component
that owns exactly the three state values `dashboard-shell` holds today:
`expenseCategory`, `invoiceStatus`, `invoiceClient`.

Filtering stays client-side. This is not laziness: `effectiveStatus`/`isOverdue`
derive "Overdue" at render time, so a server-side `WHERE status = 'Overdue'`
would silently return a different set of invoices than the UI shows. Seeding the
existing filter state preserves current behaviour exactly.

`/clients` gets simpler — its click navigates instead of setting local state.

## Revalidation

All 24 `revalidatePath("/dashboard")` calls in `app/actions.ts` become
`revalidatePath("/", "layout")`.

Per-page invalidation would be wrong: marking an invoice paid changes figures on
Overview, Finance *and* Clients, so revalidating only the current page leaves
stale numbers on the others. With 92 records, revalidating everything costs
nothing measurable.

This also keeps the five `useOptimistic` components correct. They rely on the
post-mutation server render replacing optimistic state; that render has to
include whichever page the user is actually on.

## Auth

`src/proxy.ts` (Next 16 renamed `middleware` → `proxy`; the file sits beside
`app/`, exports a `proxy` function and a `config.matcher`).

- Reads the `dashboard_auth` cookie, which stores a SHA-256 of
  `mindelo:<DASHBOARD_PASSCODE>`.
- Missing or mismatched → redirect to `/login`.
- `/login` posts the passcode to a server action that sets the cookie.
- Matcher excludes `/login`, `/intake`, `/healthz`, `/_next/*` and static files.

`/intake` must stay public — it is the lead-capture form used by prospects.

If `DASHBOARD_PASSCODE` is unset the gate cannot be satisfied, so `/login` shows
an explicit "passcode not configured" message rather than silently rejecting
every attempt.

## Risks

| Risk | Handling |
|---|---|
| Sidebar active state moves from React state to `usePathname()` | Must resolve `/dashboard` → `/overview` without flashing the wrong entry; the redirect is server-side so the client only ever sees the final path |
| A page fetches less data than a component needs | Caught by TypeScript — every component's props are typed |
| Locking yourself out | `DASHBOARD_PASSCODE` is already set in Vercel; verify login works in dev before deploying |
| Quick Actions in the layout adds 2 queries per page | Accepted; still a 4× reduction from today |
| Losing a cross-section shortcut | Both surviving interactions are explicitly re-implemented as links and verified |

## Verification

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
2. All 11 routes render; `/` and `/dashboard` redirect to `/overview`.
3. Rendered output of `/overview` + `/finance` contains the same figures as the
   current single-page `/dashboard` — compared by extracting currency tokens
   from the HTML, the same method used to verify the Supabase migration.
4. `/finance?status=Overdue` and `/finance?client=<id>` arrive pre-filtered, and
   both originating links navigate correctly.
5. Marking an invoice paid on `/finance` updates hero cards on `/overview`.
6. Unauthenticated request to `/finance` redirects to `/login`; `/intake` and
   `/healthz` remain reachable; login sets the cookie and grants access.

## Follow-up

- **Mindelo OPS** — editable drag-and-drop flow chart of the client operating
  procedure, persisted to Postgres. Own spec, next.
- **Migration Pass 2** — Milestones CRUD, missing deletes, client edit/delete,
  then unplug Airtable, delete the `lib/airtable.ts` shim and rewrite the
  remaining import specifiers to `@/lib/db` (see non-goals: deliberately not
  done here, to keep this diff about routing).
- The env-error message still reads "Missing Airtable env vars … or Railway
  service variables" for a missing `DATABASE_URL`. Wrong product, wrong host;
  fix alongside the Pass 2 rename.
