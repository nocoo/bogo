# 08 — UI Test Strategy

## Overview

Target: **95%+ unit test coverage** across the UI package. This document defines what counts as "unit", where coverage gates apply, and how MVVM layering makes this achievable without testing third-party DOM internals.

## Coverage Scope

### What counts toward unit coverage (vitest)

| Layer | Testable surface | Coverage target |
|-------|-----------------|----------------|
| **ViewModel hooks** | All business logic, state transitions, computed values | 100% lines/branches |
| **Model factories** | Query key generation, request/response transforms | 100% |
| **API client** | Fetch wrapper, error mapping, auth header injection | 95%+ |
| **Zod schemas** | Validation rules (in `@bogo/shared`) | 100% |
| **Pure utilities** | `lib/utils.ts`, formatters, tree helpers | 100% |
| **Component render** | Mount/unmount, props→output, conditional rendering | 90%+ |

### What does NOT count as unit (excluded from coverage gate)

| Category | Why excluded | Where tested instead |
|----------|-------------|---------------------|
| Third-party component internals | @xyflow canvas, @pierre/diffs Shadow DOM, MDEditor | E2E (Playwright) |
| CSS/Tailwind classes | Visual correctness ≠ logic correctness | Visual regression (future) |
| React Router navigation | Integration behavior | E2E smoke tests |
| Browser APIs (matchMedia, etc.) | Stubbed in unit tests, real in E2E | E2E + existing `use-mobile.test.ts` pattern |

## Directory-Level Gate Design

Coverage gates are checked per-directory to prevent low-coverage areas from hiding behind high-coverage utilities.

```
packages/ui/vitest.config.ts → coverageThreshold:

  "src/viewmodels/**":   { lines: 98, branches: 95, functions: 98 }
  "src/models/**":       { lines: 98, branches: 95, functions: 98 }
  "src/api/**":          { lines: 95, branches: 90, functions: 95 }
  "src/lib/**":          { lines: 100, branches: 95, functions: 100 }
  "src/hooks/**":        { lines: 95, branches: 90, functions: 95 }
  "src/components/**":   { lines: 90, branches: 85, functions: 90 }
  "src/pages/**":        { lines: 85, branches: 80, functions: 85 }
  
  Global minimum:        { lines: 95, branches: 90, functions: 95 }
```

**Rationale for lower page thresholds**: Pages are thin wrappers that compose ViewModels + Components. Their logic is minimal; the ViewModel is where logic lives and is held to 98%.

## ViewModel Testing Pattern

ViewModels are the primary testing target. They are hooks with no DOM dependency, testable via `@testing-library/react` `renderHook`.

### Setup

