# Airtable → Supabase migration (Pass 1)

> Design doc. Written 2026-08-26. Covers **only** the data-layer swap.
> Pass 2 (CRUD gaps + unplugging Airtable) and the page split / Mindelo OPS
> page are separate specs.

## Context

`my-personal-dashboard` (app in `business-dashboard/`, Next.js 16, Vercel,
passcode-gated) stores all business data in the Airtable base
**`Buisness Dashboard`** (`app3fo3kImAi7iMVb`) across 8 tables: Clients,
Projects, Invoices, Expenses, Milestones, Leads, Tasks, Ideas.

Two projects are queued behind this one:

1. **Page split** — one route per feature instead of today's single
   `/dashboard` route with anchor-scrolling.
2. **Mindelo OPS** — a new page with a drag-and-drop, editable flow chart of
   the company's client-facing operating procedure, persisted to the database.

Both are the reason to migrate now rather than later. Airtable's REST API
paginates at 100 records/page and rate-limits at 5 req/s, which makes
"fetch only what this page needs" impractical and makes drag-to-autosave a
poor fit. Building either on Airtable and migrating afterwards means touching
every component twice.

The base is also on Airtable's **free plan — a hard 1,000-record cap shared
across the whole base.** How close it is to that cap is currently unknown and
is measured as the first step of this work.

## Goals

- All 8 tables live in Postgres on Supabase, with real foreign keys and
  constraints.
- The dashboard behaves **identically** to today. No feature added, none lost.
- Not one component file changes.
- The migration is reproducible from committed scripts, and provably correct
  via an automated comparison against the live Airtable data.

## Non-goals (explicitly deferred to Pass 2)

- Milestones create/edit/delete UI (it is read-only in the app today, and is
  therefore the one table that genuinely still needs Airtable).
- Missing deletes for Invoices, Leads, Tasks, Ideas.
- Client edit + delete.
- Actually disconnecting Airtable.

During Pass 1 Airtable stays connected and correct, purely as a fallback.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| End state for Airtable | Full cutover (after Pass 2) | The dashboard is already how the data gets touched; occasional bulk-editing is served by Supabase's Table Editor |
| Where the DB lives | New free project in the **Mindelo ERP** org | $0 vs $10/mo in the Pro org; data volume is far under free-tier limits |
| Scope | Migrate first, close CRUD gaps in Pass 2 | Smaller blast radius; Airtable stays live to compare against |
| Schema shape | Clean snake_case Postgres + translation layer in `lib/` | Zero component churn now, and avoids colliding with the page split, which will already touch every component |
| Primary keys | `uuid`, plus `airtable_id text unique` | Nothing outside the DB stores `rec…` ids (verified: only `/healthz` exists as an API surface). `airtable_id` makes the import idempotent and every row traceable |
| Schema application | Committed script against `DATABASE_URL` | The MCP connection is scoped to `mindeloai's Org` and **cannot see the Mindelo ERP org**. Also keeps schema in version control |

### Known environment constraints

- The Airtable MCP connection is a **different Airtable account** and returns
  403 on this base. Export must run locally with the user's own PAT, obtained
  via `vercel env pull`.
- The Supabase MCP connection is scoped to `mindeloai's Org` only. All DDL and
  verification against the new project runs through local scripts.
- There are two duplicate orgs named "Mindelo ERP". The empty one should be
  deleted — after confirming it holds no projects, since deleting an org
  destroys its databases irreversibly.

## Architecture

Nothing about how the app is built changes. Server Components fetch, Server
Actions mutate, `revalidatePath("/dashboard")` refreshes. Only the layer
beneath `lib/` changes:

```
today:   page.tsx ──> lib/airtable.ts ──> Airtable REST
after:   page.tsx ──> lib/db.ts       ──> Supabase (Postgres)
                          │
                          └── row → TS type mappers, one per table
```

`lib/db.ts` exports **the same names and types** as `lib/airtable.ts` does
today — `getProjects()`, `createInvoice()`, `claimTask()`, `Project`,
`InvoiceWrite`, and so on. The existing zod schemas remain the contract; they
simply validate rows arriving from Postgres instead of from Airtable.

Precisely what changes outside `lib/`:

- `app/actions.ts` — import path only.
- `app/(dashboard)/dashboard/page.tsx` — import path, plus
  `MissingAirtableEnvError` becomes `MissingSupabaseEnvError` in its catch
  branch (the friendly "env vars are missing" message is preserved, reworded).
- **Nothing in `components/dashboard/` changes at all** — all 23 files
  untouched.

### Access model

