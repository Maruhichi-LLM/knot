-- Ensure every group has Knot Calendar enabled
UPDATE "Group"
SET "enabledModules" = array_append("enabledModules", 'calendar')
WHERE NOT ('calendar' = ANY("enabledModules"));
