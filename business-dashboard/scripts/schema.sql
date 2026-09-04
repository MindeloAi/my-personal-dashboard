-- schema.sql — Postgres schema for the business dashboard.
--
-- Apply with:  npm run db:migrate
-- Idempotent: safe to re-run.
--
-- This replaces the Airtable base `Buisness Dashboard` (app3fo3kImAi7iMVb).
-- Column names are snake_case; src/lib/db.ts maps them back to the exact
-- Airtable field names the UI expects ("Total Value", "Phone/WhatsApp", …).
--
-- Two rules that are load-bearing for a *seamless* migration:
--   1. Every FK is ON DELETE SET NULL, never CASCADE. Airtable clears a dangling
--      link and keeps the record; CASCADE would delete a project's invoices and
--      silently change every revenue figure on the dashboard.
--   2. Date columns are `date`, not `timestamp`. The UI renders some of these
--      strings straight into the DOM and parses others with date-fns parseISO,
--      so they must come back as bare YYYY-MM-DD.

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ─── Ordering ───────────────────────────────────────────────────────────────
-- Four panels (leads, ideas, tasks, projects) render in raw fetch order with no
-- sort, so they currently inherit Airtable's grid order. Postgres without an
-- ORDER BY is non-deterministic and those lists would shuffle between renders.
--
-- The importer writes sort_key = (airtable_index + 1) * 1000, preserving the
-- exact order Airtable returned records, then setval()s each sequence to
-- max(sort_key). With increment 1000 a newly created row lands at the bottom of
-- the list — matching Airtable's grid — with no read-modify-write race and 999
-- spare slots between any two rows for future manual reordering.

create sequence if not exists clients_sort_seq    as bigint start 1000 increment 1000;
create sequence if not exists projects_sort_seq   as bigint start 1000 increment 1000;
create sequence if not exists invoices_sort_seq   as bigint start 1000 increment 1000;
create sequence if not exists expenses_sort_seq   as bigint start 1000 increment 1000;
create sequence if not exists milestones_sort_seq as bigint start 1000 increment 1000;
create sequence if not exists leads_sort_seq      as bigint start 1000 increment 1000;
create sequence if not exists tasks_sort_seq      as bigint start 1000 increment 1000;
create sequence if not exists ideas_sort_seq      as bigint start 1000 increment 1000;
create sequence if not exists subscriptions_sort_seq as bigint start 1000 increment 1000;

-- ─── clients ────────────────────────────────────────────────────────────────
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  sort_key    bigint not null default nextval('clients_sort_seq'),

  name        text not null default '',
  company     text,
  email       text,
  phone       text,
  status      text check (status in ('Active','Inactive','Lead')),
  notes       text,
  created     timestamptz not null default now(),
  owner       text
);

-- ─── projects ───────────────────────────────────────────────────────────────
create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  airtable_id         text unique,
  sort_key            bigint not null default nextval('projects_sort_seq'),

  name                text not null default '',
  client_id           uuid references clients(id) on delete set null,
  status              text check (status in ('Lead','In Progress','Review','Done','Cancelled')),
  payment_structure   text check (payment_structure in
                        ('one_time','deposit_final','milestones',
                         'recurring_monthly','recurring_custom')),
  -- Unconstrained `numeric`, deliberately not numeric(14,2): Airtable stores
  -- IEEE doubles, and a scale constraint would silently round on import.
  total_value         numeric,
  recurring_amount    numeric,
  recurring_frequency text check (recurring_frequency in ('monthly','quarterly','yearly')),
  deposit_percentage  numeric,
  start_date          date,
  end_date            date,
  notes               text,
  owner               text,
  service_type        text,   -- free text in the zod schema, so no CHECK
  github_repo_url     text,
  deploy_url          text,
  host                text check (host in ('Railway','Vercel','Netlify')),
  tech_stack          text
  -- paid_to_date / balance_remaining are NOT stored — see project_totals below.
);
create index if not exists projects_client_id_idx on projects (client_id);

