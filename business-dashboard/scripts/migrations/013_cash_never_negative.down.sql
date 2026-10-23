-- 013 down  Drop the never-negative cash guard. No data is stored by it.

drop trigger if exists cash_never_negative on cash_movements;
drop trigger if exists cash_never_negative on payments;
drop trigger if exists cash_never_negative on expenses;
drop trigger if exists cash_never_negative on payouts;
drop function if exists cash_never_negative();
