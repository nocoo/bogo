# 04 — UI Design

## Overview

The UI is a Vite React SPA using the Basalt design language. It provides CRUD interfaces for workspaces, persons (org tree), and documents within a responsive sidebar layout.

## Design System — Basalt

### Color Foundation

- **oklch** color space, hue 250° (indigo-violet)
- Dark theme primary, light theme supported via CSS variables
- Semantic tokens: `--primary`, `--accent`, `--card`, `--background`, `--foreground`, `--muted-foreground`, `--border`

### Luminance Hierarchy (3-tier)

```
L0: Body background (darkest)     → var(--background)
L1: Card container (mid)          → var(--card)
L2: Inner cards / elevated (light) → var(--accent) or raised surfaces
```

### Typography

- System font stack (Inter as preferred)
- Size scale: `text-xs` (10px) through `text-xl` (20px)
- Weight: `font-normal` (400) for body, `font-medium` (500) for labels, `font-semibold` (600) for headings

### Spacing & Radius

- Container radius: `rounded-[16px]` (mobile), `rounded-[20px]` (desktop)
- Card radius: `rounded-xl` (12px)
- Button/input radius: `rounded-lg` (8px)
- Consistent padding: `p-3` (mobile), `p-5` (desktop)

## Layout Structure

```
┌────────────────────────────────────────────────────────┐
│ Browser viewport                                        │
│ ┌──────────┬─────────────────────────────────────────┐ │
│ │          │  Header (h-14)                          │ │
│ │ Sidebar  │  ┌─────────────────────────────────────┐│ │
│ │ (260px / │  │                                     ││ │
│ │  68px)   │  │  Content Card (L1)                  ││ │
│ │          │  │  ┌─────────────────────────────────┐││ │
│ │          │  │  │  Page Content                   │││ │
│ │          │  │  │                                 │││ │
│ │          │  │  │                                 │││ │
│ │          │  │  └─────────────────────────────────┘││ │
│ │          │  └─────────────────────────────────────┘│ │
│ └──────────┴─────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Sidebar

- **Expanded** (260px): Brand header with version badge, search button (⌘K), grouped navigation, user footer
- **Collapsed** (68px): Icon-only mode, tooltips for navigation items
- **Mobile** (<768px): Hidden by default, overlay drawer with backdrop
- Collapse state persisted in localStorage

### Header

- Dynamic page title from current route
- Mobile: hamburger menu button
- Future: breadcrumbs, workspace switcher

## Pages

### Workspace Selector (Future — `/workspaces`)

First screen after login if user has multiple workspaces. Simple card grid with create button.

### Dashboard (`/`)

Overview of the selected workspace:
- Person count, document count, recent activity
- Quick-access cards for common actions
- Activity timeline (recent documents edited)

### Persons (`/persons` — replaces current `/users`)

**Primary view: Org Tree**

Interactive tree visualization of the person hierarchy.

```
┌─────────────────────────────────────────────────┐
│  [+ Add Person]  [View: Tree | List]  [Filter]  │
│─────────────────────────────────────────────────│
│                                                  │
│  ┌──────────────────┐                           │
│  │ 🟢 CEO (Root)    │                           │
│  └───────┬──────────┘                           │
│          ├── VP Engineering                      │
│          │     ├── Staff Engineer                │
│          │     └── Senior Engineer               │
│          ├── VP Product                          │
│          │     └── Product Manager               │
│          └── VP Sales                            │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- **Drag & drop**: Rearrange hierarchy by dragging a person node onto a new parent. Triggers `PUT /persons/:id/move`.
- **Click node**: Opens person detail panel (slide-over or right panel)
- **Add person**: Modal form, parent defaults to selected node
- **Inline edit**: Double-click name/title for quick edit
- **Context menu**: Right-click for move, delete, add child

