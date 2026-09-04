-- 007_subscriptions.up.sql
--
-- Recurring revenue gets its own table.
--
-- Before this, the only representation of a retainer was a `projects` row with
-- payment_structure = 'recurring_monthly' | 'recurring_custom' plus
-- recurring_amount / recurring_frequency. That model had two problems:
--
--   1. Not every retainer has a build behind it. A Voice Receptionist client
--      paying monthly is not a project, and forcing one onto the Projects board
--      leaves it sitting in "In Progress" forever, skewing project counts and
--      the service-type split.
--   2. mrr-card.tsx only counted projects whose Status was 'In Progress'. A
--      delivered project on a maintenance retainer is 'Done', so it was
--      structurally excluded and MRR read $0 while real money was recurring.
--
-- `subscriptions` is now the single source of MRR. The projects.recurring_*
-- columns are deliberately LEFT IN PLACE and unread: dropping them would lose
-- the Hyline QC app row's frequency, which is the only record that a retainer
-- was ever agreed. They are no longer written by any form.
--
-- invoices.subscription_id is what makes the reminder self-healing: the next
-- invoice date is derived from the last invoice actually issued against the
-- subscription, so invoicing out of band corrects the schedule instead of
-- drifting from it.

create sequence if not exists subscriptions_sort_seq as bigint start 1000 increment 1000;

create table if not exists subscriptions (
  id          uuid primary key default gen_random_uuid(),
  sort_key    bigint not null default nextval('subscriptions_sort_seq'),

  name        text not null default '',
  -- Both FKs ON DELETE SET NULL, matching every other FK in this schema: losing
  -- a client must never silently delete the revenue record attached to it.
  client_id   uuid references clients(id)  on delete set null,
  project_id  uuid references projects(id) on delete set null,

  -- Unconstrained numeric, consistent with projects.total_value and
  -- invoices.amount. The amount charged EACH period, not per month; the
  -- per-month figure is frequency-divided at render time.
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

alter table invoices
  add column if not exists subscription_id uuid references subscriptions(id) on delete set null;
create index if not exists invoices_subscription_id_idx on invoices (subscription_id);

-- Same lockdown as every other table: RLS on with zero policies, so Supabase's
-- publicly-exposed anon/authenticated roles can read nothing. The app connects
-- as the table owner over DATABASE_URL and bypasses RLS entirely.
alter table subscriptions enable row level security;
revoke all on table    subscriptions      from anon, authenticated;
revoke all on sequence subscriptions_sort_seq from anon, authenticated;
