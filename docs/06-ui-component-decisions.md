# 06 — UI Component Decisions

## Overview

This document records the final component/library selections for the Bogo UI, their integration patterns in a Vite CSR SPA, and testing strategies for each.

## Decision Matrix

| Concern | Library | Version | License | Justification |
|---------|---------|---------|---------|---------------|
| Org tree visualization | `@xyflow/react` | ^12 | MIT | Rich DOM/SVG graph viewport with zoom/pan, dagre layout for tree, custom nodes, built-in drag interaction |
| Tree layout algorithm | `@dagrejs/dagre` | ^3 | MIT | Computes hierarchical positions for xyflow nodes (TB direction) |
| Diff rendering | `@pierre/diffs` | ^1.2 | Apache-2.0 | Designated by product owner. Shiki-based, split/unified views, React binding via `@pierre/diffs/react` |
| Data table | `@tanstack/react-table` | ^8 | MIT | Headless — full style control for basalt; sorting, filtering, pagination built-in |
| Server state | `@tanstack/react-query` | ^5 | MIT | Caching, optimistic updates, background refetch, mutation lifecycle |
| Virtual scrolling | `@tanstack/react-virtual` | ^3 | MIT | Hook-based virtualizer for long document lists and timelines |
| Forms | `react-hook-form` | ^7 | MIT | Uncontrolled for performance; zod resolver for shared schema validation |
| Validation | `zod` | ^4 | MIT | Shared with Worker (single source of truth for entity schemas) |
| Markdown editor | `@uiw/react-md-editor` | ^4 | MIT | Split/preview mode, toolbar, TypeScript, lightweight for MVP (client-only, no SSR) |
| Charts | `recharts` | ^3 | MIT | Declarative, responsive, composable chart components |
| Toast notifications | `sonner` | ^2 | MIT | Promise-based toasts, stacking, swipe dismiss |
| Date picker | `react-day-picker` | ^10 | MIT | Headless date selection, style-agnostic, accessible |

## Integration Details

### @xyflow/react — Org Tree

**Why over @dnd-kit**: Product decision — xyflow provides a more visually polished graph viewport experience with zoom, pan, minimap, and smooth animated transitions out of the box.

**Architecture**:
- `PersonTree.tsx` (View): Renders `<ReactFlow>` with custom node types
- `usePersonTree.ts` (ViewModel): Computes dagre layout from flat person list, handles drag-to-reparent logic
- `PersonNode.tsx` (View): Custom node component with name, title, avatar, expand/collapse

**Layout computation** (in ViewModel, testable without DOM):

```typescript
import Dagre from "@dagrejs/dagre";

function computeTreeLayout(persons: Person[]): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  for (const p of persons) {
    g.setNode(p.id, { width: 240, height: 80 });
  }
  for (const p of persons) {
    if (p.managerId) {
      g.setEdge(p.managerId, p.id);
    }
  }

  Dagre.layout(g);

  const nodes = persons.map((p) => {
    const pos = g.node(p.id);
    return { id: p.id, position: { x: pos.x - 120, y: pos.y - 40 }, data: p, type: "person" };
  });
  const edges = persons
    .filter((p) => p.managerId)
    .map((p) => ({ id: `${p.managerId}-${p.id}`, source: p.managerId!, target: p.id }));

  return { nodes, edges };
}
```

**Drag-to-reparent**: On `onNodeDragStop`, detect nearest node (via proximity/overlap) as new parent candidate → show confirmation → call `movePerson` mutation.

**Dotted-line edges**: Rendered as dashed edges with different edge type, non-interactive (advisory only).

**Testing strategy**:
- ViewModel (`usePersonTree`): Unit test layout computation, drag validation logic, mutation calls — all via `renderHook`
- View (`PersonTree`): Lightweight render test verifying ReactFlow mounts and receives correct nodes/edges
- Interaction (E2E): Playwright tests for drag-to-reparent flow

### @pierre/diffs — Document Diff

**Integration via `@pierre/diffs/react`**:

```typescript
import { MultiFileDiff } from "@pierre/diffs/react";

function DocumentDiff({ oldContent, newContent }: Props) {
  return (
    <MultiFileDiff
      oldFile={{ name: "document.md", contents: oldContent, lang: "markdown" }}
      newFile={{ name: "document.md", contents: newContent, lang: "markdown" }}
      options={{
        diffStyle: "split",
        themes: { dark: "github-dark", light: "github-light" },
      }}
    />
  );
}
```

**API notes**:
- `MultiFileDiff`: Two-file comparison component. Props: `oldFile`, `newFile`, `options`.
- `CodeView`: Multi-file scroll container using `items`/`initialItems` + `options`. Use for version history browsing (multiple diffs in one view).
- `diffStyle`: `"split"` (side-by-side) or `"unified"` (stacked).
- `themes`: Object with `dark`/`light` keys pointing to Shiki theme names.

