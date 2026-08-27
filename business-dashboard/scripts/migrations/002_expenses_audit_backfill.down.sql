-- 002 down — reverse the backfill, without destroying hand-entered values.
--
-- A blanket `set usd_amount = null` would also wipe figures a human added
-- afterwards (for instance the five rows 002.up deliberately skipped). So each
-- update clears a column ONLY where its current value still equals exactly what
-- the backfill would have parsed out of the notes. Anything edited by hand, or
-- filled in for a row the backfill skipped, survives.
--
-- The notes text is not modified — 002.up never changed it either.

update expenses
   set usd_amount = null
 where usd_amount is not null
   and notes ~ '\mUSD\s+[0-9]+(?:\.[0-9]+)?\s*@'
   and usd_amount = (substring(notes from '\mUSD\s+([0-9]+(?:\.[0-9]+)?)\s*@'))::numeric(10,2)
returning name, date, amount as ttd_amount;

update expenses
   set reference = null
 where reference is not null
   and notes ~ '\mRef\s+[A-Za-z0-9]'
   and reference = substring(notes from '\mRef\s+([A-Za-z0-9][A-Za-z0-9-]*)')
returning name, date;
