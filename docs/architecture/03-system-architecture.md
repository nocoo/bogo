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

Bogo accepts two identities:

- **Browser session** — a real human via CF Access JWT (or the `localhost`
  dev shortcut when host matches loopback). Used by the SPA, by `bogo login`,
  and by any human-driven call to the worker.
- **CLI bearer token** — a `bogo_<base64url(32)>` value the worker minted via
  `GET /api/auth/cli` during a browser-login callback (see `docs/features/02-cli.md`).
  Used by the clip-generated `bogo` CLI and by automation scripts.

`packages/worker/src/middleware/access-auth.ts` resolves identity by trying
three branches in this exact order. The order is load-bearing: any other
order lets a revoked CLI token fall through to a shortcut and silently
re-authenticate.

```
                  ┌─────────────────────────────────────────┐
  Authorization?  │ Bearer bogo_*  →  bearer branch         │  ← MUST run first
                  │   sha256(plain) → SELECT api_tokens     │     so revoked tokens
                  │   reject if row missing / revoked_at /  │     don't fall through
                  │   expires_at < now                      │     to the localhost
                  │   set userEmail = owner_email           │     shortcut on
                  │   set authMethod = "bearer"             │     wrangler dev.
                  │   waitUntil(UPDATE last_used_at)        │
                  └─────────────────────────────────────────┘
                                       │ no match
                                       ▼
                  ┌─────────────────────────────────────────┐
  Host is local?  │ localhost / 127.0.0.1 / *.dev.hexly.ai  │
                  │   set userEmail = "dev@localhost"       │
                  │   set authMethod = "localhost"          │
                  └─────────────────────────────────────────┘
                                       │ no match
                                       ▼
                  ┌─────────────────────────────────────────┐
  Production:     │ Cf-Access-Jwt-Assertion required        │
                  │   verify against CF JWKS (cached)       │
                  │   set userEmail = payload.email         │
                  │   set authMethod = "cf-access-jwt"      │
                  └─────────────────────────────────────────┘
```

**Browser path (unchanged):**

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

**CLI bearer path:**

```
CLI                       Worker (browser session)         D1
 │                          │                              │
 ├─ bogo login              │                              │
 │   open loopback server   │                              │
 │   open browser to ──────▶│  GET /api/auth/cli?callback=…│
 │                          ├── authMethod ∈ {jwt, local}  │
 │                          │                              │
 │                          │  Stage 1: no `confirm` query │
 │                          ├── render consent HTML        │
 │                          │   Set-Cookie bogo_cli_csrf=… │
 │                          │     HttpOnly, SameSite=Strict│
 │                          │   CSP frame-ancestors 'none' │
 │                          │   form-action 'self'         │
 │                          │   X-Frame-Options DENY       │
 │  200 HTML  ◀─────────────┤                              │
 │                          │                              │
 │   (user clicks Authorize)│                              │
 │                          │  GET /api/auth/cli?…&confirm=│
 │                          │  + Cookie bogo_cli_csrf=…    │
 │                          │                              │
 │                          │  Stage 2: confirm == cookie? │
 │                          ├── constant-time compare      │
 │                          ├── generateToken (bogo_…)     │
 │                          ├── hash = sha256(plain)       │
 │                          ├── DB.batch([ ───────────────▶│
 │                          │     UPDATE … revoked_at=now  │
 │                          │       WHERE owner_email=?    │
 │                          │       AND label='cli-login'  │
 │                          │       AND revoked_at IS NULL,│
 │                          │     INSERT api_tokens …      │
 │                          │   ])                         │
 │                          ├── Set-Cookie maxAge=0        │
 │   302 to loopback ◀──────┤   (single-shot cookie)       │
 │   write credentials.json │                              │
 │   (chmod 600)            │                              │
 │                          │                              │
 ├─ bogo me                 │                              │
 │   Authorization:         │                              │
 │     Bearer <token> ─────▶│                              │
 │                          ├── sha256(token) → SELECT ───▶│
 │                          │   row, revoked_at IS NULL,   │
 │                          │   expires_at IS NULL ‖ future│
 │                          ├── set userEmail              │
 │                          │   = owner_email              │
 │                          │   authMethod = "bearer"      │
 │   JSON ◀─────────────────┤                              │
```

The Stage 1 / Stage 2 split is anti-CSRF: a third-party page that
embeds `<img src=…/api/auth/cli?callback=evil_loopback>` cannot read
the SameSite=Strict cookie and cannot guess a matching `confirm`,
so the worst it triggers is the no-op Stage 1 HTML response. The
CSP / X-Frame-Options block iframe-and-overlay clickjacking on
the consent page itself. See `docs/features/02-cli.md` §2.3 / §5.4
for the full threat model.

Issuing a new CLI token always revokes the prior `cli-login` row
for the same owner via the atomic D1 batch above — one active CLI
token per identity, no unbounded growth, leaked tokens die the
moment the user re-runs `bogo login`.

**Bearer revocation (v1):** manual `UPDATE api_tokens SET revoked_at = …`
against the live D1 (see `docs/features/02-cli.md` §775-779). A phase 2
`/api/auth/tokens/*` surface is planned but explicitly out of scope here.

