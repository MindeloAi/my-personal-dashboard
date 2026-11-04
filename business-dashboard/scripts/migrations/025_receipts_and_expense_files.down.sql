-- 025_receipts_and_expense_files.down.sql
--
-- Fails (and rolls back) if any receipt document, expense file or expense
-- activity exists: the old check lists do not allow them. Void or delete them first.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

alter table activity drop constraint if exists activity_entity_type_check;
alter table activity add constraint activity_entity_type_check
  check (entity_type in ('client','project','deal','document','invoice','attachment'));
alter table attachments drop constraint if exists attachments_entity_type_check;
alter table attachments add constraint attachments_entity_type_check
  check (entity_type in ('client','project','invoice','document'));

-- As in 024.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
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

drop index if exists documents_one_live_receipt;
alter table documents drop constraint if exists documents_payment_only_on_receipts;
alter table documents drop column if exists receipt_number;
alter table documents drop column if exists payment_id;
alter table documents drop constraint if exists documents_invoice_only_on_invoices;
alter table documents add constraint documents_invoice_only_on_invoices check (type = 'invoice' or invoice_id is null);
alter table documents drop constraint if exists documents_type_check;
alter table documents add constraint documents_type_check
  check (type in ('proposal','quote','service_agreement','care_plan','change_request','invoice','sop'));
