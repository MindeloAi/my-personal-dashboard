-- 011 up  Founder ledger. Replaces the Airtable "Mindelo Ledger" base.
--
-- This database is the only source of truth for money from the cutover date
-- (22 Oct 2026). Nothing before it is imported or reconciled; invoices already
-- Paid at cutover get no payments and no payouts.
--
-- All money arithmetic lives here. The app may preview a split in TypeScript,
-- but every saved figure comes from on_payment_insert().
--
-- Access: the app connects as `postgres` (rolbypassrls), so RLS never applies
-- to it. New tables get RLS with no policies and lose every anon/authenticated
-- grant, same as migration 004. Views are security_invoker so they cannot
-- leak the tables underneath through PostgREST.
--
-- Contains plpgsql bodies, so run-migration.mjs executes it as one statement.

-- ─── Settings and split rules ────────────────────────────────────────────────

create table ledger_settings (
  id           boolean primary key default true check (id),
  cutover_date date not null
);
insert into ledger_settings (cutover_date) values ('2026-10-22');

-- Changing a percentage = insert a new version with a later effective_from.
-- Payments pick the latest rule on or before their paid_at, so old payouts
-- keep the rule they were made under.
create table split_rules (
  version          int primary key,
  effective_from   date not null unique,
  bonus_pool_pct   numeric(5,4) not null,
  michael_base_pct numeric(5,4) not null,
  zane_base_pct    numeric(5,4) not null
);
insert into split_rules values (1, '2026-10-22', 0.10, 0.15, 0.15);

-- ─── Columns on existing tables (nullable only, no existing row changes) ─────

alter table invoices
  add column michael_bonus_share numeric(5,4),
  add column zane_bonus_share    numeric(5,4),
  add constraint invoices_bonus_shares_total check (
    (michael_bonus_share is null and zane_bonus_share is null)
    or michael_bonus_share + zane_bonus_share = 1
  );

alter table expenses
  add column paid_from text check (paid_from in ('mikey','zane','vantage')),
  add column paid_personally_by text check (paid_personally_by in ('michael','zane')),
  add column reimbursed_at date,
  add column reimbursed_from text check (reimbursed_from in ('mikey','zane','vantage')),
  add constraint expenses_one_source check (paid_from is null or paid_personally_by is null),
  add constraint expenses_reimbursement check (
    reimbursed_at is null or (paid_personally_by is not null and reimbursed_from is not null)
  );

-- ─── Ledger tables ───────────────────────────────────────────────────────────

create table payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  paid_at     date not null,
  received_by text not null check (received_by in ('mikey','zane','vantage')),
  method      text check (method in ('Bank','PayPal','Stripe','Cash','Other')),
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index payments_invoice_id_idx on payments (invoice_id);

create sequence payout_number_seq;

create table payouts (
  id           uuid primary key default gen_random_uuid(),
  number       text unique not null,
  founder      text not null check (founder in ('michael','zane')),
  invoice_id   uuid not null references invoices(id),
  payment_id   uuid not null references payments(id) on delete cascade,
  rule_version int not null references split_rules(version),
  base         numeric(12,2) not null,
  bonus        numeric(12,2) not null,
  total        numeric(12,2) generated always as (base + bonus) stored,
  status       text not null default 'due' check (status in ('due','paid_out')),
  paid_out_at  date,
  paid_from    text check (paid_from in ('mikey','zane','vantage')),
  created_by   text,
  created_at   timestamptz not null default now(),
  check (status = 'due' or (paid_out_at is not null and paid_from is not null))
);
create index payouts_payment_id_idx on payouts (payment_id);
create index payouts_invoice_id_idx on payouts (invoice_id);

create table cash_movements (
  id         uuid primary key default gen_random_uuid(),
  moved_at   date not null,
  kind       text not null check (kind in ('opening','transfer')),
  from_loc   text check (from_loc in ('mikey','zane','vantage')),
  to_loc     text check (to_loc in ('mikey','zane','vantage')),
  amount     numeric(12,2) not null check (amount > 0),
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  check (kind <> 'transfer' or (from_loc is not null and to_loc is not null and from_loc <> to_loc))
);
insert into cash_movements (moved_at, kind, to_loc, amount, note)
values ('2026-10-22', 'opening', 'mikey', 1200, 'Cutover opening balance');

create table cash_counts (
  id         uuid primary key default gen_random_uuid(),
  counted_at date not null,
  location   text not null check (location in ('mikey','zane','vantage')),
  amount     numeric(12,2) not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now()
);
insert into cash_counts (counted_at, location, amount, note)
values ('2026-10-22', 'mikey', 1200, 'Cutover count');

-- ─── on_payment_insert: validate, split, create payouts, close the invoice ───
--
-- AFTER INSERT, so the payment being inserted is already in the sum. Any
-- exception rolls the payment back. The invoice row is locked first so two
-- payments recorded at the same moment cannot both pass the overpay check.
-- Messages are shown to the user verbatim (errcode P0001).

