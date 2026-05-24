# 07 — UI Page Interactions

## Overview

Detailed interaction design for each page, covering all UI states: loading, empty, data, error, and permission scenarios.

## Global States

Every data-fetching view handles exactly these states:

| State | UI | Trigger |
|-------|------|---------|
| Loading | Skeleton placeholder matching content shape | Initial fetch, no cached data |
| Empty | Illustration + CTA button | Query returns empty array |
| Data | Normal rendered content | Query returns data |
| Error | Inline error card with retry button | Query/mutation fails |
| Stale refresh | Dim overlay + spinner on existing content | Background refetch |

## Workspace Selection

### Route: `/workspaces` (or redirect from `/` if no workspace selected)

**States**:
- **Loading**: 2-3 skeleton cards
- **Empty** (new user): Welcome message + "Create your first workspace" CTA
- **Data**: Card grid (workspace name, person count, last updated)

**Interactions**:
- Click card → set workspace context → navigate to `/`
- Click "+" card → create modal (name input only)
- Long press / context menu → rename, delete (with confirmation)

---

## Dashboard (`/`)

### Route: `/` (requires workspace context)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Stats row: [Persons: 24] [Documents: 89] [This week: 5]│
├─────────────────────────────────────────────────────────┤
│  Quick actions        │  Recent activity                 │
│  • Add person         │  • May 23: 1:1 Notes edited     │
│  • New document       │  • May 22: Jane added           │
│  • View org tree      │  • May 21: Review created       │
└─────────────────────────────────────────────────────────┘
```

**States**:
- **Loading**: Stat cards as skeletons, activity list as 5 skeleton rows
- **Empty workspace** (just created): Stats show zeros, activity says "No activity yet", quick actions highlighted
- **Data**: Numbers + recent activity timeline

**Interactions**:
- Click stat card → navigate to relevant page
- Click activity item → navigate to document/person detail
- Quick action buttons → navigate or open modal

---

## Persons (`/persons`)

### Route: `/persons`

**Primary view**: React Flow org tree (default)
**Secondary view**: Flat table (toggle)

### Tree View

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  [+ Add Person]  [View: ● Tree ○ List]  [Zoom controls]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│              ┌─────────────┐                               │
│              │  CEO (root) │                               │
│              └──────┬──────┘                               │
│          ┌──────────┼──────────┐                           │
│    ┌─────┴─────┐  ┌─┴────┐  ┌─┴────────┐                 │
│    │ VP Eng    │  │VP Prod│  │ VP Sales  │                 │
│    └─────┬─────┘  └──────┘  └───────────┘                 │
│      ┌───┴───┐                                             │
│   ┌──┴───┐ ┌─┴────┐                                       │
│   │Staff │ │Senior│                                        │
│   └──────┘ └──────┘                                        │
│                                                            │
│  [Minimap]                                                 │
└────────────────────────────────────────────────────────────┘
│  Detail panel (right slide-over when node selected)        │
└────────────────────────────────────────────────────────────┘
```

**States**:
- **Loading**: Canvas with single centered skeleton node
- **Empty** (only root exists): Root node + "Add your first team member" floating tooltip
- **Data**: Full tree rendered with dagre layout
- **Error**: Error banner above canvas, tree shows last cached state

**Node interactions**:
- **Click node**: Select → open detail panel (slide-over from right)
- **Double-click node**: Inline edit name/title
- **Drag node**: Detach from parent → hover over new parent (highlight target) → drop to reparent
  - Validation: Cannot drag onto self, own descendants, or root onto another node
  - On drop: Confirmation toast "Move [name] under [new parent]?" with undo (3s)
  - API: `PUT /api/w/:wid/persons/:id/move`
- **Right-click node**: Context menu [Add child, Edit, Move, Delete]
- **Zoom/Pan**: Mouse wheel zoom, drag canvas to pan, minimap for navigation

**Drag-to-reparent flow (detailed)**:
1. User starts dragging a node
2. Valid drop targets (all other nodes except self and descendants) show green highlight border
3. Invalid targets (self, descendants) show red X indicator
4. On drop onto valid target → optimistic tree re-layout → API call
5. On success → toast "Moved successfully"
6. On failure → rollback to original position → error toast with message

### List View

**Layout**: `@tanstack/react-table` with columns: Name, Title, Manager, Dotted Line, Created

**Interactions**:
- Click row → open same detail panel
- Sort by any column header
- Search/filter input above table
- Bulk select → bulk move (future)

### Person Detail Panel

