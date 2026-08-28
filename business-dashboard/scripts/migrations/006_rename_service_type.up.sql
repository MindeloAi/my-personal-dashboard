-- 006 up  Rename the "AI Automation" service type to "Automation".
--
-- Mindelo does not lead with AI in public-facing material, and this value is
-- rendered in the project board, the service-type split and the create/edit
-- dropdowns. The UI options were renamed in the same change; without this the one
-- existing row would no longer match any option and would fall through the colour
-- map as an unknown category.
--
-- service_type is free text with no CHECK constraint, so this is a plain update
-- rather than a constraint change. One row is affected.

update projects
   set service_type = 'Automation'
 where service_type = 'AI Automation'
returning id, name, service_type;