**Tree component**: Use `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop. Custom tree rendering with expand/collapse per node.

**List view**: Alternative flat table with sortable columns, search, and bulk actions.

### Person Detail (Panel or `/persons/:id`)

```
┌─────────────────────────────────────────────────┐
│  [← Back]           [Edit] [Delete]              │
│─────────────────────────────────────────────────│
│  Name: John Smith                                │
│  Title: Staff Engineer                           │
│  Reports to: VP Engineering                      │
│  Dotted line: VP Product                         │
│─────────────────────────────────────────────────│
│  Custom Fields                                   │
│  ┌────────────────┬───────────────────────┐      │
│  │ Department     │ Engineering           │      │
│  │ Start Date     │ 2024-03-15            │      │
│  │ Location       │ Remote                │      │
│  └────────────────┴───────────────────────┘      │
│─────────────────────────────────────────────────│
│  Documents (3)                                   │
│  • 2026-05-01  1:1 Notes                        │
│  • 2026-04-15  Performance Review               │
│  • —           Career Development Plan           │
└─────────────────────────────────────────────────┘
```

### Documents (`/documents`)

**Primary view: Timeline**

Documents displayed chronologically by `event_date`, grouped by month. Evergreen documents (no date) shown in a separate pinned section.

```
┌─────────────────────────────────────────────────┐
│  [+ New Document]  [Filter: type, person]        │
│─────────────────────────────────────────────────│
│                                                  │
│  📌 Evergreen                                   │
│  ├── Career Plan — John Smith                   │
│  └── Team Charter — Engineering                  │
│                                                  │
│  May 2026                                        │
│  ├── 05/20  1:1 Notes — John Smith  [Meeting]   │
│  ├── 05/15  Sprint Retro — Team     [Meeting]   │
│  └── 05/01  Review — John Smith     [Review]    │
│                                                  │
│  April 2026                                      │
│  └── 04/15  Performance Review — JS  [Review]   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Document Editor (`/documents/:id`)

- **Markdown editor**: Split or live-preview mode
- **Metadata sidebar**: Title, type, event_date, associated persons
- **Version history**: Drawer showing version list, click to view/diff
- **Auto-save**: Debounced save (2s after last keystroke), explicit save button also available

**Editor library**: `@uiw/react-md-editor` or similar lightweight MD editor with preview support.

### Settings (`/settings`)

- **Custom Fields**: CRUD for field definitions (drag to reorder)
- **Document Types**: CRUD for type definitions (name + color picker)
- **Workspace**: Rename, danger zone (delete)

### Analytics (`/analytics`)

- Org tree statistics (depth, breadth, headcount by level)
- Document creation over time (line chart)
- Most active persons (by document count)

### Logs (`/logs`)

- Audit trail of CRUD operations (future feature, placeholder page)

### System (`/system`)

- D1 stats, Worker version, uptime
- Health check status

## Component Library

### Planned Components

| Component | Purpose | Library |
|-----------|---------|---------|
| Tree | Org hierarchy display | Custom + @dnd-kit |
| TreeNode | Individual person node | Custom |
| DataTable | List views with sort/filter | @tanstack/react-table |
| MarkdownEditor | Document editing | @uiw/react-md-editor |
| CommandPalette | ⌘K search (already built) | Custom |
| SlideOver | Person detail panel | Custom (Headless UI pattern) |
| Modal | Create/edit forms | Custom |
| Toast | Success/error feedback | sonner |
| DatePicker | Event date selection | Custom or react-day-picker |
| ColorPicker | Document type color | Custom (preset palette) |
| Badge | Document type indicator | Custom |

### Form Patterns

- All forms use controlled components with React state
- Validation: zod schemas (shared with Worker)
- Submit: React Query mutations with optimistic updates
- Loading: Skeleton placeholders matching content layout

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| < 768px (mobile) | Sidebar hidden, hamburger menu, single column, touch-friendly targets |
| ≥ 768px (tablet) | Sidebar visible (collapsible), two-column where appropriate |
| ≥ 1280px (desktop) | Full sidebar, three-panel layouts (tree + detail + documents) |

## Navigation Updates

Current sidebar navigation will evolve from placeholder pages to:

```typescript
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/" },
      { title: "Persons", icon: Users, path: "/persons" },
      { title: "Documents", icon: FileText, path: "/documents" },
    ],
  },
  {
    label: "Configure",
    items: [
      { title: "Settings", icon: Settings, path: "/settings" },
      { title: "Analytics", icon: BarChart3, path: "/analytics" },
      { title: "System", icon: Monitor, path: "/system" },
    ],
  },
];
```

## State Management

| Concern | Solution |
|---------|----------|
| Server state (entities) | React Query (`@tanstack/react-query`) |
| URL state (filters, pagination) | react-router search params |
| UI state (sidebar, modals) | React useState / useReducer |
| Workspace context | React Context (set on workspace selection) |

## Interaction Patterns

### Drag & Drop (Tree)

1. User grabs a person node
2. Valid drop targets highlight (any other person = "make child of")
3. On drop: API call `PUT /persons/:id/move` with `{ manager_id: newParent }`
4. Optimistic update: tree re-renders immediately
5. On error: rollback + toast notification

### Document Auto-Versioning

1. User edits document content
2. Debounce timer (2s) triggers save
3. Worker computes `next_version = current + 1`
4. Worker inserts `document_versions` row with **new** content as a complete snapshot
5. Worker updates `documents` cache (content, version, updated_at)
6. UI updates version indicator
7. Version history panel shows new entry (each row = full snapshot, diffable)

### Bulk Operations (Future)

- Multi-select persons → bulk move, bulk delete
- Multi-select documents → bulk re-assign, bulk change type
