-- 006 down  Restore the previous service type value.

update projects
   set service_type = 'AI Automation'
 where service_type = 'Automation'
returning id, name, service_type;
