# Bogo

Personal knowledge base for people, documents, and workspaces (`bogo.hexly.ai`).
Profile: ts-worker-web
Direction: [docs/architecture/03-system-architecture.md](docs/architecture/03-system-architecture.md). CLI hosts: [docs/features/02-cli.md](docs/features/02-cli.md). Frameworks must not rewrite this file.

## Sources of Truth

This file is the **contract**. Hooks, CI, and config are **enforcement**. If they disagree, raise enforcement; never lower this file.

| Fact | Where |
|---|---|
| Agent handbook | this file |
| Human docs | README.md, `docs/architecture/*`, `docs/features/*` |
| Version | root `package.json`; also `clip.yaml` + `BOGO_VERSION` via `scripts/bump-version.ts` |
| Enforcement | `.husky/*`, `.github/workflows/{ci,release}.yml`, vitest configs |
| Machine rules | global `AGENTS.md`, `rules/git-commit.md` |
| Accidents | [Retrospective.md](Retrospective.md) |
| Env files | `packages/worker/.dev.vars` gitignored. Secrets: `wrangler secret put` |

## Project Invariants

- Browser `bogo.hexly.ai` (Access). CLI API `api.bogo.hexly.ai` (no Access app). Consent stays `/api/auth/cli` on the Access host. Do not restore an Access Bypass on `Authorization`.
- `clip.yaml` `loginUrl` = Access host; `baseUrl` = API host. `CLIP_BASE_URL` overrides `baseUrl` only, not `loginUrl`. CLI source is clip-generated; do not hand-edit it.
- Vite :7036 (`https://bogo.dev.hexly.ai`) proxies `/api` to wrangler :37036, not prod. localhost / `*.dev.hexly.ai` skip Access JWT.
- `seed:local` and E2E are `--local --persist-to` only. Never `--remote`. L2 `.wrangler/e2e` :17036; L3 `.wrangler/e2e-pw` :27036. Not 8787.
- `bun run deploy` races CD. Bump with `scripts/bump-version.ts`. Worker CD is `release.yml`. `@nocoo/bogo` npm publish is not in CD.
- `gate:routes` is a static `(method, path)` scan vs e2e files.

## Stack / Layout

| Component | Choice |
|---|---|
| Language | TypeScript 7 strict |
| Package manager | Bun + Turbo (`packageManager` bun@1.3.14; CI/CD pin 1.3.11) |
| Runtime | Cloudflare Workers (Hono) + Vite SPA + clip-generated CLI |
| Lint | Biome `check --error-on-warnings .` |
| Tests | Vitest L1; wrangler L2; Playwright L3; `tests/cli-e2e` |
| Data | D1 `bogo` |

```
packages/{shared,worker,ui,cli}    docs/{architecture,features}    clip.yaml
```

## Commands

```bash
bun run seed:local
bun run dev
bun run typecheck && bun run lint && bun run build
bun run test:unit:coverage
bun turbo test:e2e --filter=@bogo/worker
cd packages/ui && bunx playwright test
bun run test:cli-e2e
bun scripts/bump-version.ts patch
```

## Verification

Status: `enforced` | `planned` | `manual` | `N/A`. `enforced` Evidence = hook/CI/config/script.

Org gaps: index-snapshot pre-commit; stdin-range pre-push; `.skip`/`.only`. `check-coverage.sh 90 95` prints those numbers; vitest configs enforce (worker/ui 95/90/95/95, shared 95 all).

Today: pre-commit coverage/typecheck/full lint/gitleaks/gates on the working tree. pre-push L2 + G2 + clip.yaml + CLI e2e (`BOGO_SKIP_CLI_E2E=1` locally; CI `BOGO_REQUIRE_CLI_E2E=1`). CI bun-quality `@aec4adc1a817c56790d1698329ef9398a15a754a` (v2026.5) + L2 + L3 + CLI e2e.

| Change | Proof | Status | Evidence |
|---|---|---|---|
| Logic | L1 vitest thresholds above | enforced | pre-commit `check-coverage.sh`; CI `test:unit:coverage` |
| API L2 | wrangler `--local`; structural `/api` | enforced | pre-push + CI `l2-e2e`; `gate:routes` |
| UI L3 | Playwright Chromium | enforced | CI `l3-playwright` |
| CLI e2e | generated `bogo` login/CRUD/revoke | enforced | pre-push + CI (local skip hatch) |
| Types / lint | tsc + Biome 0 warning | enforced | pre-commit + CI |
| G2 secrets | gitleaks | enforced | pre-commit `--staged`; pre-push + CI |
| G2 deps | osv `bun.lock` | enforced | pre-push `gate:security`; CI |
| Bundler | `turbo build --filter=@bogo/ui` | enforced | CI L2/L3/cli-e2e build |
| Docs | feature/arch doc if behavior changes | manual | human review |
| Worker CD | tag + CI-green `main` | enforced | `.github/workflows/release.yml` |
| npm `@nocoo/bogo` | publish generated CLI | planned | — |

| Hook | Org bar | Status | Evidence |
|---|---|---|---|
| pre-commit | index snapshot | planned | — |
| pre-push | stdin ref range | planned | — |

`--no-verify` forbidden on commits and branch pushes. Tag-only may skip.

## Resources / Isolation

| Purpose | Port / resource | Isolation |
|---|---|---|
| Dev UI | 7036 `https://bogo.dev.hexly.ai` | Caddy → Vite; `/api` → :37036 |
| Dev worker | 37036 | local D1; `seed:local` |
| L2 | 17036 | `--local --persist-to .wrangler/e2e` |
| L3 | 27036 | `--local --persist-to .wrangler/e2e-pw` |

## Operations / Release

- Worker: `bun scripts/bump-version.ts patch`, commit, tag `vX.Y.Z`, push. Who: GitHub write + `production` Environment. CD: `release.yml`. No laptop `wrangler deploy`.
- npm `@nocoo/bogo` is not published by CD (repo version can lead npm). Live-check: `https://bogo.hexly.ai`, `https://api.bogo.hexly.ai`. Runbook: [docs/features/02-cli.md](docs/features/02-cli.md).

## Retrospective

| Kind | Where |
|---|---|
| Accident narrative | [Retrospective.md](Retrospective.md) |
| Recurring project rule | one line here (cap ~10) |
| Checkable rule | hook or test |

- `api.bogo.hexly.ai` has no Access app; do not restore header Bypass.
- `seed:local` and E2E stay `--local`. Never `--remote`.
- Do not `wrangler deploy` from a laptop.
