# Bogo

Personal knowledge base for people, documents, and workspaces: Hono Cloudflare Worker + D1 (`bogo`), Vite React SPA (`@nocoo/basalt`), and `clip`-generated CLI (`@nocoo/bogo`).
Docs: [README.md](README.md) · [Architecture](docs/architecture/03-system-architecture.md) · [CLI design](docs/features/02-cli.md) · [Sidebar acceptance](docs/verification/basalt-3.3.4.md) · [Retrospective](Retrospective.md)

Workspaces: `packages/shared/` (types/version), `packages/worker/` (Hono API/D1), `packages/ui/` (dashboard), `packages/cli/` (generated CLI), plus `clip.yaml` and `tests/cli-e2e/`.

## Commands

Run from root with Bun 1.3.14 / Turbo and TypeScript 7 (CI/CD pins Bun 1.3.11). Build UI assets before HTTP, browser, or CLI integration. CLI tests require `clip` on `PATH` or a sibling `../clip` checkout; Playwright requires Chromium.

```sh
bun install --frozen-lockfile             # installs deps and restores Husky hooks
bun run seed:local && bun run dev         # UI 7036 (bogo.dev.hexly.ai) -> Worker 37036
bun run typecheck                         # S1
bun run lint                              # S2 biome check --error-on-warnings (0 warnings)
bun run build                             # B1 builds @bogo/ui into packages/worker/static
bun run test:unit:coverage                # L1 coverage across shared, worker, ui
bun turbo test:e2e --filter=@bogo/worker  # L3 Worker API integration (unset CF_* env vars)
bun run test:e2e:pw                       # L4 Playwright browser E2E
bun run test:cli-e2e                      # L4 clip-generated CLI E2E
bun run gate:routes                       # API route map completeness
bun run gate:pages                        # UI page map completeness
bun run gate:clip-yaml                    # clip.yaml codegen completeness
bun run gate:security                     # G2 osv-scanner + gitleaks
```

## Invariants

- `bogo.hexly.ai` stays Access-protected (including `/api/auth/cli`); `api.bogo.hexly.ai` has no Access app and requires hashed `Bearer bogo_*` tokens. Never restore an Authorization-header Access bypass.
- `clip.yaml` keeps `loginUrl` on the Access host and `baseUrl` on the API host; `CLIP_BASE_URL` overrides only the API URL. CLI source is generated—edit `clip.yaml`/templates, not generated output.
- Vite `7036` (`bogo.dev.hexly.ai`) proxies `/api` to local Worker `37036`. Existing localhost/dev-domain Access bypass must never expand to production hosts.
- Root `package.json` owns the version; `bun scripts/bump-version.ts <patch|minor|major>` syncs all workspace manifests, `BOGO_VERSION`, and `clip.yaml`. Keep local secrets in ignored `packages/worker/.dev.vars`.
- Local seeds and E2E must never use `--remote` or prod data; no remote `-test` Worker/D1 is needed. Worker API E2E refuses inherited `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or `CF_API_TOKEN`.
- Keep viewmodels free of View/DOM imports and routes thin; route/page maps are structural evidence, not complete behavior proof.
- UI uses `@nocoo/basalt@^3.5.1` in `packages/ui/package.json`; follow `system1-design-basalt` and [sidebar acceptance](docs/verification/basalt-3.3.4.md).
- Worker CD belongs to `.github/workflows/release.yml`; never run `bun run deploy` concurrently. Authorized releases bump version, review changelog, push commit, verify CI, then push the matching tag.
- `@nocoo/bogo` npm publication is separate from Worker CD (so npm may lag git). Verify live results on `bogo.hexly.ai` and `api.bogo.hexly.ai`; publication steps live in [CLI design](docs/features/02-cli.md).

## Quality & Local Gates

Follows `system1-quality`; CI slot definitions and pinned `base-ci` revision live in `.github/workflows/quality-slots.yml` (called by `.github/workflows/ci.yml`; `quality / Z1: Gate` required on `main`, including `L4: E2E (CLI)`). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions / gaps**: `L2 Runtime` is `N/A` (verified via `L3` integration API suite); `P1 Package` is `N/A` (Worker deploys to Cloudflare, not npm). `L3`, `L4`, and `L4: E2E (CLI)` reuse the `B1` build artifact (`packages/shared/dist` and `packages/worker/static`).
- **Coverage / hook gaps**: `shared`, `worker`, and `ui` all enforce 80% × 4 metrics (`ui` excludes View/context `.tsx` shells covered by L4 E2E) with Vitest `allowOnly`/`passWithNoTests` guards enforced; `pre-push` stdin ref checks are `planned`.
- **Local hooks**: `bun install` restores `.husky/` (`prepare`); hooks are check-only—never use `--no-verify`. Keep rejection probes when editing hooks.
- **`pre-commit`**: runs on staged Git index snapshot (`G1` staged `gitleaks`, `shared` build, `S1`, `S2`, `gate:routes`, `gate:pages`, `L1` `scripts/check-coverage.sh`; `<30s` warm).
- **`pre-push`**: runs `L3` Worker API E2E, `G2` `gate:security`, and `gate:clip-yaml` in parallel, then `test:cli-e2e` (`<3min`). CI sets `BOGO_REQUIRE_CLI_E2E=1`; `BOGO_SKIP_CLI_E2E` must not bypass verification.

## Resources & Isolation

| Lane         | Endpoint / State                                                    | Boundary                                                             |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Daily dev    | UI `127.0.0.1:7036` (`bogo.dev.hexly.ai`), Worker `127.0.0.1:37036` | Local dev D1 + `bun run seed:local`; never reused by automated tests |
| Worker / CLI | Allocated loopback ports; per-run temp stores                       | Owned local Wrangler config, isolated `HOME`, marker-checked D1      |
| Browser (PW) | `127.0.0.1:27036`; per-run temp store                               | Fresh owned server (`reuseExistingServer: false`), `SIGTERM` cleanup |
| Prod         | `https://bogo.hexly.ai`, `https://api.bogo.hexly.ai`                | Read-only checks unless release/deployment is authorized             |

Required harnesses reject remote bindings/credential fallback, allocate fresh local SQLite state, and verify `_test_marker(key,value)` (`env=test`) before fixture resets or cleanup. Keep prod and daily-dev stores physically separate from every test lane.

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above, cross-project lessons to global rules, and deterministic checks to hooks or tests.
