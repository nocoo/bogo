-- 0009_rename_default_view.sql
-- Rename only the workspace **default** view named "Default" → "All People".
-- Non-default user views that happen to be named "Default" are left alone.

UPDATE person_table_views
SET
  name = 'All People',
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE name = 'Default'
  AND is_default = 1
  AND NOT EXISTS (
    SELECT 1
    FROM person_table_views other
    WHERE other.workspace_id = person_table_views.workspace_id
      AND other.name = 'All People'
      AND other.id != person_table_views.id
  );
