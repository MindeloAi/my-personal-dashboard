-- 005 up  Profiles table holding the admin role.
--
-- The role is stored HERE, in a table only the server can write, and NOT in
-- auth.users.raw_user_meta_data. user_metadata is writable by the user themselves
-- through the client SDK, so a role kept there could be self-granted by anyone who
-- managed to obtain an account. app_metadata would also be acceptable, but a real
-- table is easier to audit and to join against.
--
-- One row per founder. Rows are seeded by scripts/seed-admins.mjs using the service
-- role key, never through the browser.
--
-- RLS is enabled with no policies, matching every other table in this schema: the
-- app reads this as `postgres` (which owns it and carries rolbypassrls), while the
-- public PostgREST surface gets nothing.

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

revoke all on profiles from anon, authenticated;