create function on_payment_insert() returns trigger
language plpgsql as $$
declare
  inv        invoices%rowtype;
  cutover    date;
  paid_total numeric;
  rule       split_rules%rowtype;
  pool       numeric(12,2);
  alloc      numeric(12,2);
  m_base     numeric(12,2);
  z_base     numeric(12,2);
  m_bonus    numeric(12,2);
  z_bonus    numeric(12,2);
begin
  select cutover_date into cutover from ledger_settings;
  if new.paid_at < cutover then
    raise exception 'Payments dated before % cannot be recorded. That period is archived.',
      to_char(cutover, 'FMDD Mon YYYY');
  end if;

  select * into inv from invoices where id = new.invoice_id for update;
  if inv.status = 'Void' then
    raise exception 'This invoice is void, so it cannot take a payment.';
  end if;
  if inv.status = 'Paid' and not exists (
    select 1 from payments where invoice_id = inv.id and id <> new.id
  ) then
    raise exception 'This invoice was already paid before the ledger started.';
  end if;
  if inv.michael_bonus_share is null or inv.zane_bonus_share is null then
    raise exception 'Set the bonus shares on this invoice before recording a payment.';
  end if;
  if inv.amount is null then
    raise exception 'This invoice has no amount.';
  end if;

  select sum(amount) into paid_total from payments where invoice_id = inv.id;
  if paid_total > inv.amount then
    raise exception 'That is TT$% more than the TT$% still owed on this invoice.',
      to_char(paid_total - inv.amount, 'FM999,999,990.00'),
      to_char(inv.amount - (paid_total - new.amount), 'FM999,999,990.00');
  end if;

  select * into rule from split_rules
   where effective_from <= new.paid_at
   order by effective_from desc limit 1;
  if not found then
    raise exception 'No split rule covers %.', new.paid_at;
  end if;

  pool    := round(new.amount * rule.bonus_pool_pct, 2);
  alloc   := new.amount - pool;
  m_base  := round(alloc * rule.michael_base_pct, 2);
  z_base  := round(alloc * rule.zane_base_pct, 2);
  m_bonus := round(pool * inv.michael_bonus_share, 2);
  z_bonus := pool - m_bonus;  -- remainder, so the lines always sum to the payment

  if m_base + m_bonus > 0 then
    insert into payouts (number, founder, invoice_id, payment_id, rule_version, base, bonus, created_by)
    values ('PAY-' || lpad(nextval('payout_number_seq')::text, 4, '0'),
            'michael', inv.id, new.id, rule.version, m_base, m_bonus, new.created_by);
  end if;
  if z_base + z_bonus > 0 then
    insert into payouts (number, founder, invoice_id, payment_id, rule_version, base, bonus, created_by)
    values ('PAY-' || lpad(nextval('payout_number_seq')::text, 4, '0'),
            'zane', inv.id, new.id, rule.version, z_base, z_bonus, new.created_by);
  end if;

  if paid_total = inv.amount then
    update invoices
       set status = 'Paid', paid_date = new.paid_at, payment_method = new.method
     where id = inv.id;
  end if;

  return null;
end $$;

create trigger on_payment_insert
  after insert on payments
  for each row execute function on_payment_insert();

-- ─── on_payment_delete: correcting a mistaken payment ───────────────────────
--
-- Its payouts go with it (on delete cascade). If the payment had closed the
-- invoice, the invoice reopens as Sent. Only invoices that have had a payment
-- can get here, so invoices paid before cutover are never touched.

create function on_payment_delete() returns trigger
language plpgsql as $$
begin
  update invoices i
     set status = 'Sent', paid_date = null, payment_method = null
   where i.id = old.invoice_id
     and i.status = 'Paid'
     and coalesce((select sum(amount) from payments where invoice_id = i.id), 0) < i.amount;
  return null;
end $$;

create trigger on_payment_delete
  after delete on payments
  for each row execute function on_payment_delete();

-- ─── Guard invoices against edits that would break the ledger ───────────────
--
-- 1. Paid is reached only when payments cover the amount (on_payment_insert).
--    Anything else setting it would close an invoice with no payouts or cash.
-- 2. Once a payment exists, amount and shares are locked (the saved payouts
--    were split from them) and the invoice cannot go back to Draft or Void
--    (it would drop out of Owed to us while its money stays in cash).
--    To correct either, delete the payments first.

create function invoices_lock_after_payment() returns trigger
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

create trigger invoices_lock_after_payment
  before update on invoices
  for each row execute function invoices_lock_after_payment();

-- ─── Views ───────────────────────────────────────────────────────────────────

