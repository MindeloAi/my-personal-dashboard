-- 019 down  Numbers are typed by hand again. leads.client_id is kept: it
-- existed in production before 019. Plain statements only.

drop trigger invoices_number on invoices;
drop function invoices_number();
alter table projects drop column lead_id, drop column internal;
