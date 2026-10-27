-- 016 down  Back to Vantage, and transfers lose their payment link.
-- Linked transfers stay as plain transfers. Contains $$, runs as one statement.

drop view collections;
drop trigger cash_movements_payment_cap on cash_movements;
drop function cash_movements_payment_cap();
alter table cash_movements drop constraint cash_movements_payment_transfer;
drop index cash_movements_payment_id_idx;
alter table cash_movements drop column payment_id;

alter table expenses       drop constraint expenses_paid_from_check,
                           drop constraint expenses_reimbursed_from_check;
alter table payments       drop constraint payments_received_by_check;
alter table payouts        drop constraint payouts_paid_from_check;
alter table cash_movements drop constraint cash_movements_from_loc_check,
                           drop constraint cash_movements_to_loc_check;
alter table cash_counts    drop constraint cash_counts_location_check;

update expenses       set paid_from = 'vantage'       where paid_from = 'business';
update expenses       set reimbursed_from = 'vantage' where reimbursed_from = 'business';
update payments       set received_by = 'vantage'     where received_by = 'business';
update payouts        set paid_from = 'vantage'       where paid_from = 'business';
update cash_movements set from_loc = 'vantage'        where from_loc = 'business';
update cash_movements set to_loc = 'vantage'          where to_loc = 'business';
update cash_counts    set location = 'vantage'        where location = 'business';
-- ALTER TABLE refuses a table with deferred trigger events still pending.
set constraints all immediate;

alter table expenses
  add constraint expenses_paid_from_check check (paid_from in ('mikey','zane','vantage')),
  add constraint expenses_reimbursed_from_check check (reimbursed_from in ('mikey','zane','vantage'));
alter table payments
  add constraint payments_received_by_check check (received_by in ('mikey','zane','vantage'));
alter table payouts
  add constraint payouts_paid_from_check check (paid_from in ('mikey','zane','vantage'));
alter table cash_movements
  add constraint cash_movements_from_loc_check check (from_loc in ('mikey','zane','vantage')),
  add constraint cash_movements_to_loc_check check (to_loc in ('mikey','zane','vantage'));
alter table cash_counts
  add constraint cash_counts_location_check check (location in ('mikey','zane','vantage'));

create or replace view cash_by_location with (security_invoker = on) as
  select l.location, coalesce(sum(f.amount), 0)::numeric(12,2) as balance
    from (values (1, 'mikey'), (2, 'zane'), (3, 'vantage')) l(ord, location)
    left join cash_flows f on f.location = l.location
   group by l.ord, l.location
   order by l.ord;

drop view business_cash;
create view business_cash with (security_invoker = on) as
  select sum(balance)::numeric(12,2)                                   as total,
         coalesce(sum(balance) filter (where location = 'mikey'), 0)   as mikey,
         coalesce(sum(balance) filter (where location = 'zane'), 0)    as zane,
         coalesce(sum(balance) filter (where location = 'vantage'), 0) as vantage
    from cash_by_location;

revoke all on business_cash, cash_by_location from anon, authenticated;
