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

-- ─── Founder ledger ────────────────────────────────────────────────────────────
-- Not mirrored here: its trigger functions and seed rows are not idempotent.
-- After this file, apply scripts/migrations/011_founder_ledger.up.sql then 012 with
-- scripts/run-migration.mjs.

-- ─── Documents, deals, attachments, activity (migration 022) ──────────────
create or replace function schedule_total(j jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(j) x
$$;

create table if not exists deals (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid unique references projects(id) on delete set null,
  reference        text not null unique check (reference ~ '^[A-Z0-9]{2,8}-[0-9]{4}-[0-9]{2}$'),
  scope            text[] not null default '{}',
  price_total      numeric(12,2) check (price_total is null or price_total >= 0),
  currency         text not null default 'TTD',
  payment_schedule jsonb not null default '[]' check (jsonb_typeof(payment_schedule) = 'array'),
  care_plan        jsonb check (care_plan is null or jsonb_typeof(care_plan) = 'object'),
  deadline         date,
  goals            text,
  notes            text,
  payee_default    text check (payee_default in ('michael','zane','company')),
  created_by       text not null,
  updated_by       text not null,
  updated_via      text not null default 'dashboard' check (updated_via in ('dashboard','claude')),
  created          timestamptz not null default now(),
  updated          timestamptz not null default now(),
  constraint deals_schedule_adds_up check (
    jsonb_array_length(payment_schedule) = 0
    or (price_total is not null and schedule_total(payment_schedule) = price_total)
  )
);

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('proposal','quote','service_agreement','care_plan','change_request','invoice','sop')),
  client_id       uuid references clients(id) on delete set null,
  project_id      uuid references projects(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  invoice_id      uuid references invoices(id) on delete set null,
  title           text not null check (length(trim(title)) > 0),
  status          text not null default 'draft'
                  check (status in ('draft','finalised','sent','accepted','signed','declined','void')),
  draft           jsonb not null default '[]' check (jsonb_typeof(draft) = 'array'),
  current_version integer not null default 0 check (current_version >= 0),
  created_by      text not null,
  updated_by      text not null,
  updated_via     text not null default 'dashboard' check (updated_via in ('dashboard','claude')),
  created         timestamptz not null default now(),
  updated         timestamptz not null default now(),
  constraint documents_invoice_only_on_invoices check (type = 'invoice' or invoice_id is null)
);

create table if not exists document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id),
  version      integer not null check (version >= 1),
  title        text not null,
  sections     jsonb not null check (jsonb_typeof(sections) = 'array'),
  pdf_path     text,
  finalised_by text not null,
  finalised_at timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('client','project','invoice','document')),
  entity_id    uuid not null,
  storage_path text not null unique,
  filename     text not null,
  content_type text not null,
  size         bigint not null check (size > 0),
  kind         text not null default 'other' check (kind in ('signed_copy','proof_of_payment','asset','other')),
  uploaded_by  text not null,
  created      timestamptz not null default now()
);

create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client','project','deal','document','invoice','attachment')),
  entity_id   uuid not null,
  client_id   uuid references clients(id) on delete set null,
  action      text not null,
  summary     text not null,
  actor       text not null,
  via         text not null default 'dashboard' check (via in ('dashboard','claude')),
  created     timestamptz not null default now()
);

create index if not exists documents_client_idx on documents (client_id, updated desc);
create index if not exists documents_project_idx on documents (project_id, updated desc);
create index if not exists attachments_entity_idx on attachments (entity_type, entity_id, created desc);
create index if not exists activity_client_idx on activity (client_id, created desc);
create index if not exists activity_entity_idx on activity (entity_type, entity_id, created desc);

-- A finalised version is frozen. The one allowed change is filling in its PDF
-- path once, after the PDF has been rendered (Phase 2).
create or replace function document_versions_frozen() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'document versions cannot be deleted';
  end if;
  if new.document_id is distinct from old.document_id
     or new.version is distinct from old.version
     or new.title is distinct from old.title
     or new.sections is distinct from old.sections
     or new.finalised_by is distinct from old.finalised_by
     or new.finalised_at is distinct from old.finalised_at
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception 'document versions cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists document_versions_frozen on document_versions;
create trigger document_versions_frozen before update or delete on document_versions
  for each row execute function document_versions_frozen();

-- Signed and void are final.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  if old.status in ('signed','void') and (new.draft, new.title, new.type, new.client_id, new.project_id, new.deal_id, new.invoice_id)
       is distinct from (old.draft, old.title, old.type, old.client_id, old.project_id, old.deal_id, old.invoice_id) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

drop trigger if exists documents_final_states on documents;
create trigger documents_final_states before update on documents
  for each row execute function documents_final_states();

-- The activity log is append-only.
create or replace function activity_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'activity is append-only';
end $$;

drop trigger if exists activity_append_only on activity;
create trigger activity_append_only before update or delete on activity
  for each row execute function activity_append_only();

-- Same lockdown as every other table: RLS on with zero policies.
alter table deals             enable row level security;
alter table documents         enable row level security;
alter table document_versions enable row level security;
alter table attachments       enable row level security;
alter table activity          enable row level security;
revoke all on table deals             from anon, authenticated;
revoke all on table documents         from anon, authenticated;
revoke all on table document_versions from anon, authenticated;
revoke all on table attachments       from anon, authenticated;
revoke all on table activity          from anon, authenticated;
