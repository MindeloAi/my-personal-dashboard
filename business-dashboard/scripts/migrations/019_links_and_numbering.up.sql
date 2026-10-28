-- 019 up  Projects can belong to a lead or be internal; leads link to clients;
-- the database numbers invoices.
--
-- Numbering: an invoice gets the next INV-#### the first time it is Sent,
-- Overdue or Paid with no number. Drafts and voided-before-sending invoices
-- stay unnumbered. Once given, a number never changes (a client holds it),
-- except during the one-time renumbering in 020, which sets
-- invoices.renumber = on for its transaction. An advisory lock serialises
-- assignment so two invoices sent together never share a number.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

-- Already in production (an earlier unmerged change); missing from schema.sql.
alter table leads add column if not exists client_id uuid references clients(id) on delete set null;

alter table projects
  add column lead_id  uuid references leads(id) on delete set null,
  add column internal boolean not null default false;
create index projects_lead_id_idx on projects (lead_id);

create function invoices_number() returns trigger
language plpgsql as $$
declare
  n int;
begin
  if tg_op = 'UPDATE'
     and old.invoice_number is not null
     and new.invoice_number is distinct from old.invoice_number
     and coalesce(current_setting('invoices.renumber', true), '') <> 'on' then
    raise exception 'Invoice % already has its number. Numbers never change once issued.', old.invoice_number;
  end if;
  -- A number typed by hand on a still-unnumbered invoice is deliberately allowed
  -- (tests insert explicit TEST-/LED- numbers; the forms stop sending numbers).
  if new.invoice_number is null and new.status in ('Sent', 'Overdue', 'Paid') then
    perform pg_advisory_xact_lock(hashtext('invoices.invoice_number'));
    select coalesce(max(substring(upper(invoice_number) from '^INV-([0-9]+)$')::int), 0) + 1
      into n
      from invoices;
    new.invoice_number := 'INV-' || lpad(n::text, greatest(4, length(n::text)), '0');
  end if;
  return new;
end $$;

create trigger invoices_number
  before insert or update on invoices
  for each row execute function invoices_number();

revoke execute on function invoices_number() from public, anon, authenticated;
