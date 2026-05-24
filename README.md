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

## License

Private.
