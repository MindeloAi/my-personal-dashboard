-- 004 down  Disable RLS on the archive tables.
--
-- DELIBERATELY NOT A TRUE INVERSE. This disables row level security but does NOT
-- re-grant anything to anon or authenticated.
--
-- Those grants were never an intentional decision. They came from Supabase's default
-- privileges on the public schema being applied to tables that migration 003 created
-- after schema.sql had already run its lockdown. Re-granting them would hand the
-- public anon key write access to these tables again, which is the exact hole 004
-- exists to close.
--
-- If you genuinely need to restore that state, do it by hand and know what you are
-- doing:
--   grant all on archive_003_blank_clients to anon, authenticated;

alter table archive_003_blank_clients  disable row level security;
alter table archive_003_blank_projects disable row level security;
alter table archive_003_blank_invoices disable row level security;
