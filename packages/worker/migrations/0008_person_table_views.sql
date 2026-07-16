-- 0008_person_table_views.sql
-- Workspace-scoped named table views for People (column layout + sort + filters).

CREATE TABLE person_table_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  sort_json TEXT,
  filters_json TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);

CREATE INDEX idx_ptv_workspace_sort
  ON person_table_views(workspace_id, sort_order);

CREATE UNIQUE INDEX idx_ptv_workspace_default
  ON person_table_views(workspace_id)
  WHERE is_default = 1;

-- Backfill Default view for existing workspaces that have none.
INSERT INTO person_table_views (
  id, workspace_id, name, columns_json, sort_json, filters_json,
  is_default, sort_order, created_at, updated_at
)
SELECT
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  ),
  w.id,
  'Default',
  '["builtin:name","builtin:title","builtin:managerId"]',
  NULL,
  '[]',
  1,
  0,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM person_table_views v WHERE v.workspace_id = w.id
);
