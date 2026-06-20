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

## Docs

设计与规范文档见 [`docs/`](./docs/README.md)：

- [`docs/architecture/`](./docs/architecture/README.md) — 实体模型、数据库、系统架构、UI 分层、测试策略
- [`docs/features/`](./docs/features/README.md) — 按功能拆分的实施规格

## License

Private.
