-- 015_client_timeline.up.sql
--
-- A per-client record of what was said and what was promised.
--
-- Before this, the commitments made in a call, meeting, email or message lived
-- only in the notes of whoever attended. Nothing recorded who owed what to
-- whom, or by when, so a late promise surfaced only when someone remembered it.
--
-- `client_entries` is the history: one row per conversation, with the pasted
-- text kept verbatim in `body`. `client_promises` is the who-owes-what list:
-- each row is owed by us or by the client, and carries a due date and a status.
-- A promise that moves to a new date is closed as 'replaced' and points at its
-- successor through `replaced_by`, so the original date is never lost.
--
-- Every FK is ON DELETE SET NULL, matching the rest of the schema: deleting a
-- client must not silently delete its history.

create table if not exists client_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete set null,
  occurred_on date not null,
  kind        text not null check (kind in ('call','meeting','email','message','document')),
  direction   text not null check (direction in ('received','sent','both')),
  summary     text not null,
  people      text,
  body        text,   -- the pasted text, verbatim
  link        text,
  created_by  text not null,   -- admin email from requireAdmin()
  created     timestamptz not null default now()
);

create table if not exists client_promises (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete set null,
  entry_id        uuid references client_entries(id) on delete set null,   -- where it came from
  owed_by         text not null check (owed_by in ('us','client')),
  what            text not null,
  due_on          date,
  status          text not null default 'open'
                  check (status in ('open','done','dropped','replaced')),
  replaced_by     uuid references client_promises(id) on delete set null,
  closed_on       date,
  closed_by       text,
  closed_entry_id uuid references client_entries(id) on delete set null,   -- what closed it
  note            text,
  created_by      text not null,
  created         timestamptz not null default now(),
  constraint client_promises_closed_iff_not_open check ((status = 'open') = (closed_on is null)),
  constraint client_promises_replaced_has_target check (status <> 'replaced' or replaced_by is not null)
);

create index if not exists client_entries_client_idx on client_entries (client_id, occurred_on desc);
create index if not exists client_promises_client_idx on client_promises (client_id, status);

-- Same lockdown as every other table: RLS on with zero policies, so Supabase's
-- publicly-exposed anon/authenticated roles can read nothing. The app connects
-- as the table owner over DATABASE_URL and bypasses RLS entirely.
alter table client_entries  enable row level security;
alter table client_promises enable row level security;
revoke all on table client_entries  from anon, authenticated;
revoke all on table client_promises from anon, authenticated;
