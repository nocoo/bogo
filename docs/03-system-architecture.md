# 03 — System Architecture

## Overview

Bogo is a single-page application backed by a Cloudflare Worker. The Worker serves both the API and the static frontend assets. Authentication is handled externally by Cloudflare Access.

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                        │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  CF Access    │───▶│        Worker (Hono)         │   │
│  │  (JWT Gate)   │    │                              │   │
│  └──────────────┘    │  ┌─────────┐  ┌───────────┐  │   │
│                      │  │  API     │  │  Static   │  │   │
│                      │  │  Routes  │  │  Assets   │  │   │
│                      │  └────┬─────┘  └───────────┘  │   │
│                      │       │                        │   │
│                      └───────┼────────────────────────┘   │
│                              │                            │
│  ┌───────────┐       ┌──────▼──────┐                     │
│  │    R2     │       │     D1      │                     │
│  │ (future)  │       │  (SQLite)   │                     │
│  └───────────┘       └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Package Responsibilities

### `@bogo/shared`

Shared constants, types, and utilities consumed by both Worker and UI.

- `BOGO_VERSION` — build-time version string
- Shared TypeScript types (entity interfaces, API request/response shapes)
- Validation schemas (zod) reused in both layers
- UUIDv7 generation utility

### `@bogo/worker`

Cloudflare Worker running Hono framework.

Responsibilities:
1. **Authentication middleware** — Validate CF Access JWT, extract user identity
2. **API routes** — RESTful JSON endpoints for all CRUD operations
3. **Static asset serving** — Serve Vite-built SPA via Workers Sites / static assets binding
4. **Database access** — D1 binding, prepared statements, migrations
5. **Business logic** — Tree validation, version management, workspace scoping

### `@bogo/ui`

Vite React SPA (TypeScript, Tailwind CSS).

Responsibilities:
1. **Routing** — react-router v7, nested layouts
2. **State management** — React Query for server state, local state for UI
3. **Rendering** — Basalt design system, responsive layout
4. **CRUD interfaces** — Forms, tree visualization, document editor

## Authentication Flow

```
Browser                  CF Access                Worker
   │                        │                       │
   ├── GET /app ───────────▶│                       │
   │                        ├── JWT in cookie ──────▶│
   │                        │                       ├── Verify JWT
   │                        │                       │   (JWKS from CF)
   │                        │                       ├── Extract sub/email
   │                        │                       ├── Resolve workspace(s)
   │◀─────────────────────────────── 200 + SPA ─────┤
   │                        │                       │
   ├── GET /api/workspaces ─┼───────────────────────▶│
   │                        │                       ├── JWT valid?
   │                        │                       ├── owner_id = sub
   │◀─────────────────────────────── JSON ──────────┤
```

**Key points:**
- CF Access protects the domain with a bypass rule for `/api/live` (health check must be reachable by uptime monitors without auth)
- All other routes require a valid CF Access JWT in the `CF-Authorization` cookie
- JWT verification uses CF's published JWKS endpoint (cached)
- `owner_id` comes from the `sub` claim (stable identifier)
- The Worker never stores passwords or sessions — auth is fully delegated
- The Worker's auth middleware skips `/api/live` and applies to all other `/api/*` routes

## API Design

### Base URL

All API routes are prefixed with `/api`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/live` | Health check (CF Access bypass + no Worker auth) |
| GET | `/api/workspaces` | List user's workspaces |
| POST | `/api/workspaces` | Create workspace |
| PUT | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |
| GET | `/api/w/:wid/persons` | List persons (flat or tree) |
| POST | `/api/w/:wid/persons` | Create person |
| PUT | `/api/w/:wid/persons/:id` | Update person |
| DELETE | `/api/w/:wid/persons/:id` | Delete person |
| PUT | `/api/w/:wid/persons/:id/move` | Move person in tree |
| GET | `/api/w/:wid/fields` | List custom field definitions |
| POST | `/api/w/:wid/fields` | Create field definition |
| PUT | `/api/w/:wid/fields/:id` | Update field definition |
| DELETE | `/api/w/:wid/fields/:id` | Delete field definition |
| GET | `/api/w/:wid/documents` | List documents (filterable) |
| POST | `/api/w/:wid/documents` | Create document |
| GET | `/api/w/:wid/documents/:id` | Get document with versions |
| PUT | `/api/w/:wid/documents/:id` | Update document (auto-versions) |
| DELETE | `/api/w/:wid/documents/:id` | Delete document |
| GET | `/api/w/:wid/document-types` | List document types |
| POST | `/api/w/:wid/document-types` | Create document type |
| PUT | `/api/w/:wid/document-types/:id` | Update document type |
| DELETE | `/api/w/:wid/document-types/:id` | Delete document type |

### URL Convention

- `/api/w/:wid/...` — workspace-scoped routes. `:wid` is validated against the authenticated user's ownership.
- Short prefix `w` keeps URLs concise.

### Request/Response Format

```typescript
// Success
{ "data": T }

// Error
{ "error": { "code": string, "message": string } }
```

### Workspace Scoping Middleware

The path parameter `:wid` is the only source of workspace identity. No body or query parameter can supply or override `workspace_id`. The middleware validates ownership before any handler executes.

```typescript
// Pseudocode — runs before every /api/w/:wid/* handler
async function workspaceGuard(c: Context, next: Next) {
  const userId = c.get("userId"); // from auth middleware
  const wid = c.req.param("wid"); // path param — validated against ownership

  const ws = await db.get("SELECT id FROM workspaces WHERE id = ? AND owner_id = ?", [wid, userId]);
  if (!ws) return c.json({ error: { code: "WORKSPACE_NOT_FOUND", message: "..." } }, 404);

  c.set("workspaceId", wid);
  await next();
}
```

## Data Flow — Document Edit Example

```
UI                          Worker                         D1
 │                            │                             │
 ├─ PUT /api/w/:wid/docs/:id ▶│                             │
 │   { title, content }       │                             │
 │                            ├─ BEGIN batch ────────────────▶│
 │                            │  next_ver = version + 1      │
 │                            │  INSERT document_versions    │
 │                            │    (ver=next_ver, NEW content)│
 │                            │  UPDATE documents            │
 │                            │    (content=new, ver=next_ver)│
 │                            ├─ COMMIT ────────────────────▶│
 │                            │                             │
 │◀──── 200 { data: doc } ───┤                             │
```

## Error Handling

| Layer | Strategy |
|-------|----------|
| Worker middleware | Catch-all → 500 with generic message (no stack in prod) |
| Route handlers | Explicit validation → 400 with field-level errors |
| D1 constraint violations | Catch UNIQUE/FK errors → map to 409/404 |
| UI | React Query error boundaries, toast notifications |

## Build & Deploy Pipeline

```
bun install
  │
  ├─ turbo build
  │    ├─ @bogo/shared (tsc)
  │    ├─ @bogo/ui (vite build → dist/)
  │    └─ @bogo/worker (bundles UI dist as static assets)
  │
  ├─ turbo check (typecheck + lint)
  ├─ turbo test (vitest unit + playwright E2E)
  │
  └─ wrangler deploy (Worker + static assets + D1 migrations)
```

**CI/CD**: GitHub Actions on push to `main`. Release workflow deploys to production after all checks pass.

## Performance Considerations

- **D1 locality**: D1 is colocated with the Worker. Single-region, no cross-region latency.
- **Static assets**: Served from Workers KV (via static assets binding), cached at edge.
- **Bundle size**: Vite tree-shakes unused code. Shared package is minimal.
- **Query efficiency**: All list endpoints support pagination (`?cursor=&limit=`). Default limit: 50.
