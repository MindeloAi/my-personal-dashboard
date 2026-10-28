-- 017 down  Shares lock again once paid. Correction payouts already made stay.
-- Contains $$, runs as one statement.

drop function change_bonus_shares(uuid, numeric, text);

create or replace function invoices_lock_after_payment() returns trigger
language plpgsql as $$
declare
  paid numeric := (select coalesce(sum(amount), 0) from payments where invoice_id = old.id);
begin
  if new.status = 'Paid' and old.status is distinct from 'Paid' and paid < new.amount then
    raise exception 'An invoice becomes paid by recording payments against it.';
  end if;
  if paid > 0 and (
       new.amount is distinct from old.amount
       or new.michael_bonus_share is distinct from old.michael_bonus_share
       or new.zane_bonus_share is distinct from old.zane_bonus_share) then
    raise exception 'This invoice has payments recorded, so its amount and bonus shares are locked. Delete the payments first to change them.';
  end if;
  if paid > 0 and new.status in ('Draft', 'Void') and new.status is distinct from old.status then
    raise exception 'This invoice has payments recorded, so it cannot be moved to %. Delete the payments first.', new.status;
  end if;
  return new;
end $$;
