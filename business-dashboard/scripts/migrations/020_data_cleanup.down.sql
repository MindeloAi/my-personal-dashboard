-- 020 down  Drops the uniqueness rule only. The data fixes are not reversed
-- here: restore the rows from the backup taken just before 020 was applied
-- (scripts/rehearse-cleanup.sh writes one to ../backups/ on every run).

drop index invoices_number_unique;
