-- 025_receipts_and_expense_files.up.sql
--
-- Receipts: a document of type 'receipt' for one recorded payment. It carries
-- the payment and its own number (RCT-0001...), given when it is first finalised
-- and never changed. One live receipt per payment.
-- Expense files: receipts we are given for our own expenses attach to the
-- expense, like any other file.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

alter table documents drop constraint if exists documents_type_check;
alter table documents add constraint documents_type_check
  check (type in ('proposal','quote','service_agreement','care_plan','change_request','invoice','sop','receipt'));
alter table documents drop constraint if exists documents_invoice_only_on_invoices;
alter table documents add constraint documents_invoice_only_on_invoices check (type in ('invoice','receipt') or invoice_id is null);

alter table documents add column if not exists payment_id uuid references payments(id) on delete set null;
alter table documents add column if not exists receipt_number text unique;
alter table documents drop constraint if exists documents_payment_only_on_receipts;
alter table documents add constraint documents_payment_only_on_receipts check (type = 'receipt' or (payment_id is null and receipt_number is null));
create unique index if not exists documents_one_live_receipt on documents (payment_id) where type = 'receipt' and status <> 'void';

-- As in 024, plus the payment link and the receipt number, which never changes once given.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.receipt_number is not null and new.receipt_number is distinct from old.receipt_number then
    raise exception 'receipt % already has its number', old.receipt_number;
  end if;
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  if old.status in ('signed','void') and (
       (new.draft, new.title, new.type, new.payee) is distinct from (old.draft, old.title, old.type, old.payee)
       or (new.client_id  is not null and new.client_id  is distinct from old.client_id)
       or (new.project_id is not null and new.project_id is distinct from old.project_id)
       or (new.deal_id    is not null and new.deal_id    is distinct from old.deal_id)
       or (new.invoice_id is not null and new.invoice_id is distinct from old.invoice_id)
       or (new.payment_id is not null and new.payment_id is distinct from old.payment_id)) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

-- Expense files (Task 15)
alter table attachments drop constraint if exists attachments_entity_type_check;
alter table attachments add constraint attachments_entity_type_check
  check (entity_type in ('client','project','invoice','document','expense'));
alter table activity drop constraint if exists activity_entity_type_check;
alter table activity add constraint activity_entity_type_check
  check (entity_type in ('client','project','deal','document','invoice','attachment','expense'));
