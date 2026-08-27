-- 003 up — remove the blank rows inherited from the Airtable import.
--
-- Airtable returns `fields: {}` for an empty grid row, and the import faithfully
-- carried those across. They hold no data at all — no name, no number, no
-- amount — and the read schemas in lib/db.ts already drop them, so they are
-- invisible in the UI while still inflating counts and producing empty states.
--
--   clients   5 rows with an empty name  (ALL client rows are blank)
--   projects  4 rows with an empty name
--   invoices 11 rows with no number, no amount and no status
--
-- Verified before writing this: nothing references any of them. No invoice,
-- milestone or task points at a blank project, no project or invoice points at
-- a blank client, and the 11 blank invoices sum to exactly 0.00. Deleting them
-- cannot change a single figure on the dashboard.
--
-- NOT touched here: 3 blank milestones and 2 blank tasks. Tasks are out of
-- scope (Google Calendar owns task management) and milestones have no UI.
--
-- REVERSIBILITY: every row is copied into an archive table before deletion,
-- so 003.down restores them exactly. The archive tables are left in place
-- afterwards; they are tiny and make the down migration reliable.
--
-- Note the invoice predicate does NOT filter on status = 'Draft'. These rows
-- have a NULL status, not 'Draft' — a Draft filter matches zero of them.

create table if not exists archive_003_blank_clients as
  select * from clients where name = '';

create table if not exists archive_003_blank_projects as
  select * from projects where name = '';

create table if not exists archive_003_blank_invoices as
  select * from invoices
   where invoice_number is null and coalesce(amount, 0) = 0 and status is null;

delete from invoices
 where invoice_number is null and coalesce(amount, 0) = 0 and status is null
returning id, invoice_number, amount, status;

delete from projects where name = ''
returning id, name, status;

delete from clients where name = ''
returning id, name;