Server-only, via the service-role key. RLS is **enabled with no policies**
(deny-all), so the anon key grants access to nothing. This matches how the app
already works: one shared passcode, no per-user identity, all data access
happening in Server Components and Server Actions.

`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are server-only env vars — never
prefixed `NEXT_PUBLIC_`.

## Schema

Eight tables. Relationships:

```
clients ──< projects ──< invoices
                     ├─< milestones
                     └─< tasks
leads      expenses     ideas        (standalone)
```

Every table carries `id uuid primary key default gen_random_uuid()` and
`airtable_id text unique`.

Every enum in the zod schemas becomes a `CHECK` constraint with exactly the
same members, so the database rejects precisely what zod would have rejected.

| Table | Columns (beyond `id`, `airtable_id`) |
|---|---|
| `clients` | `name` (not null), `company`, `email`, `phone`, `status` ∈ {Active, Inactive, Lead}, `notes`, `owner`, `created_at` |
| `projects` | `name` (not null), `client_id` → clients, `status` ∈ {Lead, In Progress, Review, Done, Cancelled}, `payment_structure` ∈ {one_time, deposit_final, milestones, recurring_monthly, recurring_custom}, `total_value`, `recurring_amount`, `recurring_frequency` ∈ {monthly, quarterly, yearly}, `deposit_percentage`, `start_date`, `end_date`, `notes`, `owner`, `service_type`, `github_repo_url`, `deploy_url`, `host` ∈ {Railway, Vercel, Netlify}, `tech_stack` |
| `invoices` | `invoice_number`, `project_id` → projects, `client_id` → clients, `amount`, `invoice_type` ∈ {deposit, milestone, final, recurring, one_off}, `status` ∈ {Draft, Sent, Paid, Overdue, Void}, `issue_date`, `due_date`, `paid_date`, `payment_method` ∈ {Bank, PayPal, Stripe, Cash, Other}, `pdf_url`, `notes` |
| `expenses` | `name` (not null), `category` ∈ {Software, Subcontractors, Hosting, Hardware, Marketing, Other}, `amount`, `date`, `recurring` (bool), `notes` |
| `milestones` | `name` (not null), `project_id` → projects, `amount`, `order_index`, `status` ∈ {Pending, Triggered, Invoiced}, `triggered_date` |
| `leads` | `name` (not null), `business_name`, `email`, `phone_whatsapp`, `source`, `status` ∈ {New, Contacted, Proposal Sent, Won, Lost}, `service_interest`, `current_website`, `budget_range`, `message`, `follow_up_date`, `proposal_draft`, `owner`, `notes`, `created_at` |
| `tasks` | `title` (not null), `description`, `project_id` → projects, `kind` ∈ {code, lead-gen, client-comms, research, content, ops, other}, `status` ∈ {Pending, In Progress, Blocked, Done}, `priority`, `assigned_to` ∈ {You, Partner, Any}, `picked_up_by`, `inputs`, `result_notes`, `created_at`, `created_by` |
| `ideas` | `title` (not null), `description`, `category` ∈ {product, service, marketing, internal, client}, `status` ∈ {Raw, Exploring, Validated, Parked, Doing}, `effort`, `impact`, `notes`, `created_at` |

### Three schema details that matter

**Link arrays become foreign keys.** Airtable models links as arrays
(`Client: string[]`), but in this base they are single-valued in practice. The
column is a scalar FK; the mapper returns `[client_id]` so the TS type is
unchanged. *The import must assert this* — if any record has more than one
linked id, the import fails loudly rather than silently dropping data.

**`Paid To Date` and `Balance Remaining` are not columns.** They are Airtable
rollups — computed, never stored. They become a view:

```sql
create view project_totals as
select p.id,
       coalesce(sum(i.amount) filter (where i.status = 'Paid'), 0) as paid_to_date,
       coalesce(p.total_value, 0)
         - coalesce(sum(i.amount) filter (where i.status = 'Paid'), 0) as balance_remaining