**Layout** (slide-over, 400px):
```
┌─────────────────────────────────────┐
│  [← Close]         [Edit] [Delete]  │
├─────────────────────────────────────┤
│  Avatar placeholder                  │
│  Name: John Smith                    │
│  Title: Staff Engineer               │
├─────────────────────────────────────┤
│  Reporting                           │
│  Manager: VP Engineering [link]      │
│  Dotted line: VP Product [link]      │
├─────────────────────────────────────┤
│  Custom Fields                       │
│  ┌──────────────┬─────────────────┐ │
│  │ Department   │ Engineering     │ │
│  │ Start Date   │ 2024-03-15      │ │
│  │ Location     │ Remote          │ │
│  └──────────────┴─────────────────┘ │
├─────────────────────────────────────┤
│  Documents (3)                       │
│  • 2026-05-01  1:1 Notes [Meeting]  │
│  • 2026-04-15  Review    [Review]   │
│  • —           Career Plan           │
│  [+ New Document for this person]    │
└─────────────────────────────────────┘
```

**Edit mode**: Fields become inputs; custom fields show appropriate control per type (text input, number input, date picker, select dropdown, checkbox).

**Delete**: Confirmation dialog. If person has reports → show warning "Reassign X reports first" with person list link. If leaf → confirm and delete.

### Add Person Modal

**Fields**: Name (required), Title, Parent (pre-filled if from context menu), Dotted-line manager (select)

**Custom fields**: Required fields shown immediately with empty/default values.

**Validation**: Zod schema, errors shown inline below each field.

---

## Documents (`/documents`)

### Route: `/documents`

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  [+ New Document]  [Filter: type ▼] [Filter: person ▼]    │
│  [Search: _____________]                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📌 Evergreen (no date)                                   │
│  ├── Career Development Plan — John Smith     [Plan]       │
│  └── Team Charter — Engineering Team          [Charter]    │
│                                                            │
│  ─── May 2026 ───────────────────────────────────────      │
│  ├── 05/20  1:1 Weekly — John Smith           [Meeting]    │
│  ├── 05/15  Sprint Retrospective — Team       [Meeting]    │
│  └── 05/01  Performance Review — John Smith   [Review]     │
│                                                            │
│  ─── April 2026 ──────────────────────────────────────     │
│  └── 04/15  Q1 Review — John Smith            [Review]     │
│                                                            │
│  [Load more...]                                            │
└────────────────────────────────────────────────────────────┘
```

**States**:
- **Loading**: 3 skeleton groups with 2-3 skeleton rows each
- **Empty**: "No documents yet" + CTA "Create your first document"
- **Empty filtered**: "No documents match your filters" + clear filters link
- **Data**: Grouped timeline (virtual scrolled for performance)
- **Error**: Error banner, retry button

**Interactions**:
- Click document row → navigate to `/documents/:id` (editor)
- Filter by type: Dropdown with document type badges (colored)
- Filter by person: Searchable dropdown with person names
- Search: Debounced text search (title + content full-text, API-supported)
- Pagination: Cursor-based "Load more" at bottom (virtual scroll handles viewport)

### Document Editor (`/documents/:id`)

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Title input  [Type: Meeting ▼]  [Save] [···]   │
├────────────────────────────────────────────────────────────┤
│                                            │  Metadata     │
│  ┌──────────────────────────────────────┐ │  ───────────  │
│  │                                      │ │  Date: 05/20  │
│  │  Markdown Editor                     │ │               │
│  │  (split: edit | preview)             │ │  Persons:     │
│  │                                      │ │  • John Smith │
│  │                                      │ │  • Jane Doe   │
│  │                                      │ │  [+ Add]      │
│  │                                      │ │               │
│  │                                      │ │  Version: 5   │
│  │                                      │ │  [History ▶]  │
│  └──────────────────────────────────────┘ │               │
└────────────────────────────────────────────────────────────┘
```

**States**:
- **Loading**: Skeleton editor + metadata panel
- **Data**: Editor with content, metadata filled
- **Saving**: "Saving..." indicator in header (debounced auto-save)
- **Saved**: "Saved" with checkmark (fades after 2s)
- **Error saving**: Red "Save failed" with retry, content preserved locally
- **Conflict** (future): If version mismatch on save → show diff + resolve

**Interactions**:
- Edit content → debounce 2s → auto-save (PUT) → version increment
- Manual save: Ctrl+S / button
- Change type: Dropdown selection → immediate save
- Change date: Date picker → immediate save
- Add/remove person: Searchable person select → immediate save
- "···" menu: Delete document (confirmation), Export as .md
- Version history: Opens drawer with version list

### Version History Drawer

