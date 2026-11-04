-- 022_documents.up.sql
--
-- What we offered each client, the documents built from it, and the files
-- attached to any record.
--
-- `deals`: one per project. The scope, price, payment schedule, care plan and
-- deadline that every later document is built from.
-- `documents`: a proposal, quote, agreement, care plan, change request, invoice
-- or SOP. `draft` is an editable list of sections. Finalising copies the draft
-- into `document_versions`, which can never be changed or deleted.
-- `attachments`: a file in the private `files` Storage bucket, attached to a
-- client, project, invoice or document. Only the metadata lives here.
-- `activity`: append-only log of who did what, through the dashboard or Claude.
--
-- FKs are ON DELETE SET NULL like the rest of the schema, except versions,
-- which block deleting a document that has been finalised.

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
