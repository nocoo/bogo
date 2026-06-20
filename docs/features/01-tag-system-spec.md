# SPEC: Tag System

## Objective

Add a workspace-scoped tag system to Bogo. Tags are labeled badges with optional colors that can be assigned to documents or persons. Each tag has a fixed scope (`document` or `person`) set at creation time. The system supports CRUD in Settings, assignment on entity pages, filtering in lists, and distribution charts on Overview.

**Target users**: Workspace admins managing people and documents.

## Data Model

### New Tables (D1 Migration)

```sql
-- tags: workspace-scoped, scope-typed
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('document', 'person')),
  color TEXT,  -- hex color e.g. '#ef4444', NULL = default gray
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, scope, name)
);

CREATE INDEX idx_tags_workspace_scope_sort ON tags(workspace_id, scope, sort_order);

-- tag_documents: N:M join with workspace_id for isolation
CREATE TABLE tag_documents (
  workspace_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (workspace_id, tag_id, document_id),
  FOREIGN KEY (workspace_id, tag_id) REFERENCES tags(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_tag_documents_doc ON tag_documents(workspace_id, document_id);
CREATE INDEX idx_tag_documents_tag ON tag_documents(workspace_id, tag_id);

-- tag_persons: N:M join with workspace_id for isolation
CREATE TABLE tag_persons (
  workspace_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (workspace_id, tag_id, person_id),
  FOREIGN KEY (workspace_id, tag_id) REFERENCES tags(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, person_id) REFERENCES persons(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_tag_persons_person ON tag_persons(workspace_id, person_id);
CREATE INDEX idx_tag_persons_tag ON tag_persons(workspace_id, tag_id);
```

**Design notes:**
- Join tables include `workspace_id` with composite foreign keys to prevent cross-workspace references at DB level, even if the API layer has a bug.
- `tags` table includes `UNIQUE (workspace_id, id)` to satisfy the composite FK from join tables.
- `documents(workspace_id, id)` and `persons(workspace_id, id)` composite UNIQUEs must also exist. The migration adds these if not already present.

### Scope Values

Scope uses singular entity names: `document` | `person`. This matches the existing table/type naming (`documents`, `persons`) and avoids mixed abbreviations (`doc`) or plural inconsistencies (`people` vs `persons`).

### Color System

12 preset colors with pre-defined display tokens for accessibility:

| Name    | Hex       | Background   | Text         | Border       |
|---------|-----------|--------------|--------------|--------------|
| red     | `#ef4444` | `#fef2f2`    | `#991b1b`    | `#fecaca`    |
| orange  | `#f97316` | `#fff7ed`    | `#9a3412`    | `#fed7aa`    |
| amber   | `#f59e0b` | `#fffbeb`    | `#92400e`    | `#fde68a`    |
| yellow  | `#eab308` | `#fefce8`    | `#854d0e`    | `#fef08a`    |
| lime    | `#84cc16` | `#f7fee7`    | `#3f6212`    | `#d9f99d`    |
| green   | `#22c55e` | `#f0fdf4`    | `#166534`    | `#bbf7d0`    |
| emerald | `#10b981` | `#ecfdf5`    | `#065f46`    | `#a7f3d0`    |
| cyan    | `#06b6d4` | `#ecfeff`    | `#155e75`    | `#a5f3fc`    |
| blue    | `#3b82f6` | `#eff6ff`    | `#1e40af`    | `#bfdbfe`    |
| violet  | `#8b5cf6` | `#f5f3ff`    | `#5b21b6`    | `#ddd6fe`    |
| purple  | `#a855f7` | `#faf5ff`    | `#6b21a8`    | `#e9d5ff`    |
| pink    | `#ec4899` | `#fdf2f8`    | `#9d174d`    | `#fbcfe8`    |

- Custom hex input supported (validated `#RRGGBB`)
- For custom colors, derive display tokens algorithmically: background = color at 8% opacity on white, text = color darkened to meet WCAG AA (4.5:1 contrast ratio against background), border = color at 30% opacity on white
- `NULL` color → neutral gray badge (`bg-gray-100 text-gray-700 border-gray-200`)

### `updated_at` Behavior

SQLite does not auto-update timestamps. The Worker must explicitly set `updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` in every UPDATE statement (or equivalently, use `new Date().toISOString()` in the JS layer). The response always returns the fresh `updatedAt` value.

## API Routes

