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

`@nocoo/bogo` defaults to `https://bogo.hexly.ai` (the maintainer's
deployment, gated by their CF Access policy). If you want to run your
own bogo:

- **Quick path** — `CLIP_BASE_URL=https://your-bogo.example.com bogo login`
  redirects login and all API calls to your worker.
- **Branded path** — fork the repo, edit `clip.yaml` (alias / baseUrl),
  regenerate, publish under your own scope.

Full operator walkthrough in
[`docs/features/03-self-hosting.md`](./docs/features/03-self-hosting.md).

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
