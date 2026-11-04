-- 024_documents_phase_2.down.sql
drop table if exists oauth_tokens;
drop table if exists oauth_codes;
drop table if exists payee_accounts;

create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  if old.status in ('signed','void') and (
       (new.draft, new.title, new.type) is distinct from (old.draft, old.title, old.type)
       or (new.client_id  is not null and new.client_id  is distinct from old.client_id)
       or (new.project_id is not null and new.project_id is distinct from old.project_id)
       or (new.deal_id    is not null and new.deal_id    is distinct from old.deal_id)
       or (new.invoice_id is not null and new.invoice_id is distinct from old.invoice_id)) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

alter table documents drop column if exists payee;
