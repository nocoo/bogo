<p align="center">
  <img src="logo.png" width="128" height="128" alt="bogo" />
</p>

<h1 align="center">bogo</h1>

<p align="center">Personal knowledge-base for documents, people, and workspaces.</p>

---

## Quick Start

```bash
bun install
bun run dev        # UI on :5173, Worker on :8787
```

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
| `bun run deploy` | Build + deploy worker |
| `bun run typecheck` | TypeScript check all packages |
| `bun run lint` | Biome lint + format check |
| `bun run test` | Run all tests |

## CLI

`bogo` ships a command-line companion to the web dashboard, covering the
full `/api/*` surface. The CLI source is **generated** from the repo-root
`clip.yaml` by [clip](https://github.com/nocoo/clip) — this repo holds the
schema, the worker-side auth (`/api/auth/cli`, `api_tokens` table, the
bearer branch in `access-auth.ts`), and the e2e self-test, but not the CLI
source itself.

```bash
# One-time setup (requires clip on PATH or sibling at ../clip):
clip generate ./clip.yaml --output ./bogo-cli
cd bogo-cli && bun install

# Authenticate against bogo (opens browser → CF Access):
bun src/index.ts login
# → credentials written to $CLIP_HOME/bogo/credentials.json (0o600)

# Hit the API:
bun src/index.ts me
bun src/index.ts workspaces-list
bun src/index.ts persons-create <wid> --name "Alice" --managerId <root-id>
```

**Production deployment requires a CF Access Bypass policy on
`Authorization starts with "Bearer bogo_"`** so bearer requests reach the
Worker; the Worker still authorises by hashing the token against
`api_tokens`. See [`docs/features/02-cli.md`](./docs/features/02-cli.md) §7
for the policy table, and `docs/architecture/03-system-architecture.md` for
the auth flow diagram.

To revoke a CLI token: `UPDATE api_tokens SET revoked_at=datetime('now')
WHERE prefix='bogo_xxxxxx'`.

## Docs

设计与规范文档见 [`docs/`](./docs/README.md)：

- [`docs/architecture/`](./docs/architecture/README.md) — 实体模型、数据库、系统架构、UI 分层、测试策略
- [`docs/features/`](./docs/features/README.md) — 按功能拆分的实施规格

## License

Private.
