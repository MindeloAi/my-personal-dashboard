-- 018 up  Zane keeps his share of what he collects and hands Mikey the rest.
--
-- 016 had him hand over the whole payment. In practice he keeps his payout
-- (marked paid out from Zane) and sends Mikey everything else, so:
--   handover_due = amount - zane's payouts - what he has already handed over.
-- Same columns as 016, so the view is replaced in place.

create or replace view collections with (security_invoker = on) as
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
              then greatest(p.amount - coalesce(po.zane, 0) - coalesce(m.to_mikey, 0), 0)
              else 0 end::numeric(12,2) as handover_due,
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

revoke all on collections from anon, authenticated;