**Layout**:
```
┌───────────────────────────────────┐
│  Version History                   │
│  [Close ×]                         │
├───────────────────────────────────┤
│  v5 — May 24, 10:30 (current)     │
│  v4 — May 23, 15:00               │
│  v3 — May 20, 09:15               │
│  v2 — May 18, 14:00               │
│  v1 — May 15, 11:30 (created)     │
├───────────────────────────────────┤
│  [Compare: v4 ↔ v5]               │
│  ┌─────────────────────────────┐  │
│  │  @pierre/diffs CodeView     │  │
│  │  (split diff rendering)     │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**Interactions**:
- Click version → preview that version's content (read-only)
- Select two versions → show diff via `@pierre/diffs`
- "Restore this version" → creates new version with old content (append, not overwrite)

---

## Settings (`/settings`)

### Route: `/settings`

**Tabs**: Custom Fields | Document Types | Workspace

### Custom Fields Tab

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Custom Fields                              [+ Add Field]  │
├────────────────────────────────────────────────────────────┤
│  ☰  Department    [text]     Required  [Edit] [Delete]     │
│  ☰  Start Date    [date]     Required  [Edit] [Delete]     │
│  ☰  Location      [select]   Optional  [Edit] [Delete]     │
│  ☰  Is Manager    [boolean]  Optional  [Edit] [Delete]     │
└────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Drag handle (☰) to reorder → `PUT` sort_order
- Add field: Modal with name, type, required, default_value, options (if select)
- Edit: Same modal, pre-filled
- Delete: Confirmation "This will remove values from all X persons"

### Document Types Tab

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Document Types                             [+ Add Type]   │
├────────────────────────────────────────────────────────────┤
│  ☰  🟢 Meeting Notes                       [Edit] [Delete]│
│  ☰  🔵 Performance Review                  [Edit] [Delete]│
│  ☰  🟣 Career Plan                         [Edit] [Delete]│
└────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Drag to reorder
- Add/edit: Modal with name + color picker (preset palette)
- Delete: Confirmation "Documents using this type will become untyped"

### Workspace Tab

- Rename workspace: Inline edit
- Danger zone: Delete workspace (requires typing workspace name to confirm)

---

## Analytics (`/analytics`)

### Route: `/analytics`

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Org Stats                │  Document Activity             │
│  ┌──────────────────────┐ │  ┌──────────────────────────┐ │
│  │ Tree depth: 4        │ │  │  Line chart: docs/week   │ │
│  │ Total persons: 24    │ │  │  over last 12 weeks      │ │
│  │ Avg span: 3.2        │ │  └──────────────────────────┘ │
│  └──────────────────────┘ │                                │
├────────────────────────────────────────────────────────────┤
│  Persons by Level          │  Top Contributors            │
│  ┌──────────────────────┐  │  ┌──────────────────────┐   │
│  │  Bar chart (L1-L4)   │  │  │  1. John — 15 docs   │   │
│  └──────────────────────┘  │  │  2. Jane — 12 docs   │   │
│                            │  └──────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**States**:
- **Loading**: Skeleton charts
- **Empty**: "Not enough data yet" (< 3 persons or < 5 documents)
- **Data**: Charts rendered via recharts

---

## System (`/system`)

### Route: `/system`

**Layout**: Simple info cards
- Worker version + deploy time
- D1 database stats (table counts via API)
- Health check status (green/red dot)
- R2 bucket stats (future, placeholder)

**Auto-refresh**: 30s polling for health check.

---

## Cross-cutting Patterns

### Toast Notifications

| Action | Toast type | Message pattern |
|--------|-----------|-----------------|
| Create success | Success | "Person created" / "Document saved" |
| Update success | Success | "Changes saved" (subtle, 2s) |
| Delete success | Info | "Deleted [name]" with undo (5s) |
| Validation error | Error | Field-level errors in form, generic toast for unexpected |
| Network error | Error | "Connection lost. Retrying..." with manual retry |
| Optimistic rollback | Warning | "Action failed, reverted" |

### Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| ⌘K | Command palette (page search) | Global |
| ⌘S | Save document | Document editor |
| Escape | Close panel/modal/drawer | Global |
| ⌘N | New document / new person (context) | Persons / Documents page |
| ⌘Z | Undo last action (optimistic) | After mutation |

### Responsive Adaptations

| Component | Desktop (≥1280) | Tablet (768-1279) | Mobile (<768) |
|-----------|----------------|-------------------|---------------|
| Person tree | Full canvas + detail panel | Full canvas, detail as modal | List view default, tree via button |
| Document editor | Side-by-side editor + metadata | Stacked (editor above metadata) | Single column, metadata in accordion |
| Settings | Full table | Same | Cards instead of table rows |
| Version diff | Split view | Stacked/unified view | Stacked view |
