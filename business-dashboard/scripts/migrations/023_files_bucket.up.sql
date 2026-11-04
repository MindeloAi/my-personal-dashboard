-- 023_files_bucket.up.sql
--
-- The private bucket that holds every attachment and, from Phase 2, every
-- finalised PDF. Private: no public URLs. The app reads and writes it with the
-- service role key on the server and hands the browser short-lived signed URLs.
-- No storage.objects policies are added, so the anon key can do nothing.
-- Supabase only; the local test database has no storage schema.
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 26214400)
on conflict (id) do nothing;
