-- 004 up  Lock down the archive tables created by migration 003.
--
-- Migration 003 created archive_003_blank_{clients,projects,invoices} to make the
-- blank-row deletion reversible. It did not lock them down, and schema.sql's
-- `revoke all on all tables ... from anon, authenticated` only affects tables that
-- exist at the moment it runs. Supabase's default privileges on the public schema
-- therefore granted the anon role full access to all three.
--
-- Verified before writing this, with a real anon-key request against the PostgREST
-- API: the eight real tables returned 401, these three returned 200.
--
--   anon held: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--
-- Confidentiality impact was near zero, since every archived row is blank (all
-- business columns null). The write surface was the real problem: anyone holding the
-- anon key, which is public by design, could have truncated these tables and silently
-- destroyed the ability to roll migration 003 back.
--
-- Enabling RLS with no policies denies everything to anon and authenticated. The app
-- is unaffected: it connects as `postgres`, which owns these tables and carries
-- rolbypassrls, so RLS never applies to it.

alter table archive_003_blank_clients  enable row level security;
alter table archive_003_blank_projects enable row level security;
alter table archive_003_blank_invoices enable row level security;

revoke all on archive_003_blank_clients  from anon, authenticated;
revoke all on archive_003_blank_projects from anon, authenticated;
revoke all on archive_003_blank_invoices from anon, authenticated;
