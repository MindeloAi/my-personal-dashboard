-- 023_files_bucket.down.sql — only succeeds when the bucket is empty.
delete from storage.buckets where id = 'files';