-- ─── subscriptions ────────────────────────────────────────────────────────
-- The single source of recurring revenue (migration 007). Defined before
-- invoices because invoices.subscription_id references it.
--
-- Retainers used to be modelled as a `projects` row with payment_structure =
-- 'recurring_*'. That excluded every retainer with no build behind it, and MRR
-- only counted projects still 'In Progress' — so a delivered project on a
-- maintenance retainer contributed nothing. projects.recurring_amount /
-- recurring_frequency still exist but are no longer read or written.
create table if not exists subscriptions (
  id          uuid primary key default gen_random_uuid(),
  sort_key    bigint not null default nextval('subscriptions_sort_seq'),

  name        text not null default '',
  client_id   uuid references clients(id)  on delete set null,
  project_id  uuid references projects(id) on delete set null,

  -- The amount charged EACH period, not per month. lib/subscriptions.ts divides
  -- by the frequency to reach MRR.
  amount      numeric,
  frequency   text check (frequency in ('monthly','quarterly','yearly')),
  status      text check (status in ('Active','Paused','Cancelled')),

  -- start_date doubles as the first-invoice anchor: a subscription that has
  -- never been invoiced is due on its start date.
  start_date  date,
  end_date    date,
  notes       text,
  created     timestamptz not null default now()
);
create index if not exists subscriptions_client_id_idx on subscriptions (client_id);

-- ─── invoices ───────────────────────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  airtable_id    text unique,
  sort_key       bigint not null default nextval('invoices_sort_seq'),

  invoice_number text,   -- INV-YYYYMMDD-#### , random not sequential; NOT unique
  project_id     uuid references projects(id) on delete set null,
  -- Airtable's Invoices.Client is documented as a LOOKUP through Project. This
  -- column is therefore an OVERRIDE and is normally NULL: getInvoices() returns
  -- coalesce(client_id, projects.client_id), which reproduces lookup semantics
  -- while still preserving any invoice whose Airtable Client genuinely differed
  -- from its project's. The importer logs every such row.
  client_id      uuid references clients(id) on delete set null,
  amount         numeric,
  invoice_type   text check (invoice_type in ('deposit','milestone','final','recurring','one_off')),
  status         text check (status in ('Draft','Sent','Paid','Overdue','Void')),
  issue_date     date,
  due_date       date,
  -- Nullable on purpose. Ten components require Status='Paid' AND a paid_date
  -- to count revenue, while revenue-split.tsx requires only the status. That
  -- inconsistency is current behaviour and must not be "fixed" here.
  paid_date      date,
  payment_method text check (payment_method in ('Bank','PayPal','Stripe','Cash','Other')),
  pdf_url        text,
  notes          text,
  -- Set when an invoice bills a retainer. lib/subscriptions.ts derives the
  -- next invoice date from the latest issue_date carrying this id, so an
  -- invoice raised out of band corrects the schedule instead of drifting.
  subscription_id uuid references subscriptions(id) on delete set null
);
create index if not exists invoices_project_id_idx on invoices (project_id);
create index if not exists invoices_paid_idx on invoices (project_id) where status = 'Paid';
create index if not exists invoices_subscription_id_idx on invoices (subscription_id);

-- ─── expenses ───────────────────────────────────────────────────────────────
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  sort_key    bigint not null default nextval('expenses_sort_seq'),

  name        text not null default '',
  category    text check (category in
                ('Software','Subcontractors','Hosting','Hardware','Marketing','Other')),
  -- The TTD figure every dashboard total sums. Never derived from usd_amount.
  amount      numeric,
  date        date,
  -- Airtable omits an unchecked checkbox entirely, so the UI sees undefined.
  -- db.ts shapes `false` back to undefined on read to keep that identical.
  recurring   boolean not null default false,
  notes       text,

  -- Per-row audit trail (migration 001). Nullable, no defaults. Recorded for
  -- traceability only — no total, chart or metric reads these.
  usd_amount  numeric(10,2),   -- source amount in USD before conversion
  reference   text             -- vendor invoice or receipt number
);

