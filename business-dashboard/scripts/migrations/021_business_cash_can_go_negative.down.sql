-- 021 down  Back to 013: no pot, the safe included, may go below zero.
-- Fails at the next write while the safe is negative; top it up first.

create or replace function cash_never_negative() returns trigger
language plpgsql as $$
declare
  bad record;
begin
  select location, balance into bad
    from cash_by_location
   where balance < 0
   limit 1;
  if found then
    raise exception 'That would leave % cash at TT$%. Check who actually paid, or record the transfer to them first.',
      initcap(bad.location), bad.balance;
  end if;
  return null;
end $$;
