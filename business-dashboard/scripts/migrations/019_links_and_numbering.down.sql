-- 019 down  Numbers are typed by hand again. leads.client_id is kept: it
-- existed in production before 019. Plain statements only.
-- WARNING: after 020 has run, dropping projects.lead_id loses the lead links of
-- six projects (Collabr, Fresh Start, PBS, Zkn, Five Islands, Aeromarine).
-- Restore 020's data from the pre-apply backup first.

drop trigger invoices_number on invoices;
drop function invoices_number();
alter table projects drop column lead_id, drop column internal;
