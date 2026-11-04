-- 022_documents.down.sql — drops everything 022 created. Destroys deal,
-- document, attachment metadata and activity rows. Storage files are untouched.
drop table if exists activity;
drop table if exists attachments;
drop table if exists document_versions;
drop table if exists documents;
drop table if exists deals;
drop function if exists activity_append_only();
drop function if exists documents_final_states();
drop function if exists document_versions_frozen();
drop function if exists schedule_total(jsonb);
