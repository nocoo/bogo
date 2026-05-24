-- 0001_initial.sql
-- Full schema for Bogo: workspaces, persons, custom fields, documents

PRAGMA foreign_keys = ON;

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- Persons (org tree)
CREATE TABLE IF NOT EXISTS persons (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  manager_id TEXT,
  dotted_manager_id TEXT,
  is_root INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (id),
  UNIQUE (workspace_id, id),
  CHECK ((is_root = 1 AND manager_id IS NULL) OR (is_root = 0 AND manager_id IS NOT NULL)),
  FOREIGN KEY (workspace_id, manager_id) REFERENCES persons(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, dotted_manager_id) REFERENCES persons(workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_persons_workspace ON persons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_persons_manager ON persons(workspace_id, manager_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_root_unique ON persons(workspace_id) WHERE is_root = 1;

-- Custom field definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (id),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cfd_workspace ON custom_field_definitions(workspace_id);

-- Custom field values
CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  field_def_id TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  UNIQUE (person_id, field_def_id),
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, field_def_id) REFERENCES custom_field_definitions(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cfv_person ON custom_field_values(person_id);
CREATE INDEX IF NOT EXISTS idx_cfv_field_def ON custom_field_values(field_def_id);

-- Document types
CREATE TABLE IF NOT EXISTS document_types (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (id),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_doctypes_workspace ON document_types(workspace_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  event_date TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (id),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, type_id) REFERENCES document_types(workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(workspace_id, type_id);
CREATE INDEX IF NOT EXISTS idx_documents_event_date ON documents(workspace_id, event_date);

-- Document versions (immutable, append-only)
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_docversions_document ON document_versions(document_id);

-- Document-person associations (N:M)
CREATE TABLE IF NOT EXISTS document_persons (
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'subject',
  PRIMARY KEY (document_id, person_id),
  FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_docpersons_person ON document_persons(workspace_id, person_id);
