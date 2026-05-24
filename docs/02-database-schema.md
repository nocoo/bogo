# 02 — Database Schema (D1)

## Overview

All tables live in a single Cloudflare D1 instance (`bogo`). Schema enforces workspace isolation, tree integrity, and version immutability at the database level.

## Tables

### workspaces

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
```

- `id`: UUIDv7 (text, 36 chars). Sortable by creation time.
- `owner_id`: CF Access `sub` claim (stable across email changes).

### persons

```sql
CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  manager_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  dotted_manager_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  is_root INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_persons_workspace ON persons(workspace_id);
CREATE INDEX idx_persons_manager ON persons(manager_id);
CREATE UNIQUE INDEX idx_persons_root_unique
  ON persons(workspace_id) WHERE is_root = 1;
```

**Root uniqueness**: The partial unique index on `(workspace_id) WHERE is_root = 1` guarantees exactly one root per workspace at the DB level.

**Self-reference constraint**: `manager_id` and `dotted_manager_id` reference the same table. D1 supports this via standard FK syntax.

### custom_field_definitions

```sql
CREATE TABLE custom_field_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_cfd_workspace ON custom_field_definitions(workspace_id);
CREATE UNIQUE INDEX idx_cfd_name_unique
  ON custom_field_definitions(workspace_id, name);
```

- `options`: JSON array string, only meaningful when `field_type = 'select'`.
- `required`: Boolean as integer (0/1). Enforced at API level, not DB level (values may be empty string).
- Name uniqueness scoped to workspace.

### custom_field_values

```sql
CREATE TABLE custom_field_values (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  field_def_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT '',
  UNIQUE (person_id, field_def_id)
);

CREATE INDEX idx_cfv_person ON custom_field_values(person_id);
CREATE INDEX idx_cfv_field_def ON custom_field_values(field_def_id);
```

- `value`: Always stored as text. Parsing/validation happens at API layer based on `field_type`.
- Composite unique constraint prevents duplicate field entries per person.

### document_types

```sql
CREATE TABLE document_types (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_doctypes_workspace ON document_types(workspace_id);
CREATE UNIQUE INDEX idx_doctypes_name_unique
  ON document_types(workspace_id, name);
```

### documents

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type_id TEXT REFERENCES document_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  event_date TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_type ON documents(type_id);
CREATE INDEX idx_documents_event_date ON documents(workspace_id, event_date);
```

- `content`: Current (latest) version's full Markdown.
- `event_date`: ISO 8601 date string (`YYYY-MM-DD`), NULL for evergreen documents.
- `version`: Monotonically increasing, starts at 1.

### document_versions

```sql
CREATE TABLE document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (document_id, version)
);

CREATE INDEX idx_docversions_document ON document_versions(document_id);
```

- Immutable: no UPDATE/DELETE operations exposed via API.
- Each edit to `documents.content` inserts a new row here with the previous state.

### document_persons

```sql
CREATE TABLE document_persons (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'subject',
  PRIMARY KEY (document_id, person_id)
);

CREATE INDEX idx_docpersons_person ON document_persons(person_id);
```

- Composite PK serves as the unique constraint.
- `role`: Application-defined (e.g. "subject", "attendee", "reviewer"). No CHECK constraint — extensible.

## Workspace Isolation Strategy

Every query MUST include `workspace_id` in its WHERE clause. Pattern:

```sql
-- Fetching persons for a workspace
SELECT * FROM persons WHERE workspace_id = ?;

-- Fetching documents with person filter (cross-table)
SELECT d.* FROM documents d
  JOIN document_persons dp ON dp.document_id = d.id
  JOIN persons p ON p.id = dp.person_id
WHERE d.workspace_id = ? AND p.id = ?;
```

**API-level enforcement**: The Worker extracts `workspace_id` from the authenticated session context and injects it into every D1 query. No endpoint accepts `workspace_id` as a user-supplied parameter.

## Tree Integrity — Cycle Prevention

D1 does not support recursive CTEs in triggers, so cycle detection is enforced at the **API layer** before any `INSERT` or `UPDATE` on `persons.manager_id`.

### Algorithm (Ancestry Walk)

```
function validateNoCircle(personId, newManagerId, db):
  if newManagerId is NULL: return OK  // becoming root
  if newManagerId == personId: return ERROR  // self-reference

  visited = {personId}
  current = newManagerId

  while current is not NULL:
    if current in visited: return ERROR  // cycle detected
    visited.add(current)
    current = db.getManagerId(current)

  return OK
```

**Bounded**: Maximum depth is capped at 50 levels. If walk exceeds this, reject as a safety measure.

**Atomicity**: The validation + update runs in a single D1 batch (transaction). Between validation and write, no concurrent mutation can introduce a cycle because D1 is single-writer per database.

## ID Generation

All primary keys use **UUIDv7** (RFC 9562):
- Lexicographically sortable by creation time
- Generated client-side (Worker) before INSERT
- 36-char lowercase string representation (`xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`)

Implementation: `crypto.randomUUID()` is available in Workers runtime but produces v4. Use a small utility that encodes `Date.now()` into the timestamp portion for v7 semantics.

## Timestamp Format

All `created_at` / `updated_at` columns store ISO 8601 UTC strings: `2026-05-24T12:00:00Z`. D1's `strftime` with `'now'` provides server-time defaults. Application code should always pass explicit timestamps for consistency.

## Migration Strategy

Migrations are plain `.sql` files in `packages/worker/migrations/`, numbered sequentially:

```
migrations/
  0001_initial.sql
  0002_add_custom_fields.sql
  ...
```

Applied via `wrangler d1 migrations apply bogo` (local dev) and `wrangler d1 migrations apply bogo --remote` (production). Each migration is idempotent where possible (`CREATE TABLE IF NOT EXISTS`).

## Soft Delete (Future)

Not in MVP. When added:
- Add `deleted_at TEXT` to `workspaces`, `persons`, `documents`
- All queries append `AND deleted_at IS NULL`
- Cascade: deleting a workspace soft-deletes all children
- Hard purge via scheduled Worker cron (30-day retention)
