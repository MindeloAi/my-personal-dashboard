-- 026_agreements.down.sql
--
-- Drops the care plan to retainer link and the clients' legal details. Any
-- saved addresses and signatories are lost.

drop index if exists documents_one_retainer_per_care_plan;
alter table documents drop constraint if exists documents_subscription_only_on_care_plans;
alter table documents drop column if exists subscription_id;
alter table clients drop column if exists signatory_title;
alter table clients drop column if exists signatory_name;
alter table clients drop column if exists address;