```typescript
// viewmodels/person/use-person-tree.test.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePersonTree } from "./use-person-tree";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

### Test Categories per ViewModel

| Category | What to test | Example |
|----------|-------------|---------|
| **Initial state** | Loading/empty before data arrives | `expect(result.current.isLoading).toBe(true)` |
| **Data transformation** | Raw API → view-ready shape | Verify dagre layout produces correct positions |
| **Computed values** | Derived state from raw data | `selectedPerson` computed from `nodes + selectedId` |
| **Actions** | Mutation triggers, optimistic state | `act(() => result.current.movePerson("a", "b"))` |
| **Error handling** | Mutation failure → rollback | Mock API error, verify state reverts |
| **Edge cases** | Empty data, single node, max depth | Tree with 1 person, tree with 50 levels |

### Example: usePersonTree

```typescript
describe("usePersonTree", () => {
  it("computes dagre layout from flat person list", async () => {
    server.use(mockPersonListHandler([root, child1, child2]));
    const { result } = renderHook(() => usePersonTree("ws-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.edges).toHaveLength(2);
    // Root is at top
    expect(result.current.nodes[0].position.y).toBeLessThan(result.current.nodes[1].position.y);
  });

  it("movePerson calls API and invalidates query", async () => {
    server.use(mockPersonListHandler([root, child1]), mockMoveHandler());
    const { result } = renderHook(() => usePersonTree("ws-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.movePerson("child-1", "new-parent-id"));

    await waitFor(() => expect(moveHandlerCalled).toBe(true));
  });

  it("rejects move that would create cycle", async () => {
    // child1 is under root; moving root under child1 = cycle
    server.use(mockPersonListHandler([root, child1]));
    const { result } = renderHook(() => usePersonTree("ws-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.movePerson("root-id", "child-1"));

    expect(result.current.moveError).toBeTruthy();
  });
});
```

## Model Testing Pattern

Models export React Query options factories — pure functions that return `queryKey` and `queryFn`.

```typescript
// models/person.model.test.ts
describe("personModel", () => {
  describe("listQueryOptions", () => {
    it("generates correct query key", () => {
      const opts = personModel.listQueryOptions("ws-123");
      expect(opts.queryKey).toEqual(["workspaces", "ws-123", "persons"]);
    });

    it("queryFn calls correct endpoint", async () => {
      const fetchSpy = vi.spyOn(apiClient, "get");
      const opts = personModel.listQueryOptions("ws-123");
      await opts.queryFn({ signal: new AbortController().signal });
      expect(fetchSpy).toHaveBeenCalledWith("/api/w/ws-123/persons", expect.any(Object));
    });
  });

  describe("moveMutationOptions", () => {
    it("calls PUT with correct body", async () => {
      const fetchSpy = vi.spyOn(apiClient, "put");
      await personModel.moveMutationOptions.mutationFn({
        workspaceId: "ws-1", personId: "p-1", newManagerId: "p-2"
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/w/ws-1/persons/p-1/move",
        { body: { managerId: "p-2" } }
      );
    });
  });
});
```

## API Client Testing

```typescript
// api/client.test.ts
describe("apiClient", () => {
  it("adds workspace context header", async () => {
    const req = await apiClient.get("/api/w/ws-1/persons");
    expect(fetchMock.lastCall()?.headers?.["X-Workspace-Id"]).toBeUndefined(); // no extra header, workspace in path
  });

  it("throws typed error on 4xx", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: { code: "NOT_FOUND", message: "..." } }), { status: 404 });
    await expect(apiClient.get("/api/w/ws-1/persons/bad")).rejects.toMatchObject({
      code: "NOT_FOUND", status: 404
    });
  });

  it("retries once on 5xx", async () => {
    fetchMock.mockResponses(
      [JSON.stringify({}), { status: 500 }],
      [JSON.stringify({ data: [] }), { status: 200 }]
    );
    const result = await apiClient.get("/api/w/ws-1/persons");
    expect(result).toEqual({ data: [] });
    expect(fetchMock.mock.calls).toHaveLength(2);
  });
});
```

## Component Testing Pattern

Components are tested for **render behavior**, not styling. Use `@testing-library/react` for DOM queries.

```typescript
// components/person/PersonDetailPanel.test.tsx
describe("PersonDetailPanel", () => {
  it("renders person name and title", () => {
    render(<PersonDetailPanel person={mockPerson} onClose={vi.fn()} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
  });

  it("shows edit form when Edit clicked", async () => {
    render(<PersonDetailPanel person={mockPerson} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("John Smith");
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<PersonDetailPanel person={mockPerson} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

## Mocking Strategy

| Dependency | Mock approach |
|-----------|--------------|
| API calls | MSW (`msw`) — intercepts fetch at network level |
| React Query | Real QueryClient with `retry: false`, `gcTime: 0` |
| @xyflow/react | Mock module (no canvas in jsdom) |
| @pierre/diffs | Mock module (Shadow DOM not available in jsdom) |
| @uiw/react-md-editor | Mock module (returns simple textarea) |
| react-router | `MemoryRouter` wrapper |
| matchMedia | `vi.stubGlobal` (existing pattern) |
| IntersectionObserver | `vi.stubGlobal` with mock |

### MSW Setup

```typescript
// tests/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);

// vitest.setup.ts
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Test File Co-location

Tests live next to the code they test:

```
src/viewmodels/person/
├── use-person-tree.ts
├── use-person-tree.test.ts      ← ViewModel unit test
├── use-person-detail.ts
└── use-person-detail.test.ts

src/components/person/
├── PersonTree.tsx
├── PersonTree.test.tsx           ← Component render test
├── PersonNode.tsx
└── PersonNode.test.tsx
```

## Test Layers Summary

| Layer | Tool | Scope | Coverage gate |
|-------|------|-------|---------------|
| L1 Unit | vitest + @testing-library/react + MSW | ViewModel, Model, API, Components | 95%+ (dir-level gates) |
| L2 E2E | vitest (Worker integration) | API endpoints, D1 queries | Existing gate |
| L3 E2E | Playwright | Full user flows, visual, drag interactions | Page coverage gate |
| G1 | tsc + biome | Type safety, lint | Zero errors |
| G2 | osv-scanner + gitleaks | Dependency vulns, secrets | Zero findings |

## What Gets Mocked vs Real in Each Layer

| Concern | L1 Unit | L3 Playwright |
|---------|---------|---------------|
| API responses | MSW (mocked) | Real Worker (local dev server) |
| React Query | Real client (test config) | Real (browser) |
| @xyflow canvas | Mocked (no canvas in jsdom) | Real (browser canvas) |
| @pierre/diffs | Mocked | Real (browser Shadow DOM) |
| D1 database | Not involved | Real (local miniflare) |
| Browser APIs | Stubbed | Real |

## Achieving 95%+ Coverage

The MVVM architecture makes this feasible:

1. **ViewModels** (60% of logic): Fully testable via `renderHook` — no DOM, no canvas, no third-party UI
2. **Models** (20% of logic): Pure functions returning query options — trivially testable
3. **API client** (10% of logic): Fetch wrapper with MSW — straightforward
4. **Components** (10% of logic): Thin shells delegating to ViewModels — render tests catch conditional logic

The 5% uncovered is typically:
- Third-party library integration glue (mocked modules)
- CSS-only conditional branches in JSX (no logic impact)
- Error boundaries' fallback render (tested manually or in E2E)

## Pre-commit Integration

Unit tests run in the existing pre-commit hook (`unit_cov` gate):

```bash
# Already configured in .husky/pre-commit
vitest run --coverage
# Coverage thresholds in vitest.config.ts reject if below gate
```

Failed coverage = blocked commit. No exceptions.
