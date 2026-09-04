-- 007_subscriptions.down.sql — reverses 007_subscriptions.up.sql.
--
-- Destructive: dropping the table destroys every recurring revenue record, and
-- dropping invoices.subscription_id destroys the link that derives each
-- subscription's next invoice date. Invoices themselves survive.

alter table invoices drop column if exists subscription_id;
drop table    if exists subscriptions;
drop sequence if exists subscriptions_sort_seq;
