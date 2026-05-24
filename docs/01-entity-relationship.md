# 01 — Entity & Relationship Model

## Overview

Bogo manages **people** and **documents** within isolated **workspaces**. Each workspace contains a single-root person hierarchy (org tree) and associated documents.

## Entities

### Workspace

The top-level isolation boundary. A CF Access user can own multiple workspaces.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| owner_id | string | CF Access user identifier (email or sub) |
| name | string | Display name (e.g. "Acme Corp", "Family") |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last modification |

### Person

A node in the workspace's org tree. Has one direct manager and optionally one dotted-line manager.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | FK → Workspace |
| name | string | Full name |
| title | string | Job title / role description |
| manager_id | UUID? | FK → Person (direct report, NULL for root) |
| dotted_manager_id | UUID? | FK → Person (matrix/dotted-line, optional) |
| is_root | boolean | Only one per workspace |
| sort_order | integer | Sibling ordering under same manager |
| created_at | timestamp | |
| updated_at | timestamp | |

**Constraints:**
- Exactly one person per workspace with `is_root = true` and `manager_id = NULL`
- `manager_id` forms a strict tree (no cycles)
- `dotted_manager_id` is advisory — not enforced as tree

### Custom Field Definition

Workspace-global schema for additional person attributes.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | FK → Workspace |
| name | string | Field label (e.g. "Department", "Start Date") |
| field_type | enum | `text`, `number`, `date`, `select`, `boolean` |
| options | JSON? | For `select` type: array of allowed values |
| sort_order | integer | Display ordering |
| required | boolean | Whether field must have a value |
| created_at | timestamp | |

### Custom Field Value

Per-person values for custom fields.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| person_id | UUID | FK → Person |
| field_def_id | UUID | FK → Custom Field Definition |
| value | string | Stored as text, interpreted per field_type |

**Constraint:** Unique (person_id, field_def_id)

### Document Type

Workspace-shared classification for documents.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | FK → Workspace |
| name | string | Type label (e.g. "Meeting Notes", "Performance Review") |
| color | string? | Badge color for UI |
| sort_order | integer | Display ordering |
| created_at | timestamp | |

### Document

A versioned Markdown document associated with one or more people.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | FK → Workspace |
| type_id | UUID? | FK → Document Type (optional) |
| title | string | Document title |
| content | text | Current Markdown content (latest version) |
| event_date | date? | Business date (e.g. meeting date), NULL = evergreen |
| version | integer | Current version number |
| created_at | timestamp | |
| updated_at | timestamp | |

### Document Version

Immutable history of document edits.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | FK → Document |
| version | integer | Monotonically increasing |
| title | string | Title at this version |
| content | text | Full Markdown content at this version |
| created_at | timestamp | When this version was saved |

### Document–Person (Join)

N:M relationship between documents and people.

| Field | Type | Description |
|-------|------|-------------|
| document_id | UUID | FK → Document |
| person_id | UUID | FK → Person |
| role | string | Relationship context (e.g. "subject", "attendee") |

**Constraint:** Unique (document_id, person_id)

## Relationships Diagram

```
CF Access User
  │
  ├── Workspace (1:N)
  │     │
  │     ├── Person (1:N, tree via manager_id)
  │     │     ├── Custom Field Value (1:N)
  │     │     └── Document ←→ Person (N:M via join table)
  │     │
  │     ├── Custom Field Definition (1:N, workspace-global)
  │     │
  │     ├── Document Type (1:N)
  │     │
  │     └── Document (1:N)
  │           └── Document Version (1:N)
```

## CRUD Summary

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| Workspace | User creates | List own workspaces | Rename | Soft delete (cascade) | Owner-only |
| Person | Add under parent | Tree view, detail | Edit fields, move in tree | Remove (reassign children or cascade) | Root cannot be deleted |
| Custom Field Def | Admin creates | List all in WS | Edit name/type/options | Remove (deletes values) | |
| Custom Field Value | Auto on person create (if required) | Inline in person detail | Edit value | Clear value | |
| Document Type | Admin creates | List in WS | Edit name/color | Remove (nulls doc type_id) | |
| Document | Create with person(s) | List by person, search | Edit content (auto-version), change metadata | Soft delete | |
| Document Version | Auto on edit | View history, diff | — (immutable) | — (immutable) | |
| Doc–Person | Add association | List for doc/person | Change role | Remove association | At least one person required |

## Invariants

1. **One root per workspace** — enforced at DB level (partial unique index) and API level.
2. **Tree integrity** — `manager_id` cannot create cycles. Validated on create/move via ancestry walk (bounded by max depth).
3. **Workspace isolation** — all queries scoped by `workspace_id`. No cross-workspace references.
4. **Version immutability** — document versions are append-only, never modified.
5. **At least one person** — every document must be associated with at least one person.
