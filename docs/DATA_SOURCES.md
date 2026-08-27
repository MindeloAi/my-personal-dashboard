# Data sources

> Phase 0.1 deliverable. Traced from the running code and the live database on
> 2026-08-27. Every screen, every table, every provider.

## One database, not three

Everything the dashboard reads and writes lives in a **single Supabase Postgres
project**:

| | |
|---|---|
| Project name | **Mindelo Dashboard** |
| Ref | `wsngqymtitajanfpudps` |
| Region | `us-east-1` |
| Organisation | **Mindelo ERP** (`lntaxfpcmrlzjkzfdxaa`), free tier |
| App connection | `DATABASE_URL` → transaction pooler, port **6543** |
| Migrations | `DIRECT_URL` → session pooler, port **5432** |

Both connection strings use the `aws-0-us-east-1.pooler.supabase.com` host.
The `db.<ref>.supabase.co` host is IPv6-only on the free tier and will not
resolve from Windows or from Vercel.

### Corrections to earlier assumptions

Three beliefs about storage are out of date and are corrected here:

- **Invoices do not come from the "Invoice App" Supabase project.** That
  project (`cvmfavyflqejfkerxcnf`) is InvoiceTT, a separate commercial product
  with its own customers. This dashboard has never read from it and must not.
- **Expenses do not come from Airtable.** The whole backend moved off Airtable
  to Postgres on 2026-08-26 (commit `c98a316`). Airtable base
  `app3fo3kImAi7iMVb` still exists but nothing reads it; it is a stale copy.
- **There is no `recurring_invoices` table.** It has never existed in this
  database. See "Where MRR actually comes from" below.

## Tables

All in schema `public`. Row counts as of 2026-08-27.

| Table | Rows | Notes |
|---|---|---|
| `clients` | 5 | **All 5 have an empty `name`** — no usable client records exist |
| `projects` | 19 | 9 `Lead`, 4 with null status (blank rows), 6 real |
| `invoices` | 21 | 11 with null status (blank rows), 7 `Paid`, 3 `Sent` |
| `expenses` | 52 | 41 imported from Airtable, 11 added after cutover |
| `leads` | 1 | A single row: "TEST LEAD - delete me" |
| `milestones` | 3 | All blank. Read-only in the app; no UI writes it |
| `tasks` | 2 | All blank. **Out of scope** — Google Calendar owns task management |
| `ideas` | 1 | No longer surfaced; the Ideas page was removed |

Every table carries `id uuid`, `airtable_id text unique` (null for rows created
after cutover), and `sort_key bigint` which preserves the original Airtable
display order.

There is also one view, `project_totals`, which computes `paid_to_date` and
`balance_remaining` per project from paid invoices. It replaced an Airtable
rollup that was specified but never actually created.

## Screen → table map

The data layer is `src/lib/db.ts`. `src/lib/airtable.ts` is a two-line
`export * from "./db"` shim kept so older imports keep resolving; it does not
talk to Airtable.

| Route | File | Reads |
|---|---|---|
| *(layout)* | `src/app/(app)/layout.tsx` | `clients`, `projects` — for the Quick Actions create dialogs |
| `/overview` | `(app)/overview/page.tsx` | `clients`, `projects`, `invoices`, `expenses` |
| `/finance` | `(app)/finance/page.tsx` | `clients`, `projects`, `invoices`, `expenses` |
| `/projects` | `(app)/projects/page.tsx` | `projects`, `clients` |
| `/clients` | `(app)/clients/page.tsx` | `clients`, `invoices`, `projects` |
| `/leads` | `(app)/leads/page.tsx` | `leads` |
| `/intake` | `app/intake/page.tsx` | writes `leads` (public form, no auth) |
| `/healthz` | `app/healthz/route.ts` | nothing — static `"ok"`, does not check the DB |

Writes all funnel through `src/app/actions.ts`. Every action ends with
`revalidatePath("/", "layout")`.

## Where the Projects kanban and Leads list actually live

Both were listed as unidentified. They are:

- **Projects kanban** — `public.projects`, rendered by
  `src/components/dashboard/project-board.tsx`. Drag-and-drop writes
  `status` via `updateProjectStatus`. The `Lead` column is 9 of the 19 rows.
- **Leads list** — `public.leads`, rendered by
  `src/components/dashboard/leads-table.tsx`. One test row. The public
  `/intake` form is the only thing that writes to it in anger.

This is the two-pipeline duplication Phase 3.1 addresses. Both are Postgres
tables in the same database, so consolidating is a data move, not an
integration.

## Where MRR actually comes from

`src/components/dashboard/mrr-card.tsx` computes MRR from two sources, neither
of which is a retainer record:

1. `projects` where `payment_structure` is `recurring_monthly` or
   `recurring_custom`, summing `recurring_amount` divided by a frequency
   divisor.
2. `invoices` where `invoice_type = 'recurring'` and status `Paid`, for a
   six-month trailing chart.

Only **one** project currently has `payment_structure = 'recurring_custom'`,
and no invoice carries `invoice_type = 'recurring'`, which is why the card
reads near zero. The cause is missing data, not a missing table.

## Why several screens report zero

The dominant cause is **blank rows inherited from Airtable**, not missing
foreign keys. Airtable returns `fields: {}` for an empty grid row, and the read
schemas require a name or title, so those rows are dropped at the mapper with a
`[airtable] dropped record` warning and never reach the UI.

| Symptom | Real cause |
|---|---|
| Clients page shows an empty state | All 5 `clients` rows have an empty `name` and are dropped. There are no client records to rank |
| No invoice carries a client | `client_id` is null on all 21 invoices |
| "Eleven empty draft invoices" | 11 invoices have **null status**, no number and no amount — blank import rows, not `Draft` |
| Projects board has gaps | 4 of 19 `projects` rows are blank |
| MRR reads zero | One recurring project, no recurring invoices |

Phase 0.4 should therefore filter on "no number and zero/absent amount"
regardless of status, since these rows are not literally `Draft`.

## Naming to clean up (Phase 0.3)

`projects.service_type` currently holds one row valued **`AI Automation`**.
It is free text in the schema (no CHECK constraint), so renaming it to
`Automation` is a one-row `update`, not a migration.

## Migrations

`scripts/schema.sql` is the full idempotent schema, applied by
`npm run db:migrate`. Reversible changes live as numbered pairs in
`scripts/migrations/` and are applied one at a time by
`scripts/run-migration.mjs`, which takes a `--schema` flag so the same SQL can
be rehearsed against a scratch copy before production.

Applied so far:

- `001_expenses_audit_columns` — added `usd_amount numeric(10,2)`, `reference text`
- `002_expenses_audit_backfill` — parsed those from reconciliation notes

## Access and auth

**There is currently no authentication.** The gate built on 2026-08-27 was
removed the same day (commit `c138d1b`) because the `DASHBOARD_PASSCODE` set in
Vercel is not recoverable — it is marked sensitive, so `vercel env pull`
returns it empty. `src/lib/auth.ts` and `src/app/login/page.tsx` remain in the
repo and work.

Database access is server-only via the service connection. RLS is enabled with
no policies on every table, so Supabase's public anon/PostgREST roles can read
nothing. The exposure is the unauthenticated web app, not the database.
