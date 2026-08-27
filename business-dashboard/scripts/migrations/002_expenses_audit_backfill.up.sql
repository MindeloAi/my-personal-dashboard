-- 002 up — backfill usd_amount and reference from the August 2026
-- reconciliation notes.
--
-- Notes from that reconciliation carry a canonical shape, e.g.
--   "monthly build credits | USD 17.00 @ 7.0 | Ref CISZDY-00006"
--
-- STRICT PARSE, DELIBERATELY. usd_amount is only taken from "USD <n> @",
-- i.e. a figure immediately followed by the conversion-rate marker. A looser
-- "any USD <number>" match would write values that are provably wrong:
--
--   Anthropic TTD 700   note cites "USD 20 Pro on 15 Apr" — a DIFFERENT charge
--   subscriptions 1400  note says "totals USD 57.99 … this row is NOT a bundle"
--   domains TTD 210     two 14.99 line items; the real total is 29.98
--   Anthropic TTD 140   truly USD 20.00 but written in prose, not "@" form
--   Netlify TTD 68      "receipt shows USD 9.00" but 68/9 = 7.55, rate fails
--
-- Those five are left NULL for a human to fill in. Three of them are rows the
-- notes themselves flag AWAITING DECISION, so inventing a USD figure for them
-- would be exactly the wrong thing for an audit trail to do.
--
-- `reference` parses "Ref <token>" and is safe across all shapes present,
-- including the bare-numeric form "Ref 2491-0074-2972".
--
-- Idempotent: both updates skip rows that already have a value, so re-running
-- changes nothing and never overwrites a hand-entered figure.
--
-- NOTHING HERE TOUCHES `amount`, `notes`, or any other existing column.

update expenses
   set usd_amount = (substring(notes from '\mUSD\s+([0-9]+(?:\.[0-9]+)?)\s*@'))::numeric(10,2)
 where usd_amount is null
   and notes ~ '\mUSD\s+[0-9]+(?:\.[0-9]+)?\s*@'
returning name, date, amount as ttd_amount, usd_amount;

update expenses
   set reference = substring(notes from '\mRef\s+([A-Za-z0-9][A-Za-z0-9-]*)')
 where reference is null
   and notes ~ '\mRef\s+[A-Za-z0-9]'
returning name, date, reference;
