-- 012 up  Projected founder earnings from unpaid invoices.
--
-- One row per unpaid invoice (Sent or Overdue, overdue counted at full value):
-- its remaining balance split exactly as on_payment_insert would split it if
-- paid today, under today's split rule. Invoices without bonus shares still
-- project their base; their bonus pool is reported as unassigned until the
-- shares are set.
--
-- Projects the remaining balance as one payment. A real balance paid in parts
-- rounds each part separately, so it can differ from this by a cent or two.

create view founder_projection with (security_invoker = on) as
  with rule as (
    select * from split_rules
     where effective_from <= current_date
     order by effective_from desc limit 1
  ),
  owed as (
    select o.invoice_id, o.invoice_number, o.due_date, o.status, o.remaining,
           i.michael_bonus_share as share
      from owed_to_us o
      join invoices i on i.id = o.invoice_id
     where o.remaining > 0
  ),
  split as (
    select owed.*,
           round(remaining * rule.bonus_pool_pct, 2) as pool,
           remaining - round(remaining * rule.bonus_pool_pct, 2) as alloc,
           rule.michael_base_pct, rule.zane_base_pct
      from owed, rule
  )
  select invoice_id, invoice_number, due_date, status, remaining,
         round(alloc * michael_base_pct, 2)::numeric(12,2)              as michael_base,
         round(alloc * zane_base_pct, 2)::numeric(12,2)                 as zane_base,
         round(pool * share, 2)::numeric(12,2)                          as michael_bonus,
         (pool - round(pool * share, 2))::numeric(12,2)                 as zane_bonus,
         (case when share is null then pool else 0 end)::numeric(12,2)  as unassigned_bonus,
         (round(alloc * michael_base_pct, 2) + coalesce(round(pool * share, 2), 0))::numeric(12,2)        as michael_total,
         (round(alloc * zane_base_pct, 2) + coalesce(pool - round(pool * share, 2), 0))::numeric(12,2)    as zane_total
    from split;

revoke all on founder_projection from anon, authenticated;
