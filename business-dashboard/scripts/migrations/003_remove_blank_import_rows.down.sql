-- 003 down — restore the blank rows from the archive tables.
--
-- Insert order is the reverse of the delete: clients and projects first, so
-- that any invoice restored afterwards can resolve its foreign keys. (In
-- practice none of these rows reference each other, but the order is correct
-- regardless.)
--
-- `on conflict (id) do nothing` makes this safe to run twice, and stops it
-- clobbering a real row that happens to have been given the same id.
--
-- Requires 003.up to have run — the archive tables are created there.

insert into clients select * from archive_003_blank_clients
  on conflict (id) do nothing;

insert into projects select * from archive_003_blank_projects
  on conflict (id) do nothing;

insert into invoices select * from archive_003_blank_invoices
  on conflict (id) do nothing;