-- ─── milestones ─────────────────────────────────────────────────────────────
create table if not exists milestones (
  id             uuid primary key default gen_random_uuid(),
  airtable_id    text unique,
  sort_key       bigint not null default nextval('milestones_sort_seq'),

  name           text not null default '',
  project_id     uuid references projects(id) on delete set null,
  amount         numeric,
  order_index    integer,   -- "Order" in Airtable; `order` is reserved in SQL
  status         text check (status in ('Pending','Triggered','Invoiced')),
  triggered_date date
);
create index if not exists milestones_project_id_idx on milestones (project_id);

-- ─── leads ──────────────────────────────────────────────────────────────────
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  airtable_id      text unique,
  sort_key         bigint not null default nextval('leads_sort_seq'),

  name             text not null default '',
  business_name    text,
  email            text,
  phone_whatsapp   text,   -- "Phone/WhatsApp"
  source           text,
  status           text check (status in ('New','Contacted','Proposal Sent','Won','Lost')),
  service_interest text,
  current_website  text,
  budget_range     text,
  message          text,
  followup_date    date,   -- "Follow-up Date"
  proposal_draft   text,
  owner            text,
  created          timestamptz not null default now(),
  notes            text
);

-- ─── tasks ──────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  airtable_id   text unique,
  sort_key      bigint not null default nextval('tasks_sort_seq'),

  title         text not null default '',
  description   text,
  project_id    uuid references projects(id) on delete set null,
  kind          text check (kind in
                  ('code','lead-gen','client-comms','research','content','ops','other')),
  status        text check (status in ('Pending','In Progress','Blocked','Done')),
  priority      text,   -- free text in the zod schema
  assigned_to   text check (assigned_to in ('You','Partner','Any')),
  picked_up_by  text,
  inputs        text,
  result_notes  text,
  created       timestamptz not null default now(),
  created_by    text
);
create index if not exists tasks_project_id_idx on tasks (project_id);
-- Supports claimTask's atomic compare-and-set.
create index if not exists tasks_pending_idx on tasks (status) where status = 'Pending';

-- ─── ideas ──────────────────────────────────────────────────────────────────
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  sort_key    bigint not null default nextval('ideas_sort_seq'),

  title       text not null default '',
  description text,
  category    text check (category in ('product','service','marketing','internal','client')),
  status      text check (status in ('Raw','Exploring','Validated','Parked','Doing')),
  effort      text,   -- free text in the zod schema
  impact      text,
  notes       text,
  created     timestamptz not null default now()
);

-- ─── project_totals — replaces the Airtable rollup + formula ────────────────
--
-- From dashboard-master-plan.md, which documents how the base was built:
--   Paid To Date      = Rollup: from Invoices where Status = Paid, sum of Amount
--   Balance Remaining = Formula: {Total Value} - {Paid To Date}
--
-- Deriving rather than storing means marking an invoice paid updates the project
-- card with no second write and no possibility of drift.
create or replace view project_totals
  with (security_invoker = on)
as
select
  p.id as project_id,
  coalesce(sum(i.amount) filter (where i.status = 'Paid'), 0)::numeric
    as paid_to_date,
  (coalesce(p.total_value, 0)
     - coalesce(sum(i.amount) filter (where i.status = 'Paid'), 0))::numeric
    as balance_remaining
from projects p
left join invoices i on i.project_id = p.id
group by p.id, p.total_value;

-- ─── Lockdown ───────────────────────────────────────────────────────────────
-- The app connects as the table owner over a direct Postgres URL, which bypasses
-- RLS entirely. Enabling RLS with zero policies means Supabase's publicly-exposed
-- anon/authenticated PostgREST roles can read nothing. Without this, the whole
-- base is readable by anyone holding the project's anon key.
alter table clients    enable row level security;
alter table projects   enable row level security;
alter table invoices   enable row level security;
alter table expenses   enable row level security;
alter table milestones enable row level security;
alter table leads      enable row level security;
alter table tasks      enable row level security;
alter table ideas      enable row level security;
alter table subscriptions enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
