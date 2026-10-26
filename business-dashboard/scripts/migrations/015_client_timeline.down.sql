-- 015_client_timeline.down.sql
--
-- Reverses 015_client_timeline.up.sql. Promises go first because they
-- reference entries.

drop table if exists client_promises;
drop table if exists client_entries;
