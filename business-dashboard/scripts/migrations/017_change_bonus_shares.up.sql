-- 017 up  Change an invoice's bonus split after payments are recorded.
--
-- Only the bonus pool moves; base pay and the business share never change, so
-- cash is untouched until someone actually pays a difference. Per payment:
-- the pool is the sum of its payouts' bonuses (always the 10% it was split
-- with), re-divided by the new share. A founder's change lands on his newest
-- due payout for that payment; if all of his are paid out, it becomes a new
-- correction payout (base 0, bonus = the difference), which is NEGATIVE when
-- he was overpaid: "pay back TT$X". Marking that paid out puts the money back
-- in the pot it is returned to.
--
-- Contains plpgsql bodies, so run-migration.mjs executes it as one statement.

-- The lock from 011, now letting change_bonus_shares() through.
create or replace function invoices_lock_after_payment() returns trigger
language plpgsql as $$
declare
  paid numeric := (select coalesce(sum(amount), 0) from payments where invoice_id = old.id);
begin
  if new.status = 'Paid' and old.status is distinct from 'Paid' and paid < new.amount then
    raise exception 'An invoice becomes paid by recording payments against it.';
  end if;
  if paid > 0 and new.amount is distinct from old.amount then
    raise exception 'This invoice has payments recorded, so its amount is locked. Delete the payments first to change it.';
  end if;
  if paid > 0
     and coalesce(current_setting('ledger.reshare', true), '') <> 'on'
     and (new.michael_bonus_share is distinct from old.michael_bonus_share
          or new.zane_bonus_share is distinct from old.zane_bonus_share) then
    raise exception 'This invoice has payments recorded. Change its bonus split with Change split, which corrects the payouts too.';
  end if;
  if paid > 0 and new.status in ('Draft', 'Void') and new.status is distinct from old.status then
    raise exception 'This invoice has payments recorded, so it cannot be moved to %. Delete the payments first.', new.status;
  end if;
  return new;
end $$;

create function change_bonus_shares(inv_id uuid, m_share numeric, actor text) returns void
language plpgsql as $$
declare
  pay     record;
  f       text;
  pool    numeric(12,2);
  m_new   numeric(12,2);
  target  numeric(12,2);
  cur     numeric(12,2);
  rv      int;
  due_id  uuid;
begin
  if m_share is null or m_share < 0 or m_share > 1 then
    raise exception 'Bonus shares must be between 0%% and 100%%.';
  end if;

  perform set_config('ledger.reshare', 'on', true);
  update invoices set michael_bonus_share = m_share, zane_bonus_share = 1 - m_share where id = inv_id;
  if not found then
    raise exception 'That invoice no longer exists.';
  end if;
  perform set_config('ledger.reshare', 'off', true);

  for pay in select id from payments where invoice_id = inv_id order by created_at loop
    select coalesce(sum(bonus), 0), max(rule_version) into pool, rv from payouts where payment_id = pay.id;
    m_new := round(pool * m_share, 2);  -- same rounding as on_payment_insert
    foreach f in array array['michael', 'zane'] loop
      target := case when f = 'michael' then m_new else pool - m_new end;
      select coalesce(sum(bonus), 0) into cur from payouts where payment_id = pay.id and founder = f;
      continue when target = cur;

      due_id := null;
      select id into due_id from payouts
       where payment_id = pay.id and founder = f and status = 'due'
       order by number desc limit 1;
      if due_id is not null then
        update payouts set bonus = bonus + (target - cur) where id = due_id;
        delete from payouts where id = due_id and base = 0 and bonus = 0;  -- a cancelled-out correction
      else
        insert into payouts (number, founder, invoice_id, payment_id, rule_version, base, bonus, created_by)
        values ('PAY-' || lpad(nextval('payout_number_seq')::text, 4, '0'),
                f, inv_id, pay.id, coalesce(rv, 1), 0, target - cur, actor);
      end if;
    end loop;
  end loop;
end $$;

revoke execute on function change_bonus_shares(uuid, numeric, text) from public, anon, authenticated;
