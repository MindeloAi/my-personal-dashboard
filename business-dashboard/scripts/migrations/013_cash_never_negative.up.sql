-- 013 up  Nobody's business cash can go below zero.
--
-- A pot is real money in someone's hand or account, so a negative balance is
-- always a data-entry slip: PAY-0001/0002 were recorded as paid out "from Zane"
-- when Mikey paid them, which showed Zane at TT$-999.
--
-- Deferred to commit, so a transaction that moves money out and back in (or a
-- correction that edits two rows) is judged on where it ends up. Checks every
-- pot, not just the one touched: deleting a transfer INTO a pot is a write to
-- cash_movements that can empty it.

create function cash_never_negative() returns trigger
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

create constraint trigger cash_never_negative after insert or update or delete on cash_movements
  deferrable initially deferred for each row execute function cash_never_negative();
create constraint trigger cash_never_negative after insert or update or delete on payments
  deferrable initially deferred for each row execute function cash_never_negative();
create constraint trigger cash_never_negative after insert or update or delete on expenses
  deferrable initially deferred for each row execute function cash_never_negative();
create constraint trigger cash_never_negative after insert or update or delete on payouts
  deferrable initially deferred for each row execute function cash_never_negative();

revoke execute on function cash_never_negative() from public, anon, authenticated;
