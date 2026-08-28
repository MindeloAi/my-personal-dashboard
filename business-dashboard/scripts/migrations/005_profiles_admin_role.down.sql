-- 005 down  Drop the profiles table.
--
-- Does not touch auth.users. Removing a profile row revokes a founder's admin role
-- but leaves their login intact, which would leave them authenticated with no
-- authorisation. Only run this if you are also removing the auth check that reads it.

drop table if exists profiles;
