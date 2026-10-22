-- 011 down  Remove the founder ledger. DESTROYS every payment, payout, transfer
-- and count recorded since cutover. Invoice statuses set to Paid by payments
-- stay Paid.

drop view if exists owed_to_founders, founder_pay, owed_to_us, cash_check,
                    business_cash, cash_by_location, cash_flows;

drop trigger if exists invoices_lock_after_payment on invoices;
drop function if exists invoices_lock_after_payment();

drop table if exists payouts, payments, cash_movements, cash_counts;
drop function if exists on_payment_insert(), on_payment_delete();
drop sequence if exists payout_number_seq;

alter table expenses
  drop constraint if exists expenses_reimbursement,
  drop constraint if exists expenses_one_source,
  drop column if exists reimbursed_from,
  drop column if exists reimbursed_at,
  drop column if exists paid_personally_by,
  drop column if exists paid_from;

alter table invoices
  drop constraint if exists invoices_bonus_shares_total,
  drop column if exists zane_bonus_share,
  drop column if exists michael_bonus_share;

drop table if exists split_rules, ledger_settings;
