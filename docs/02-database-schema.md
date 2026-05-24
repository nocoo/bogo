# 02 — Database Schema (D1)

## Overview

All tables live in a single Cloudflare D1 instance (`bogo`). Schema enforces workspace isolation via composite foreign keys, tree integrity via CHECK constraints and API-level cycle detection, and version immutability at the database level.

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
  FOREIGN KEY (workspace_id, manager_id) REFERENCES persons(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, dotted_manager_id) REFERENCES persons(workspace_id, id) ON DELETE SET NULL,
  CHECK ((is_root = 1 AND manager_id IS NULL) OR (is_root = 0 AND manager_id IS NOT NULL))
);

CREATE INDEX idx_persons_workspace ON persons(workspace_id);
CREATE INDEX idx_persons_manager ON persons(workspace_id, manager_id);
CREATE UNIQUE INDEX idx_persons_root_unique
  ON persons(workspace_id) WHERE is_root = 1;
```

**Workspace isolation**: Composite FK `(workspace_id, manager_id)` referencing `(workspace_id, id)` ensures a person's manager is always within the same workspace. Same for dotted-line manager.

**Root invariants**:
- Partial unique index guarantees **at most one** root per workspace.
- CHECK constraint enforces `is_root=1 ⟹ manager_id IS NULL` and `is_root=0 ⟹ manager_id IS NOT NULL`.
- API enforces **at least one** root: workspace creation atomically inserts the root person in the same transaction.
- `ON DELETE RESTRICT` on `manager_id` prevents deleting a person who has reports. API must reassign children before deletion.

### custom_field_definitions

```sql
CREATE TABLE custom_field_definitions (
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

CREATE INDEX idx_cfd_workspace ON custom_field_definitions(workspace_id);
```

- `options`: JSON array string, only meaningful when `field_type = 'select'`.
- `required`: Boolean as integer (0/1). When adding a required field to a workspace with existing persons, `default_value` is used to backfill. Creating a required field without `default_value` is rejected by the API if persons already exist.
- Name uniqueness scoped to workspace.

### custom_field_values

```sql
CREATE TABLE custom_field_values (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  field_def_id TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  UNIQUE (person_id, field_def_id),
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, field_def_id) REFERENCES custom_field_definitions(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_cfv_person ON custom_field_values(person_id);
CREATE INDEX idx_cfv_field_def ON custom_field_values(field_def_id);
```

- `value`: Always stored as text. Parsing/validation happens at API layer based on `field_type`.
- Composite FKs ensure person and field definition belong to the same workspace.

### document_types

```sql
CREATE TABLE document_types (
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

CREATE INDEX idx_doctypes_workspace ON document_types(workspace_id);
```

### documents

```sql
CREATE TABLE documents (
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
  FOREIGN KEY (workspace_id, type_id) REFERENCES document_types(workspace_id, id) ON DELETE SET NULL
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_type ON documents(workspace_id, type_id);
CREATE INDEX idx_documents_event_date ON documents(workspace_id, event_date);
```

- `content`: Cache of the latest version's full Markdown (denormalized for read performance).
- `event_date`: ISO 8601 date string (`YYYY-MM-DD`), NULL for evergreen documents.
- `version`: Monotonically increasing, starts at 1.
- Composite FK on `type_id` ensures the document type belongs to the same workspace.

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
- Each row is a **complete snapshot** of the document at that version number.
- `version=1` is created at document creation time. Every subsequent edit increments version and inserts the new state here.

### document_persons

```sql
CREATE TABLE document_persons (
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'subject',
  PRIMARY KEY (document_id, person_id),
  FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_docpersons_person ON document_persons(workspace_id, person_id);
```

- Composite FKs ensure document and person belong to the same workspace.
- `role`: Application-defined (e.g. "subject", "attendee", "reviewer"). No CHECK constraint — extensible.

## Workspace Isolation Strategy

**DB-level enforcement** via composite foreign keys:
- Every child table carries `workspace_id` and uses composite FKs referencing `(workspace_id, id)` on the parent.
- This makes it structurally impossible for cross-workspace references to exist, regardless of API bugs.

**API-level enforcement** (defense in depth):
- The Worker extracts `workspace_id` from the authenticated session and injects it into every D1 query.
- Path parameter `:wid` in `/api/w/:wid/...` is validated against the user's ownership via workspace guard middleware. No body/query parameter can override workspace scoping.

**Query pattern:**

```sql
-- Fetching persons for a workspace
SELECT * FROM persons WHERE workspace_id = ?;

-- Fetching documents with person filter (cross-table, still workspace-scoped)
SELECT d.* FROM documents d
  JOIN document_persons dp ON dp.document_id = d.id AND dp.workspace_id = d.workspace_id
  JOIN persons p ON p.id = dp.person_id AND p.workspace_id = dp.workspace_id
WHERE d.workspace_id = ?;
```

## Tree Integrity

### Invariants

1. **Exactly one root per workspace** — guaranteed by: partial unique index (at most one) + workspace creation transaction (at least one) + API rejecting root deletion.
2. **Root ⟺ manager_id IS NULL** — CHECK constraint at DB level.
3. **No orphans** — `is_root=0 ⟹ manager_id IS NOT NULL` (CHECK) + `ON DELETE RESTRICT` prevents removing a manager with existing reports.
4. **No cycles** — API-level ancestry walk before every manager change.
5. **No cross-workspace parent** — composite FK `(workspace_id, manager_id)`.

### Cycle Prevention Algorithm

D1 does not support recursive CTEs in triggers, so cycle detection runs at the **API layer** before any `UPDATE` on `persons.manager_id`.

```
function validateMove(personId, newManagerId, workspaceId, db):
  // Root cannot be moved (is_root=1 persons reject manager_id changes)
  // Non-root cannot have manager_id=NULL (CHECK constraint rejects)

  if newManagerId == personId: return ERROR  // self-reference

  visited = {personId}
  current = newManagerId

  while current is not NULL:
    if current in visited: return ERROR  // cycle detected
    visited.add(current)
    current = db.getManagerId(current)  // always same workspace (composite FK)
    if visited.size > 50: return ERROR  // depth safety cap

  return OK
```

**Atomicity**: The validation + update runs in a single D1 batch (transaction). D1 is single-writer per database, so no concurrent mutation can introduce a cycle between validation and write.

### Delete Strategy

- **Leaf node**: Delete directly (no children reference it).
- **Non-leaf node**: API rejects with 409 (RESTRICT). Client must reassign children first.
- **Root node**: API always rejects deletion. Root can only be renamed/edited, never removed.

## Document Versioning

### Semantic Model

The `documents` table holds the **current** (latest) state as a read-performance cache. The `document_versions` table is the append-only source of truth for all historical states.

### Lifecycle

1. **Create**: Insert `documents` (version=1) + insert `document_versions` (version=1, same title/content). Both in one transaction.
2. **Edit**: In one transaction:
   - Compute `next_version = documents.version + 1`
   - INSERT into `document_versions` with `version=next_version`, new title, new content
   - UPDATE `documents` SET `content=new, title=new, version=next_version, updated_at=now`
3. **Read history**: `SELECT * FROM document_versions WHERE document_id = ? ORDER BY version DESC`
4. **Diff**: Compare any two version rows (client-side or via API).

Each version row is a **complete snapshot** — no deltas. This keeps reads simple and avoids reconstruction chains.

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

## Future Extensions

### Multi-user (post-MVP)

```sql
CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (workspace_id, user_id)
);
```

MVP uses single-owner model (`workspaces.owner_id`). Workspace guard middleware will switch from owner check to membership lookup when this table is introduced.

### Document Attachments (post-MVP, R2)

```sql
CREATE TABLE document_attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE
);
```

Stored in R2 bucket, metadata in D1. Upload via presigned URL; download via Worker proxy with workspace auth.

### Soft Delete (post-MVP)

- Add `deleted_at TEXT` to `workspaces`, `persons`, `documents`
- All queries append `AND deleted_at IS NULL`
- Cascade: deleting a workspace soft-deletes all children
- Hard purge via scheduled Worker cron (30-day retention)