from projects p
left join invoices i on i.project_id = p.id
group by p.id;
```

This makes the values incapable of drifting. **The exact rollup semantics must
be confirmed against the live base during verification** — commit `35bb978`
("mark-paid invoices no longer silently miss revenue/profit") is evidence that
paid-status handling has been subtly wrong before. If Airtable's rollup turns
out to filter differently, the view definition changes to match, and that
discrepancy is reported rather than quietly reconciled.

**`claimTask` gets simpler and more correct.** The current implementation does
read-write-verify with a comment explaining that Airtable has no atomic
compare-and-set, and resolves double-claims by last-writer-wins. Postgres
replaces the whole dance:

```sql
update tasks set status = 'In Progress', picked_up_by = $2
where id = $1 and status = 'Pending'
returning *;
```

Zero rows returned means the claim was lost. This is a genuine correctness
improvement, not just a tidy-up, and the `ClaimResult` return type is
preserved exactly.

## Migration pipeline

Five committed scripts under `business-dashboard/scripts/`:

| Script | Does |
|---|---|
| `schema.sql` | The DDL above, idempotent (`create table if not exists`) |
| `db-migrate.mjs` | Applies `schema.sql` via `DATABASE_URL` |
| `export-airtable.mjs` | Dumps all 8 tables to `.migration/dump.json`; **reports per-table record counts** (this is the free-tier cap check) |
| `import-supabase.mjs` | `dump.json` → Postgres, with ID remapping |
| `verify-migration.mjs` | Reads both sources and proves they agree |

Run via npm scripts (`db:migrate`, `db:export`, `db:import`, `db:verify`)
using `node --env-file=.env.local`, consistent with the repo's existing
npm/node toolchain.

### ID remapping

The importer builds a `rec… → uuid` map as it inserts, then rewrites every
link field through it. Insert order follows dependencies:

```
clients → projects → invoices, milestones, tasks
leads, expenses, ideas   (no dependencies)
```

Because `airtable_id` is unique, inserts are `on conflict (airtable_id) do
update` — so **re-running the import is safe and idempotent**. That matters:
the expected workflow is import, verify, find a discrepancy, fix the mapper,
re-import.

Airtable's `Created` timestamps are preserved into `created_at` rather than
being reset to import time.

### The dump file is gitignored

`.migration/dump.json` holds client emails and complete financials. It is
added to `.gitignore` and never committed. It doubles as the one-time archive
of the Airtable data and should be copied somewhere durable (OneDrive).

## Verification

This is what decides whether the migration worked. `verify-migration.mjs`
reads **both** Airtable and Supabase and asserts:

- Row counts match, per table.
- Total invoiced, total paid, and total expenses match to the cent.
- Every project's `paid_to_date` from the view equals Airtable's rollup.
- A **full field-by-field diff on every record** — not a sample. The data is
  only a few hundred rows, so completeness is affordable.

It exits non-zero on any mismatch and prints the offending rows and fields.

Additional sign-off evidence, in order:

1. `npm run db:verify` exits 0.
2. `npm run build` succeeds and `npm run lint` is clean.
3. The dashboard loads locally and every number matches the deployed
   Airtable-backed version side by side.
4. Each mutation path is exercised once by hand: create a client, create and
   edit a project, create/edit/mark-paid an invoice, create/edit an expense,
   create/edit a lead, create/edit a task, claim a task, create/edit an idea.

No test framework exists in this repo today, and this spec does not add one —
the verification script *is* the test, and it tests the thing that actually
matters (that no data changed meaning in transit).

## Rollback

Cheap throughout Pass 1, because Airtable stays live, correct, and untouched,
and there is no dual-write. If anything is wrong: revert the commit,
redeploy. `lib/airtable.ts` is retained (unused) until Pass 2 for exactly this
reason.

## Deployment

1. Create the free project in the Mindelo ERP org (Taylor, in the browser —
   the MCP cannot reach that org).
2. Local `.env.local`: `vercel env pull` for the Airtable/GitHub/Anthropic
   values, then add `DATABASE_URL` (transaction pooler, port 6543) and
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Run migrate → export → import → verify locally against the real data.
4. Add the two Supabase env vars to the Vercel project.
5. Deploy; confirm against the checklist above.

`.env.local.example` is updated with the new variables and the Airtable
section is marked as legacy-pending-removal.

## Risks

| Risk | Handling |
|---|---|
| Airtable rollup semantics differ from the view | Caught by verification, which compares per project; view is corrected to match observed behaviour |
| A link field turns out to be multi-valued | Import fails loudly; schema decision revisited rather than data silently dropped |
| Free-tier project pauses after ~7 days idle | Accepted for now. If it bites, a cron ping to the existing `/healthz` route fixes it. Not built preemptively |
| Airtable free-tier record cap already near | Measured in step one by the export script's count report |
| Some field has an Airtable value outside its zod enum | Import surfaces the CHECK violation with the offending row; existing data is reconciled explicitly, not coerced |

## Follow-up work (separate specs)

- **Pass 2:** Milestones CRUD, missing deletes, client edit/delete, then
  disconnect Airtable and remove `lib/airtable.ts`.
- **Page split:** 11 routes, one per sidebar entry, each fetching only its own
  data (which this migration makes practical).
- **Mindelo OPS:** editable drag-and-drop flow chart of the client operating
  procedure, persisted to Postgres.
