-- 001 up — add the per-row audit trail columns to expenses.
--
-- Both are NULLABLE with NO DEFAULT, so adding them cannot change a single
-- existing row: every current row simply gets NULL in the new columns.
--
-- The existing `amount` column is deliberately untouched. It stays the TTD
-- figure the dashboard totals on; `usd_amount` records the source amount in
-- USD before conversion and is never read by any calculation.
--
-- `notes` is NOT added — this table already has a `notes text` column.
--
-- Statements are unqualified so the same file can run against a scratch schema
-- (search_path=sandbox) before production (search_path=public).

alter table expenses add column if not exists usd_amount numeric(10,2);

alter table expenses add column if not exists reference text;

comment on column expenses.usd_amount is
  'Source amount in USD before conversion to TTD. Audit trail only — never read by totals.';

comment on column expenses.reference is
  'Vendor invoice or receipt number.';
