-- 026_agreements.up.sql
--
-- Service agreements, care plans and change requests.
-- Clients get the legal details an agreement needs: registered address and
-- who signs for them. A care plan links to the retainer subscription it
-- started, once, so a second start is refused.

alter table clients add column if not exists address text;
alter table clients add column if not exists signatory_name text;
alter table clients add column if not exists signatory_title text;
alter table documents add column if not exists subscription_id uuid references subscriptions(id) on delete set null;
alter table documents drop constraint if exists documents_subscription_only_on_care_plans;
alter table documents add constraint documents_subscription_only_on_care_plans check (type = 'care_plan' or subscription_id is null);
create unique index if not exists documents_one_retainer_per_care_plan on documents (subscription_id) where subscription_id is not null;
