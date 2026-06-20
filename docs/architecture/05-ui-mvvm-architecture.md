# 05 — UI MVVM Architecture

## Overview

The UI follows a strict **Model–ViewModel–View** (MVVM) separation. UI components never directly call API endpoints or contain business logic. All data transformation, validation, and state orchestration live in ViewModel hooks.

## Layer Definitions

### Model (Data Layer)

The Model layer owns all external communication and raw data shapes.

| Concern | Implementation |
|---------|---------------|
| API client | Typed fetch wrapper (`api/client.ts`) |
| Entity types | Shared interfaces from `@bogo/shared` |
| Zod schemas | Shared validation schemas from `@bogo/shared` |
| React Query config | Query/mutation factories in `models/` |

**Rule**: Model code has zero React UI imports. It exports typed functions and React Query options objects.

### ViewModel (Logic Layer)

ViewModels are custom React hooks that consume Models and expose view-ready state + actions.

| Concern | Implementation |
|---------|---------------|
| Data fetching orchestration | Compose React Query hooks |
| Derived/computed state | `useMemo` / selectors over query data |
| Form state | `react-hook-form` + zod resolver |
| Tree operations | Layout computation, drag validation |
| Optimistic updates | Mutation `onMutate` / `onError` rollback |
| Navigation side effects | Router integration |

**Rule**: ViewModels are pure hooks — no JSX, no DOM refs, no styling. They are fully testable with `renderHook`.

### View (Presentation Layer)

Views are React components that consume ViewModel hooks and render UI.

| Concern | Implementation |
|---------|---------------|
| Layout & styling | Tailwind CSS classes |
| User interactions | Event handlers delegating to ViewModel actions |
| Conditional rendering | Based on ViewModel state (loading/error/data) |
| Component composition | Slot patterns, children, render props |

**Rule**: Views contain no `fetch`, no business logic, no data transformation. They read ViewModel state and call ViewModel actions.

## Directory Structure

```
packages/ui/src/
├── api/                          # Model: API client
│   ├── client.ts                 # Base fetch wrapper with auth
│   └── endpoints.ts              # Typed endpoint functions
├── models/                       # Model: React Query factories
│   ├── workspace.model.ts        # queryOptions, mutationOptions
│   ├── person.model.ts
│   ├── document.model.ts
│   ├── custom-field.model.ts
│   └── document-type.model.ts
├── viewmodels/                   # ViewModel: hook per feature
│   ├── workspace/
│   │   ├── use-workspace-list.ts
│   │   └── use-workspace-list.test.ts
│   ├── person/
│   │   ├── use-person-tree.ts
│   │   ├── use-person-tree.test.ts
│   │   ├── use-person-detail.ts
│   │   ├── use-person-detail.test.ts
│   │   ├── use-person-form.ts
│   │   └── use-person-form.test.ts
│   ├── document/
│   │   ├── use-document-list.ts
│   │   ├── use-document-list.test.ts
│   │   ├── use-document-editor.ts
│   │   ├── use-document-editor.test.ts
│   │   ├── use-document-versions.ts
│   │   └── use-document-versions.test.ts
│   └── settings/
│       ├── use-custom-fields.ts
│       ├── use-custom-fields.test.ts
│       ├── use-document-types.ts
│       └── use-document-types.test.ts
├── components/                   # View: presentational components
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   └── DashboardLayout.test.tsx
│   ├── person/
│   │   ├── PersonTree.tsx
│   │   ├── PersonNode.tsx
│   │   ├── PersonDetailPanel.tsx
│   │   └── PersonForm.tsx
│   ├── document/
│   │   ├── DocumentList.tsx
│   │   ├── DocumentEditor.tsx
│   │   ├── DocumentVersionHistory.tsx
│   │   └── DocumentDiff.tsx
│   ├── settings/
│   │   ├── CustomFieldManager.tsx
│   │   └── DocumentTypeManager.tsx
│   └── shared/
│       ├── DataTable.tsx
│       ├── EmptyState.tsx
│       ├── ErrorBoundary.tsx
│       ├── LoadingSkeleton.tsx
│       └── ConfirmDialog.tsx
├── pages/                        # View: route-level components
│   ├── DashboardPage.tsx
│   ├── PersonsPage.tsx
│   ├── DocumentsPage.tsx
│   ├── SettingsPage.tsx
│   ├── AnalyticsPage.tsx
│   └── SystemPage.tsx
├── hooks/                        # Shared utility hooks (non-ViewModel)
│   ├── use-mobile.ts
│   └── use-debounce.ts
├── lib/                          # Pure utilities
│   └── utils.ts
└── contexts/                     # React Context providers
    └── workspace-context.tsx
```

