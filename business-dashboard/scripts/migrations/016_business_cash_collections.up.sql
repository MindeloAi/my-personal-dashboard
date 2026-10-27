-- 016 up  Business cash replaces Vantage, and money moves can belong to a payment.
--
-- How money actually travels: a founder collects an invoice (often Zane), hands
-- it to Mikey, Mikey puts the business share in the safe ("business") and the
-- rest is the two founder payouts. Mikey/Zane pots are money in a founder's
-- hand that has not been sorted yet; the business pot is the safe.
--
-- No rows used 'vantage' when this was written; any that do become 'business'.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

-- ─── vantage -> business on every holder column ─────────────────────────────

alter table expenses       drop constraint expenses_paid_from_check,
                           drop constraint expenses_reimbursed_from_check;
alter table payments       drop constraint payments_received_by_check;
alter table payouts        drop constraint payouts_paid_from_check;
alter table cash_movements drop constraint cash_movements_from_loc_check,
                           drop constraint cash_movements_to_loc_check;
alter table cash_counts    drop constraint cash_counts_location_check;

update expenses       set paid_from = 'business'       where paid_from = 'vantage';
update expenses       set reimbursed_from = 'business' where reimbursed_from = 'vantage';
update payments       set received_by = 'business'     where received_by = 'vantage';
update payouts        set paid_from = 'business'       where paid_from = 'vantage';
update cash_movements set from_loc = 'business'        where from_loc = 'vantage';
update cash_movements set to_loc = 'business'          where to_loc = 'vantage';
update cash_counts    set location = 'business'        where location = 'vantage';
-- Run the deferred cash_never_negative checks now, on the renamed end state:
-- ALTER TABLE refuses a table with trigger events still pending.
set constraints all immediate;

alter table expenses
  add constraint expenses_paid_from_check check (paid_from in ('mikey','zane','business')),
  add constraint expenses_reimbursed_from_check check (reimbursed_from in ('mikey','zane','business'));
alter table payments
  add constraint payments_received_by_check check (received_by in ('mikey','zane','business'));
alter table payouts
  add constraint payouts_paid_from_check check (paid_from in ('mikey','zane','business'));
alter table cash_movements
  add constraint cash_movements_from_loc_check check (from_loc in ('mikey','zane','business')),
  add constraint cash_movements_to_loc_check check (to_loc in ('mikey','zane','business'));
alter table cash_counts
  add constraint cash_counts_location_check check (location in ('mikey','zane','business'));

create or replace view cash_by_location with (security_invoker = on) as
  select l.location, coalesce(sum(f.amount), 0)::numeric(12,2) as balance
    from (values (1, 'mikey'), (2, 'zane'), (3, 'business')) l(ord, location)
    left join cash_flows f on f.location = l.location
   group by l.ord, l.location
   order by l.ord;

drop view business_cash;
create view business_cash with (security_invoker = on) as
  select sum(balance)::numeric(12,2)                                    as total,
         coalesce(sum(balance) filter (where location = 'mikey'), 0)    as mikey,
         coalesce(sum(balance) filter (where location = 'zane'), 0)     as zane,
         coalesce(sum(balance) filter (where location = 'business'), 0) as business
    from cash_by_location;

-- ─── Transfers that belong to a payment ─────────────────────────────────────
--
-- Zane handing a collection to Mikey, or Mikey putting its business share in
-- the safe. Deleting the payment (a correction) takes its transfers with it.

alter table cash_movements
  add column payment_id uuid references payments(id) on delete cascade,
  add constraint cash_movements_payment_transfer check (payment_id is null or kind = 'transfer');
create index cash_movements_payment_id_idx on cash_movements (payment_id);

-- A payment cannot send more to any one place than it brought in. Catches a
-- double click or a second "Put in business cash" on the same collection.
create function cash_movements_payment_cap() returns trigger
language plpgsql as $$
declare
  pay   payments%rowtype;
  moved numeric;
begin
  if new.payment_id is null then
    return null;
  end if;
  select * into pay from payments where id = new.payment_id for update;
  select sum(amount) into moved from cash_movements
   where payment_id = new.payment_id and to_loc = new.to_loc;
  if moved > pay.amount then
    raise exception 'That moves TT$% to % for a payment of TT$%.',
      to_char(moved, 'FM999,999,990.00'), initcap(new.to_loc), to_char(pay.amount, 'FM999,999,990.00');
  end if;
  return null;
end $$;

create trigger cash_movements_payment_cap
  after insert or update on cash_movements
  for each row execute function cash_movements_payment_cap();

-- ─── collections: one row per payment, where its money should go ────────────
--
-- business_share = the payment minus both founder payouts (what the safe keeps).
-- handover_due   = what Zane still has to pass to Mikey for a payment he took.
-- business_due   = business share not yet in the safe. Paid straight into the
--                  business, it is there already.

create view collections with (security_invoker = on) as
  select p.id as payment_id,
         p.invoice_id,
         p.paid_at,
         p.amount,
         p.received_by,
         p.method,
         p.note,
         p.created_by,
         i.invoice_number,
         i.notes as invoice_notes,
         coalesce(nullif(c.company, ''), c.name) as client,
         pr.name as project,
         coalesce(po.michael, 0)::numeric(12,2) as michael_payout,
         coalesce(po.zane, 0)::numeric(12,2)    as zane_payout,
         (p.amount - coalesce(po.michael, 0) - coalesce(po.zane, 0))::numeric(12,2) as business_share,
         case when p.received_by = 'zane'
              then p.amount - coalesce(m.to_mikey, 0) else 0 end::numeric(12,2)    as handover_due,
         greatest(
           (p.amount - coalesce(po.michael, 0) - coalesce(po.zane, 0))
             - case when p.received_by = 'business' then p.amount else coalesce(m.to_business, 0) end,
           0)::numeric(12,2) as business_due
    from payments p
    join invoices i on i.id = p.invoice_id
    left join projects pr on pr.id = i.project_id
    left join clients c on c.id = coalesce(i.client_id, pr.client_id)
    left join (
      select payment_id,
             sum(total) filter (where founder = 'michael') as michael,
             sum(total) filter (where founder = 'zane')    as zane
        from payouts group by payment_id
    ) po on po.payment_id = p.id
    left join (
      select payment_id,
             sum(amount) filter (where to_loc = 'mikey')    as to_mikey,
             sum(amount) filter (where to_loc = 'business') as to_business
        from cash_movements where payment_id is not null group by payment_id
    ) m on m.payment_id = p.id;

revoke all on business_cash, cash_by_location, collections from anon, authenticated;
revoke execute on function cash_movements_payment_cap() from public, anon, authenticated;
