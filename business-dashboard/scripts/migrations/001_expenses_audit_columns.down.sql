-- 001 down — remove the audit trail columns.
--
-- Safe to run: these columns hold only audit metadata. Dropping them cannot
-- affect `amount`, `date`, `category`, `notes` or any figure the dashboard
-- totals on. It DOES discard whatever was backfilled or hand-entered into
-- them, so run 002.down first if you want to reverse only the backfill.

alter table expenses drop column if exists usd_amount;

alter table expenses drop column if exists reference;
