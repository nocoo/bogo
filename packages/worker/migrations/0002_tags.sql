-- 0002_tags.sql
-- Tag system: workspace-scoped tags with N:M assignment to documents and persons

PRAGMA foreign_keys = ON;

-- Tags: workspace-scoped, scope-typed
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('document', 'person')),
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, scope, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_workspace_scope_sort ON tags(workspace_id, scope, sort_order);

-- Tag-document assignments (N:M)
CREATE TABLE IF NOT EXISTS tag_documents (
  workspace_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (workspace_id, tag_id, document_id),
  FOREIGN KEY (workspace_id, tag_id) REFERENCES tags(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_documents_doc ON tag_documents(workspace_id, document_id);
CREATE INDEX IF NOT EXISTS idx_tag_documents_tag ON tag_documents(workspace_id, tag_id);

-- Tag-person assignments (N:M)
CREATE TABLE IF NOT EXISTS tag_persons (
  workspace_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (workspace_id, tag_id, person_id),
  FOREIGN KEY (workspace_id, tag_id) REFERENCES tags(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_persons_person ON tag_persons(workspace_id, person_id);
CREATE INDEX IF NOT EXISTS idx_tag_persons_tag ON tag_persons(workspace_id, tag_id);