-- Every movement of business cash, signed, dated, per holder. A personally
-- paid expense only moves cash when it is reimbursed.
-- entered_at is when the row was recorded, where the table keeps it. The cash
-- check uses it to order a flow against a count made the same day.
create view cash_flows with (security_invoker = on) as
  select to_loc as location, moved_at as on_date, amount, created_at as entered_at
    from cash_movements where to_loc is not null
  union all
  select from_loc, moved_at, -amount, created_at
    from cash_movements where from_loc is not null
  union all
  select received_by, paid_at, amount, created_at
    from payments
  union all
  select e.paid_from, e.date, -coalesce(e.amount, 0), null::timestamptz
    from expenses e, ledger_settings s
   where e.paid_from is not null and e.date >= s.cutover_date
  union all
  select reimbursed_from, reimbursed_at, -coalesce(amount, 0), null
    from expenses where reimbursed_at is not null
  union all
  -- ponytail: the payout row's created_at, not when it was paid out. Exact for
  -- "Pay out founders now"; a same-day "Mark paid out" after a count is
  -- ordered as if before it. Add a paid_out_recorded_at column if that bites.
  select paid_from, paid_out_at, -total, created_at
    from payouts where status = 'paid_out';

create view cash_by_location with (security_invoker = on) as
  select l.location, coalesce(sum(f.amount), 0)::numeric(12,2) as balance
    from (values (1, 'mikey'), (2, 'zane'), (3, 'vantage')) l(ord, location)
    left join cash_flows f on f.location = l.location
   group by l.ord, l.location
   order by l.ord;

create view business_cash with (security_invoker = on) as
  select sum(balance)::numeric(12,2)                                   as total,
         coalesce(sum(balance) filter (where location = 'mikey'), 0)   as mikey,
         coalesce(sum(balance) filter (where location = 'zane'), 0)    as zane,
         coalesce(sum(balance) filter (where location = 'vantage'), 0) as vantage
    from cash_by_location;

-- Expected is computed AS AT the count: flows dated before the count day, plus
-- flows on that day entered before the count was. A payment recorded after
-- the count is not a shortfall until the next count. Expenses keep no entry
-- time, so a same-day expense always counts as before the count.
create view cash_check with (security_invoker = on) as
  select c.location,
         k.counted_at,
         k.amount as counted,
         e.expected,
         (k.amount - e.expected)::numeric(12,2) as variance,
         c.balance as expected_now
    from cash_by_location c
    left join lateral (
      select counted_at, amount, created_at from cash_counts
       where location = c.location
       order by counted_at desc, created_at desc limit 1
    ) k on true
    left join lateral (
      select coalesce(sum(f.amount), 0)::numeric(12,2) as expected
        from cash_flows f
       where f.location = c.location
         and (f.on_date < k.counted_at
              or (f.on_date = k.counted_at and (f.entered_at is null or f.entered_at <= k.created_at)))
    ) e on k.counted_at is not null;

create view owed_to_us with (security_invoker = on) as
  select i.id as invoice_id,
         i.invoice_number,
         i.status,
         i.due_date,
         i.amount,
         coalesce(p.paid, 0)::numeric(12,2)                      as paid,
         (i.amount - coalesce(p.paid, 0))::numeric(12,2)         as remaining,
         sum(i.amount - coalesce(p.paid, 0)) over ()::numeric(12,2) as total
    from invoices i
    left join (select invoice_id, sum(amount) as paid from payments group by invoice_id) p
      on p.invoice_id = i.id
   where i.status in ('Sent', 'Overdue');

-- Grouped by the month the client paid, which is when the payout was earned.
create view founder_pay with (security_invoker = on) as
  select po.founder,
         date_trunc('month', pm.paid_at)::date                                   as month,
         coalesce(sum(po.total) filter (where po.status = 'due'), 0)::numeric(12,2)      as due,
         coalesce(sum(po.total) filter (where po.status = 'paid_out'), 0)::numeric(12,2) as paid_out,
         sum(po.total)::numeric(12,2)                                            as total
    from payouts po
    join payments pm on pm.id = po.payment_id
   group by po.founder, date_trunc('month', pm.paid_at);

create view owed_to_founders with (security_invoker = on) as
  select f.founder, coalesce(sum(e.amount), 0)::numeric(12,2) as owed
    from (values ('michael'), ('zane')) f(founder)
    cross join ledger_settings s
    left join expenses e
      on e.paid_personally_by = f.founder
     and e.reimbursed_at is null
     and e.date >= s.cutover_date
   group by f.founder;

-- ─── Lock down (same as migration 004) ───────────────────────────────────────

alter table ledger_settings enable row level security;
alter table split_rules     enable row level security;
alter table payments        enable row level security;
alter table payouts         enable row level security;
alter table cash_movements  enable row level security;
alter table cash_counts     enable row level security;

revoke all on ledger_settings, split_rules, payments, payouts, cash_movements, cash_counts,
              cash_flows, cash_by_location, business_cash, cash_check, owed_to_us,
              founder_pay, owed_to_founders
  from anon, authenticated;
revoke all on sequence payout_number_seq from anon, authenticated;
revoke execute on function on_payment_insert(), on_payment_delete(), invoices_lock_after_payment()
  from public, anon, authenticated;