## Dependency Direction

```
View → ViewModel → Model → @bogo/shared
 │                    │
 │                    └── @tanstack/react-query
 └── Tailwind, @xyflow/react, @pierre/diffs (view-only libs)
```

**Import rules** (enforced via convention, can add ESLint boundaries later):
- `components/` and `pages/` may import from `viewmodels/`, `hooks/`, `lib/`, `contexts/`
- `viewmodels/` may import from `models/`, `lib/`, `contexts/`
- `models/` may import from `api/`, `@bogo/shared`
- `api/` may import from `@bogo/shared`
- **Never**: `models/` importing from `viewmodels/` or `components/`
- **Never**: `viewmodels/` importing from `components/`

## State Flow Example — Person Tree

```
┌─────────────────────────────────────────────────────────┐
│ PersonsPage (View)                                       │
│   └── usePersonTree() (ViewModel)                        │
│         ├── reads: personModel.listQueryOptions(wid)     │
│         ├── computes: treeLayout (dagre positions)       │
│         ├── exposes: nodes, edges, onNodeDragStop        │
│         └── mutates: personModel.moveMutation            │
│                        │                                 │
│                        ▼                                 │
│              PUT /api/w/:wid/persons/:id/move            │
│                        │                                 │
│                        ▼                                 │
│              onSuccess → invalidate query → re-render    │
└─────────────────────────────────────────────────────────┘
```

## ViewModel Contract Pattern

Each ViewModel hook returns a typed object:

```typescript
// viewmodels/person/use-person-tree.ts
interface PersonTreeVM {
  // State
  nodes: Node<PersonNodeData>[];
  edges: Edge[];
  isLoading: boolean;
  error: Error | null;

  // Actions
  onNodesChange: OnNodesChange;
  onConnect: OnConnect;
  movePerson: (personId: string, newManagerId: string) => void;
  addPerson: (parentId: string) => void;
  deletePerson: (personId: string) => void;

  // Derived
  selectedPerson: Person | null;
  setSelectedPerson: (id: string | null) => void;
}

export function usePersonTree(workspaceId: string): PersonTreeVM {
  // ... implementation using models
}
```

## Context Providers

### WorkspaceContext

Provides the currently selected workspace ID to all nested components without prop drilling.

```typescript
interface WorkspaceContextValue {
  workspaceId: string;
  workspace: Workspace;
  switchWorkspace: (id: string) => void;
}
```

Set at the layout level after workspace selection. All ViewModel hooks read from this context.

### QueryClient Provider

`@tanstack/react-query` QueryClientProvider wraps the entire app at the root. Configured with:
- `staleTime`: 30s (default)
- `gcTime`: 5min
- `refetchOnWindowFocus`: true
- `retry`: 1

## Error Boundaries

Each page has an error boundary that catches unhandled errors from ViewModels. The boundary renders a fallback UI with retry action, not a blank screen.

```
App
└── QueryClientProvider
    └── WorkspaceProvider
        └── DashboardLayout
            └── ErrorBoundary (per-page)
                └── Page → ViewModel → Model
```

## Optimistic Updates Pattern

For mutations that benefit from instant feedback (tree moves, inline edits):

```typescript
// In ViewModel
const moveMutation = useMutation({
  ...personModel.moveMutationOptions,
  onMutate: async ({ personId, newManagerId }) => {
    await queryClient.cancelQueries({ queryKey: personKeys.list(wid) });
    const previous = queryClient.getQueryData(personKeys.list(wid));
    queryClient.setQueryData(personKeys.list(wid), (old) =>
      optimisticallyMovePerson(old, personId, newManagerId)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(personKeys.list(wid), context?.previous);
    toast.error("Failed to move person");
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: personKeys.list(wid) });
  },
});
```