Hono sub-app mounted at `/api/w/:wid/tags`. Paths below are relative to the mount point (i.e., `/` means `/api/w/:wid/tags`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List tags. Query: `scope=document\|person`, `includeCounts=true` |
| POST | `/` | Create tag |
| PUT | `/:id` | Update tag name/color/sortOrder |
| DELETE | `/:id` | Delete tag (cascades assignments) |
| PUT | `/:id/documents/:docId` | Assign tag to document |
| DELETE | `/:id/documents/:docId` | Remove tag from document |
| PUT | `/:id/persons/:personId` | Assign tag to person |
| DELETE | `/:id/persons/:personId` | Remove tag from person |
| GET | `/stats` | Tag distribution counts. Query: `scope=document\|person` |

**Method choice**: PUT for update and assignment (consistent with existing doc-types/documents/persons routes). Assignment uses PUT because it's idempotent by nature (see below).

### Assignment Semantics

| Action | Already exists / Not found | Response |
|--------|---------------------------|----------|
| PUT assign (already assigned) | Idempotent, no-op | `200` with current state |
| DELETE unassign (not assigned) | Idempotent, no-op | `200` |
| Assign with scope mismatch (e.g., person-tag → document) | Rejected | `400 { error: { code: "SCOPE_MISMATCH", message: "Tag scope does not match target entity" } }` |
| Assign to entity in different workspace | Blocked by composite FK | `400 { error: { code: "INVALID_REFERENCE", message: "Entity not found in workspace" } }` |

Optimistic updates on the client rely on idempotent 200 responses — no 409 or 404 for these operations.

### List Filtering (Existing Routes)

Tag filtering is handled at the API level to support future pagination:

| Route | New Query Params | Behavior |
|-------|-----------------|----------|
| `GET /api/w/:wid/documents` | `tagIds=id1,id2&tagMode=any` | Return documents matching ANY of the given tags |
| `GET /api/w/:wid/persons` | `tagIds=id1,id2&tagMode=any` | Return persons matching ANY of the given tags |

Response bodies include an embedded `tags: Tag[]` array on each entity when tags exist (empty array when none). This avoids N+1 queries on the client.

### Stats Response Schema

`GET /api/w/:wid/tags/stats?scope=document|person`

```json
{
  "data": [
    {
      "id": "tag-uuid",
      "name": "Engineering",
      "color": "#3b82f6",
      "sortOrder": 0,
      "count": 12
    }
  ]
}
```

- Includes tags with `count: 0` (so chart shows all defined tags)
- Sorted by `sortOrder` ASC, then `name` ASC
- `count` = number of distinct entities (documents or persons) assigned this tag

### Settings Tag List with Counts

`GET /api/w/:wid/tags?scope=document&includeCounts=true`

When `includeCounts=true`, the response returns `TagWithCount[]` (each tag includes `assignedCount`). This avoids a separate stats call on the Settings page. Response envelope: `{ "data": TagWithCount[] }`.

## Shared Schemas (`@bogo/shared`)

All schemas use camelCase field names. DB row → camelCase mapping happens in the Worker route handler (consistent with existing patterns for `createdAt`, `sortOrder`, etc.).

```typescript
// packages/shared/src/schemas/tag.ts
import { z } from 'zod/v4';

const TAG_SCOPES = ['document', 'person'] as const;
const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const tagSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1).max(50),
  scope: z.enum(TAG_SCOPES),
  color: HEX_COLOR.nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  scope: z.enum(TAG_SCOPES),
  color: HEX_COLOR.nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: HEX_COLOR.nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const tagWithCountSchema = tagSchema.extend({
  assignedCount: z.number().int(),
});

export const tagStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: HEX_COLOR.nullable(),
  sortOrder: z.number().int(),
  count: z.number().int(),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = z.infer<typeof tagWithCountSchema>;
export type CreateTag = z.infer<typeof createTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;
export type TagStats = z.infer<typeof tagStatsSchema>;
```

## UI Components

### Settings → Tags Page (`TagsSettingsPage.tsx`)

- Route: `/settings/tags`
- Two tabs: "Document Tags" / "Person Tags"
- Table with columns: color swatch, name, assigned count (from `includeCounts`), actions (edit/delete)
- Create dialog: name input + color picker (preset grid + hex input)
- Edit inline or dialog
- Drag to reorder (sortOrder)

### Tag Badge Component (`TagBadge.tsx`)

- Renders as inline pill/badge with `border` style
- Uses the preset token table for known colors (bg/text/border)
- For custom hex: derives accessible tokens algorithmically (see Color System)
- Fallback: neutral gray for NULL color
- Sizes: `sm` (list items), `md` (detail views)
- Meets WCAG AA contrast (4.5:1) for all preset and custom colors

### Tag Assignment (Popover/Combobox)

- Used on Documents list and People list (inline or row action)
- Combobox with search, shows available tags for that scope
- Already-assigned tags shown as checked
- Click to toggle assignment (optimistic update, idempotent PUT/DELETE)

### List Pages Enhancement

- **DocumentsPage**: Show embedded `tags` as badges in each row, multi-select tag filter dropdown
- **PeoplePage**: Show embedded `tags` as badges in each row, multi-select tag filter dropdown
- Filter sends `tagIds` + `tagMode=any` to API (server-side, pagination-safe)
- Clear filter shows all entities

### Overview Page Chart

- Add "Tag Distribution" section using Recharts
- Horizontal bar chart showing tag assignment counts
- Separate charts for document tags and person tags (tabbed)
- Bar fill color matches each tag's color; labels use accessible text color
- **Why Recharts**: The Overview page will grow with more analytics (field distributions, timeline charts). Recharts (~35KB gzipped) provides a composable React API that avoids reimplementing tooltips, animations, responsive sizing, and accessibility for each future chart. A one-off CSS bar is cheaper today but becomes tech debt as soon as a second chart type is needed.

## Project Structure (New/Modified Files)

```
packages/
├── shared/src/schemas/
│   ├── tag.ts                    # NEW: Zod schemas + types
│   └── index.ts                  # MODIFY: export tag schemas
├── worker/
│   ├── migrations/
│   │   └── 0002_tags.sql         # NEW: migration (tables + indexes + composite UNIQUEs)
│   └── src/routes/
│       ├── tags.ts               # NEW: Hono sub-app for tag CRUD + assignment + stats
│       ├── documents.ts          # MODIFY: add tagIds/tagMode query, embed tags in response
│       └── persons.ts            # MODIFY: add tagIds/tagMode query, embed tags in response
├── ui/src/
│   ├── components/
│   │   ├── TagBadge.tsx          # NEW: accessible badge component
│   │   ├── TagPicker.tsx         # NEW: assignment combobox
│   │   └── TagColorPicker.tsx    # NEW: color selector (preset + custom)
│   ├── pages/
│   │   ├── TagsSettingsPage.tsx  # NEW: settings CRUD page
│   │   ├── SettingsPage.tsx      # MODIFY: add "Tags" nav entry
│   │   ├── DocumentsPage.tsx     # MODIFY: add badges + filter
│   │   ├── PeoplePage.tsx        # MODIFY: add badges + filter
│   │   └── OverviewPage.tsx      # MODIFY: add Recharts charts
│   ├── App.tsx                   # MODIFY: add /settings/tags route
│   ├── models/
│   │   └── tag.model.ts          # NEW: API client
│   ├── viewmodels/
│   │   └── tag.viewmodel.ts      # NEW: React Query hooks
│   ├── hooks/
│   │   └── useTagFilter.ts       # NEW: filter state hook
│   └── lib/
│       └── tag-colors.ts         # NEW: preset token map + custom color derivation
```

## Code Style

- Follow existing patterns: Hono sub-app for routes, Zod validation, React Query for data fetching
- MVVM: page → viewmodel (hooks) → model (API client)
- Optimistic updates for tag assignment toggle (idempotent PUT/DELETE)
- camelCase in TypeScript types; snake_case only in SQL DDL
- No comments unless explaining non-obvious behavior

## Testing Strategy

| Layer | What to test |
|-------|-------------|
| L1 | Tag schema validation (shared), color token derivation, tag route handlers (worker) |
| L2 | E2E API: CRUD tags, assign/unassign idempotency, scope mismatch rejection, stats with zero-count, workspace isolation (cross-workspace FK blocked), tagIds filter on documents/persons |
| G1 | TypeScript strict, Biome lint pass |

## Boundaries

### Always Do
- Workspace isolation: join tables include workspace_id with composite FKs
- Cascade delete: removing a tag removes all assignments
- Validate scope match: cannot assign a document-tag to a person (400)
- Unique constraint on (workspace_id, scope, name)
- Set `updated_at` explicitly on every UPDATE
- Return idempotent 200 for assign/unassign regardless of prior state

### Ask First
- Drag-to-reorder complexity — can simplify to manual sort order input if too complex
- Whether to add tag count badges in sidebar navigation

### Never Do
- Allow cross-workspace tag sharing
- Allow changing a tag's scope after creation
- Add tag hierarchy/nesting (keep flat)
- Use PATCH (use PUT to stay consistent with existing routes)

## Implementation Order

1. Migration + shared schemas (including composite UNIQUE constraints on existing tables)
2. API routes: tag CRUD + assignment + stats
3. API routes: extend documents/persons with tagIds filter + embedded tags
4. L1/L2 tests for API
5. UI: tag-colors.ts + TagBadge component
6. UI: TagsSettingsPage (CRUD with counts)
7. UI: TagPicker + assignment on list pages
8. UI: List page tag filter (wired to API)
9. UI: Overview Recharts integration
10. Navigation/routing integration (App.tsx, SettingsPage nav)
11. Final integration test