**Theme integration**: Use Shiki themes compatible with basalt's dark oklch palette. Load only the `markdown` language grammar to minimize bundle. Custom theme token mapping if needed via Shiki's `createTheme`.

**Vite considerations**:
- ESM-native, no special Vite config needed
- Library-owned component styles are isolated from basalt global styles
- Shiki grammars/themes loaded on-demand (first render has a small delay); preload `markdown` grammar at app startup for instant diff rendering

**Testing strategy**:
- Snapshot test: Verify component mounts with props without crashing
- Integration: Playwright visual test for rendered diff output
- No unit testing of library internals (third-party responsibility)

### @uiw/react-md-editor — Markdown Editor

**Integration**:

```typescript
import MDEditor from "@uiw/react-md-editor";

function DocumentEditor({ value, onChange }: Props) {
  return (
    <MDEditor
      value={value}
      onChange={onChange}
      preview="live"
      height={500}
    />
  );
}
```

**Vite considerations**:
- Works in CSR without issues
- If SSR is added later: requires `optimizeDeps.include: ["@uiw/react-md-editor"]` in vite.config.ts
- CSS imports are standard — compatible with Vite's CSS pipeline

**Theme override**: Apply basalt dark mode via `data-color-mode="dark"` attribute on container.

**Testing strategy**:
- ViewModel (`useDocumentEditor`): Test debounce save logic, version tracking, dirty state
- View: Render test verifying editor mounts
- E2E: Playwright test for typing → auto-save → version increment flow

### @tanstack/react-table — Data Tables

**Headless pattern**: react-table provides logic (sorting, filtering, pagination state), we provide all JSX/styling aligned with basalt.

```typescript
const table = useReactTable({
  data: documents,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});
```

**Testing strategy**:
- Column definitions: Pure functions, unit testable
- Table ViewModel: Test sort/filter/page state transitions
- View: Render test with mock data verifying row output

### react-hook-form + zod — Forms

**Shared schema pattern**:

```typescript
// @bogo/shared — used by both Worker and UI
export const personSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200),
  managerId: z.string().uuid().nullable(),
  dottedManagerId: z.string().uuid().nullable().optional(),
});

// UI ViewModel
import { zodResolver } from "@hookform/resolvers/zod";
import { personSchema } from "@bogo/shared";

const form = useForm({
  resolver: zodResolver(personSchema),
  defaultValues: { name: "", title: "", managerId: null },
});
```

**Testing strategy**:
- Zod schemas: Pure unit tests in `@bogo/shared`
- Form ViewModel: Test validation triggers, error state, submit behavior via `renderHook`
- Form View: Render test verifying fields display and error messages appear

### recharts — Analytics Charts

**Usage**: Dashboard + Analytics pages for org statistics and document activity.

**Testing strategy**:
- Data transformation (ViewModel): Unit test aggregation functions
- Chart rendering: Snapshot test verifying SVG output structure
- No pixel-perfect visual testing in unit layer (Playwright for visual regression)

### @tanstack/react-virtual — Virtual Lists

**Usage**: Document timeline (potentially thousands of documents), person list view.

```typescript
const virtualizer = useVirtualizer({
  count: documents.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 64,
});
```

**Testing strategy**:
- ViewModel: Test that correct items are computed for viewport
- View: Render test with mocked virtualizer

## Dependency Summary

```json
{
  "dependencies": {
    "@bogo/shared": "workspace:*",
    "@dagrejs/dagre": "^3",
    "@hookform/resolvers": "^5",
    "@pierre/diffs": "^1.2",
    "@tanstack/react-query": "^5",
    "@tanstack/react-table": "^8",
    "@tanstack/react-virtual": "^3",
    "@uiw/react-md-editor": "^4",
    "@xyflow/react": "^12",
    "react": "^19",
    "react-day-picker": "^10",
    "react-dom": "^19",
    "react-hook-form": "^7",
    "react-router": "^7",
    "recharts": "^3",
    "sonner": "^2",
    "zod": "^4"
  },
  "devDependencies": {
    "@testing-library/react": "^16",
    "@testing-library/user-event": "^14",
    "msw": "^2",
    "vitest": "^4"
  }
}
```

Total new production dependencies: 12 (excluding react/react-dom/react-router already present).
Test dev dependencies listed: 4 (2 already present: `@testing-library/react`, `vitest`; 2 newly added: `msw`, `@testing-library/user-event`).

## Migration Path Notes

| Library | Future upgrade path |
|---------|-------------------|
| `@uiw/react-md-editor` | → Milkdown if block editing needed |
| `recharts` | → visx if heavy custom visualization required |
| `@dagrejs/dagre` | → elkjs if layout performance degrades at scale |
