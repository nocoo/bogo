<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="bogo" />
</p>

<h1 align="center">bogo</h1>

<p align="center">Personal knowledge-base for documents, people, and workspaces.</p>

---

## Quick Start

```bash
bun install
bun run seed:local # local D1 migrations + Northwind Labs fixture
bun run dev        # UI on :7036, Worker on :37036
```

`seed:local` writes to gitignored `.wrangler/` only. See
[`docs/features/06-local-dev-seed.md`](./docs/features/06-local-dev-seed.md).

## Stack

| Layer | Tech |
|-------|------|
| UI | React + Vite + Tailwind |
| Worker | Hono on Cloudflare Workers |
| Database | Cloudflare D1 |
| Monorepo | Turborepo + bun workspaces |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all packages in dev mode |
| `bun run build` | Build UI for production |
| `bun run deploy` | Build + `wrangler deploy` — races CD; do not run from a laptop |
| `bun run typecheck` | TypeScript check all packages |
| `bun run lint` | Biome lint + format check |
| `bun run test` | Run all tests |
| `bun run seed:local` | Apply local D1 migrations + Northwind Labs fixture |

## CLI

`bogo` ships a command-line companion to the web dashboard, covering the
full `/api/*` surface. The CLI source is **generated** from the repo-root
`clip.yaml` by [clip](https://github.com/nocoo/clip) — this repo holds the
schema, the worker-side auth (`/api/auth/cli`, `api_tokens` table, the
bearer branch in `access-auth.ts`), the build pipeline in
[`packages/cli/`](./packages/cli/), and the e2e self-test, but not the CLI
source itself.

### Install from npm

```bash
bun add -g @nocoo/bogo            # or: npm install -g @nocoo/bogo
bogo --version                    # confirms the install
```

### Install from source (development)

```bash
clip generate ./clip.yaml --output ./bogo-cli
cd bogo-cli && bun install && bun link
```

### Authenticate + use

```bash
bogo login
# → browser opens, walks through CF Access, shows "Authorize bogo CLI"
# → click Authorize; credentials land in $CLIP_HOME/bogo/credentials.json (0o600)

bogo me
bogo workspaces-list
bogo persons-create <wid> --name "Alice" --managerId <root-id>
```

Running `bogo login` again automatically revokes the previous CLI token
for the same account — one active token per identity.

### Self-hosting

`@nocoo/bogo` defaults: login `https://bogo.hexly.ai/api/auth/cli`, API
`https://api.bogo.hexly.ai`. Self-host: fork, edit `clip.yaml`
(`loginUrl` + `baseUrl`), regenerate. `CLIP_BASE_URL` cannot retarget
login; tokens minted on upstream D1 will 401 on your worker.

Full operator walkthrough in
[`docs/features/03-self-hosting.md`](./docs/features/03-self-hosting.md).

Production CLI traffic uses hostname split, **not** an Access Bypass on
`Authorization`: `bogo.hexly.ai` stays Access-protected (SPA +
`/api/auth/cli`); `api.bogo.hexly.ai` has no Access application. The Worker
still authorises `Bearer bogo_*` against `api_tokens`. See
[`docs/features/02-cli.md`](./docs/features/02-cli.md) §7.

To revoke a CLI token: `UPDATE api_tokens SET revoked_at=datetime('now')
WHERE prefix='bogo_xxxxxx'`.

## Docs

设计与规范文档见 [`docs/`](./docs/README.md)：

- [`docs/architecture/`](./docs/architecture/README.md) — 实体模型、数据库、系统架构、UI 分层、测试策略
- [`docs/features/`](./docs/features/README.md) — 按功能拆分的实施规格

## License

Private.
