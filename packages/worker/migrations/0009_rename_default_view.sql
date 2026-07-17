-- 0009_rename_default_view.sql
-- Rename seeded view "Default" → "All People" (skip if name already taken).

UPDATE person_table_views
SET
  name = 'All People',
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE name = 'Default'
  AND NOT EXISTS (
    SELECT 1
    FROM person_table_views other
    WHERE other.workspace_id = person_table_views.workspace_id
      AND other.name = 'All People'
      AND other.id != person_table_views.id
  );