**Key points:**
- CF Access protects the production domain with a Bypass policy for
  `/api/live` (health check must be reachable by uptime monitors without
  auth).
- **CF Access also needs a Bypass policy for CLI bearer traffic**, otherwise
  `Authorization: Bearer bogo_*` requests are blocked at the edge before
  they reach the Worker. Configure Zero Trust → Access → Applications →
  bogo → Policies with Action `Bypass`, Selector `Request Header`,
  Header name `Authorization`, Operator `starts with`, Value
  `Bearer bogo_`. See `docs/features/02-cli.md` §7 for the full table and
  the rationale (the bypass is a CF-side admission gate; the Worker still
  performs the real authorisation by hashing the token and checking
  `revoked_at` / `expires_at` against D1 — the bypass is **not** a trust
  boundary). `/api/auth/cli` itself must **not** be added to the bypass:
  it requires the caller to already be a real CF Access JWT (or localhost)
  identity so `userEmail` can be set.
- `/api/live` middleware bypass only applies to non-bearer, non-localhost
  hosts — a present `Bearer bogo_*` still goes through the bearer branch
  and is validated/rejected normally, so a revoked CLI token cannot quietly
  reach `/api/live` either.
- JWT verification uses CF's published JWKS endpoint (cached).
- `owner_id` (workspaces) comes from the `sub` claim (stable identifier).
  `owner_email` (api_tokens) is the human-readable address mirrored from
  the same browser session that minted the token.
- The Worker never stores passwords or browser sessions — that auth is fully
  delegated to CF Access. The Worker DOES store CLI token hashes (never the
  plaintext: only `sha256(plain).hex` + the first 12 chars as a display
  prefix; see `migrations/0004_api_tokens.sql`).
- `/api/auth/cli` itself **refuses** to mint a token for a request whose
  `authMethod === "bearer"`. Without this gate, a leaked CLI token would
  be able to extend its own lifetime indefinitely by minting more tokens.
- See `docs/features/02-cli.md` for the full CLI auth design, including the
  loopback callback protocol and the threat model.

## API Design

### Base URL

All API routes are prefixed with `/api`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/live` | Health check for non-bearer requests; CF Access bypassed and Worker middleware short-circuits before auth. A present `Bearer bogo_*` is still resolved through the bearer branch first, so revoked CLI tokens cannot quietly reach this endpoint. |
| GET | `/api/me` | Current authenticated identity (`{ data: { email } }`) |
| GET | `/api/auth/cli` | Two-stage browser-login consent flow for the bogo CLI. Stage 1 (no `confirm` query) returns an HTML consent page with a HttpOnly + SameSite=Strict CSRF cookie; Stage 2 (matching `confirm`) atomically revokes any prior `cli-login` row for the owner, mints a `bogo_*` bearer, and 302s to the caller's loopback `/callback`. Rejects `authMethod === "bearer"` to prevent self-minting. See `docs/features/02-cli.md` §5.4. |
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

## CLI Authentication

The bogo CLI is a separate top-level surface generated from the repo-root
`clip.yaml` by [clip](https://github.com/nocoo/clip) (`clip generate`). It
reuses the same worker endpoints as the SPA, but identifies itself via a
bearer token instead of a CF Access JWT.

**Boundary summary** (full design in `docs/features/02-cli.md`):

- The CLI source code is **not** in this repo — only the schema
  (`clip.yaml`) and the worker-side support (the `api_tokens` table, the
  `/api/auth/cli` endpoint, the Bearer branch in `access-auth.ts`, the
  `personIds` / `options` query CSV bridge).
- **Production CF Access deployment requirement**: bearer traffic does not
  reach the Worker unless a Bypass policy on
  `Authorization starts with "Bearer bogo_"` is in place. See
  `docs/features/02-cli.md` §7 for the policy table and the rationale; the
  Worker still performs the real authorisation against the `api_tokens`
  hash, so the CF Access bypass is an admission filter, not a trust
  boundary.
- `bogo login` mints exactly one token per call. Tokens never expire by
  default (`expires_at` is NULL); revocation is manual
  `UPDATE api_tokens SET revoked_at=…`.
- Token plaintext crosses the wire once (the `api_key` query parameter on
  the loopback redirect). The worker persists only `sha256(plain).hex` plus
  the first 12 characters as a display prefix.
- The CLI persists the plaintext under `$CLIP_HOME/bogo/credentials.json`
  with mode `0o600`.
- The `personIds` / `options` query-CSV bridge in
  `documents.ts` / `fields.ts` exists only because clip codegen cannot send
  arrays via JSON body. The body shape continues to win for UI /
  programmatic callers.

**Self-tests:** `tests/cli-e2e/smoke.test.ts` exercises the entire chain
(login → CRUD → revoke → 401) by generating a temporary CLI against the
current `clip.yaml`, running it under an isolated `CLIP_HOME`, and revoking
the minted token via a direct D1 UPDATE against the same `--persist-to`
directory wrangler dev is reading. Pre-push and CI both gate on it; see
`docs/features/02-cli.md` §9 for the gate definitions.

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
