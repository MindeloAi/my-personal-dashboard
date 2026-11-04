-- 024_documents_phase_2.up.sql
--
-- Bank details per payee, the payee chosen on an invoice document, and the
-- OAuth tables behind the Claude connector (/api/mcp).
--
-- payee_accounts holds the only copy of the bank details. They appear on an
-- invoice PDF and nowhere else: no connector tool returns them.
--
-- oauth_codes / oauth_tokens hold SHA-256 hashes, never the secrets. A token
-- belongs to a profiles row; verifying it re-checks that the profile is still
-- an admin, so deleting a profile cuts Claude off at the next call.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

create table if not exists payee_accounts (
  payee          text primary key check (payee in ('michael','zane','company')),
  account_name   text not null check (length(trim(account_name)) > 0),
  bank_name      text not null check (length(trim(bank_name)) > 0),
  branch         text,
  account_number text not null check (length(trim(account_number)) > 0),
  account_type   text,
  updated_by     text not null,
  updated        timestamptz not null default now()
);

alter table documents add column if not exists payee text check (payee in ('michael','zane','company'));

-- As in 022, plus the payee: a signed or void invoice keeps who was paid.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  -- A link may be cleared (ON DELETE SET NULL when the client, project, deal
  -- or invoice is deleted) but never pointed at a different record.
  if old.status in ('signed','void') and (
       (new.draft, new.title, new.type, new.payee) is distinct from (old.draft, old.title, old.type, old.payee)
       or (new.client_id  is not null and new.client_id  is distinct from old.client_id)
       or (new.project_id is not null and new.project_id is distinct from old.project_id)
       or (new.deal_id    is not null and new.deal_id    is distinct from old.deal_id)
       or (new.invoice_id is not null and new.invoice_id is distinct from old.invoice_id)) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

create table if not exists oauth_codes (
  code_hash      text primary key,
  user_id        uuid not null,
  client_id      text not null,
  redirect_uri   text not null,
  code_challenge text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz
);

create table if not exists oauth_tokens (
  token_hash text primary key,
  kind       text not null check (kind in ('access','refresh')),
  user_id    uuid not null,
  client_id  text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created    timestamptz not null default now()
);
create index if not exists oauth_tokens_user_idx on oauth_tokens (user_id);

alter table payee_accounts enable row level security;
alter table oauth_codes    enable row level security;
alter table oauth_tokens   enable row level security;
revoke all on table payee_accounts from anon, authenticated;
revoke all on table oauth_codes    from anon, authenticated;
revoke all on table oauth_tokens   from anon, authenticated;
