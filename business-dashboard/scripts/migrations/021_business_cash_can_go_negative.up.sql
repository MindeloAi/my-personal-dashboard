-- 021 up  Business cash (the safe) may go below zero.
--
-- The company pays its expenses out of business cash, full stop, even when the
-- safe does not hold enough yet: a negative safe means "the business owes the
-- pot this much", and a transfer in tops it back up. Mikey's and Zane's pots
-- are still guarded, since money in a founder's hand cannot be negative (the
-- PAY-0001/0002 slip that 013 was written for).

create or replace function cash_never_negative() returns trigger
language plpgsql as $$
declare
  bad record;
begin
  select location, balance into bad
    from cash_by_location
   where balance < 0 and location <> 'business'
   limit 1;
  if found then
    raise exception 'That would leave % cash at TT$%. Check who actually paid, or record the transfer to them first.',
      initcap(bad.location), bad.balance;
  end if;
  return null;
end $$;
