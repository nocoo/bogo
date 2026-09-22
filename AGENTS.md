# Bogo

Personal knowledge base for people, documents and workspaces, with a web dashboard and generated CLI.
Profile: ts-worker-web.
Human overview: [README.md](README.md). Direction: [architecture](docs/architecture/03-system-architecture.md) and [CLI design](docs/features/02-cli.md). Frameworks must not rewrite this file. Maintain this root `AGENTS.md` as the only project handbook; do not create a `CLAUDE.md` alias, copy or import.

## Sources of Truth

This file is the contract; hooks, CI and configuration enforce it. Raise weaker enforcement instead of lowering this contract.

| Fact | Where |
|---|---|
| Human docs | [README.md](README.md), `docs/architecture/`, `docs/features/` |
| Version | Root `package.json`; `clip.yaml` and `BOGO_VERSION` updated by `scripts/bump-version.ts` |
| Enforcement | `.husky/`, CI/release workflows, package Vitest configs and scripts |
| Local secrets | Ignored `packages/worker/.dev.vars`; production secrets managed separately |
| Machine rules / accidents | Global `AGENTS.md` and `rules/`; [Retrospective.md](Retrospective.md) |

## Project Invariants

- Browser host `bogo.hexly.ai` stays Access-protected, including consent at `/api/auth/cli`. API host `api.bogo.hexly.ai` has no Access application but requires hashed `Bearer bogo_*` token validation. Never restore an Authorization-header Access bypass.
- `clip.yaml` keeps `loginUrl` on the Access host and `baseUrl` on the API host. `CLIP_BASE_URL` overrides only the API URL. CLI source is generated: edit the schema/templates rather than hand-editing generated output.
- Vite 7036 (`bogo.dev.hexly.ai`) proxies `/api` to local Worker 37036. Existing localhost/dev-domain Access bypass must not expand to production hosts.
- Local seeds and E2E must never use `--remote` or production data. No remote `-test` Worker/database is required.
- Keep viewmodels free of View/DOM imports and routes thin. Route/page map coverage is structural evidence, not complete behavior proof.
- Worker CD belongs to `release.yml`. `bun run deploy` would race it; npm publication of `@nocoo/bogo` is a separate operation.

## Stack / Layout

| Component | Choice |
|---|---|
| Runtime / install | TypeScript 7, Bun 1.3.14/Turbo; CI/CD pins Bun 1.3.11 |
| App / data | Hono Cloudflare Worker, D1 `bogo`, Vite SPA, clip-generated CLI |
| Static / tests | TypeScript, Biome, Vitest, local HTTP, Playwright and Bun CLI E2E |
| `packages/shared/`, `packages/worker/` | Types and API/data layer |
| `packages/ui/`, `packages/cli/` | Dashboard and generated CLI |
| `clip.yaml`, `tests/cli-e2e/` | Code-generation contract and CLI journeys |

## Commands

Run from the root after a frozen Bun install. Build assets before HTTP/browser/CLI integration. CLI tests need the `clip` generator or a prepared sibling `clip` checkout; CI requires it. Chromium is required for Playwright.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run build
bun run test:unit:coverage
bun turbo test:e2e --filter=@bogo/worker
bun run test:e2e:pw
bun run test:cli-e2e
bun run gate:clip-yaml
bun run gate:security
```

Daily local development uses `bun run seed:local`, then `bun run dev`. Do not reuse that seed store for automated tests. L2 refuses inherited `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` or `CF_API_TOKEN`; run with those variables unset.

## Verification

6DQ = L1/L2/L3 + G2 + D1; the former G1 dimension was merged into L1 on 2026-09-21. Status: `enforced`, `planned`, `manual`, `N/A`.

| Dimension | Required proof | Status | Current enforcement / gap |
|---|---|---|---|
| L1 logic (incl. former G1 static) | Statements, branches, functions and lines each ≥95%; no `.skip` / `.only`; strict types and check-only lint with zero errors/warnings | planned | Static lane is enforced (commit full lint/typecheck plus CI). Coverage remains partial: shared is four-metric 95%, Worker/UI branches remain 90%; coverage script arguments only print values while Vitest configs enforce them; no complete skip/focus gate and no index-snapshot/timing/rejection proof |
| L2 API | Real local HTTP over 100% of endpoint/method combinations | planned | Commit route gate and push/CI real HTTP suite exist; structural method/path hits do not prove assertion completeness |
| L3 workflows | Critical dashboard and generated CLI login/CRUD/revoke | enforced | CI Playwright and CLI jobs; pre-push CLI checks have a local skip hatch, which must not be used to bypass verification |
| G2 security | Dependency and secret scans; missing tools fail | enforced | Commit staged secrets, push security runner, CI shared scanners; local push range still relies on upstream/fallback |
| D1 isolation | Local per-run state, guarded fixture writes/cleanup and marker | planned | L2 rejects remote credentials but uses fixed `.wrangler/e2e`; L3 shares `.wrangler/e2e-pw`, reuses servers and lacks complete per-run/marker guards |
| Build | Real UI bundle before local/production serving | enforced | CI prepares assets for L2/L3/CLI E2E and release |
| Docs / npm | API/schema and intended publication reviewed | manual | Feature/architecture docs; npm is not published by Worker CD |

| Hook | Current behavior | Required follow-up |
|---|---|---|
| pre-commit | Working-tree coverage/types/full lint/staged secrets/routes/pages | Unified L1 (types, check-only lint, coverage) on index snapshot, <30s |
| pre-push | Worker L2, G2, clip YAML in parallel, then CLI E2E | Verify stdin push refs, <3min |

CI sets `BOGO_REQUIRE_CLI_E2E=1`; local `BOGO_SKIP_CLI_E2E` exists but must not bypass verification. Install restores Husky. Hooks are check-only; never use `--no-verify` on commits or branch pushes. Shared workflows are pinned at `ad43150de3a2be2fa464b5cd2f921dc4fa9f8f0f`.

## Resources / Isolation

| Lane | Port / directory | Boundary |
|---|---|---|
| Daily dev | UI 7036, Worker 37036 | Local dev database and explicit seed command |
| L2 | 17036, `.wrangler/e2e` | Local Wrangler; per-run directory still needed |
| L3 | 27036, `.wrangler/e2e-pw` | Local Wrangler; no shared-server reuse in the required design |

Required harnesses reject remote bindings/credential fallback, allocate fresh local SQLite state and verify `_test_marker(key,value)` with `env=test` before fixture resets or cleanup. Keep production and daily-dev stores physically separate from every automated lane.

## Operations / Release

Authorized maintainers use `bun scripts/bump-version.ts patch`, review the synchronized version/changelog, commit and push normally, verify CI and push the matching tag. CD owns the Worker; never deploy it concurrently from a laptop.
The npm package can lag the repository because CD does not publish it. Verify the requested result on `bogo.hexly.ai` and `api.bogo.hexly.ai`; publication procedures and host boundaries are in [CLI docs](docs/features/02-cli.md).

## Retrospective

Narratives remain in [Retrospective.md](Retrospective.md); keep only recurring rules here, cross-project lessons in global rules/nmem and deterministic requirements in hooks/tests.
