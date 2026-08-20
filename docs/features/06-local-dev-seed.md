# 06 — Local Dev Seed (Northwind Labs)

## Objective

Give a new machine a one-command local D1 fixture so People / Documents /
Tags / table views have connected data to debug against. The database
file is never committed.

## Command

```bash
bun install
bun run seed:local
bun dev
```

`seed:local` is declared in the repo-root `package.json`. It runs
[`scripts/seed-local.ts`](../../scripts/seed-local.ts), which:

1. Applies `packages/worker/migrations/*` to **local** D1 via wrangler
2. Writes [`packages/worker/seeds/northwind-labs.sql`](../../packages/worker/seeds/northwind-labs.sql)
   into wrangler's local sqlite (`.wrangler/state/v3/d1/…`) with
   `bun:sqlite`. Workerd's D1 layer enforces FKs as triggers, so
   `wrangler d1 execute --file` cannot wipe-and-reload the tree.

`.wrangler/` is gitignored. Re-running the command deletes workspace
`Northwind Labs` (stable id `00000000-0000-4000-a000-000000000001`) and
inserts the fixture again.

The script refuses `--remote`. Do not point this SQL at production D1.

## Fixture

One workspace, ten people on one org tree, plus the related records the
UI actually reads:

```
Wei Chen (CEO)
├── Mina Park (VP Engineering)
│   ├── Theo Alvarez (Staff)
│   ├── Priya Shah (EM)
│   │   ├── Jonah Reed (SWE, New Hire)
│   │   └── Aiko Tanaka (SWE)
│   └── Sam Okonkwo (Designer) ── dotted → Lina
├── Lina Rossi (VP Product)
│   └── Harper Quinn (PM)
└── Omar Haddad (VP People)
```

| Surface | What the seed loads |
|---|---|
| Custom fields | Department, Level (shown on chart), Start Date, Location, On-call |
| Doc types | 1:1, Performance Review, Meeting Notes |
| Documents | six notes with person links + version=1 snapshots |
| Tags | person: IC / Manager / New Hire; document: Confidential / Action Needed |
| Table views | default All People + Engineering filter |

IDs are fixed UUIDs in `00000000-0000-4000-a000-*`. Edit the SQL, then
re-run `bun run seed:local`. Do not export `.wrangler/state`.

## New machine checklist

1. `bun install` (use the allowed npm mirror; see project rules)
2. `cp packages/worker/.dev.vars.example packages/worker/.dev.vars` if
   Access secrets are needed; localhost / `*.dev.hexly.ai` skip JWT
3. `bun run seed:local`
4. `bun dev` → https://bogo.dev.hexly.ai

If wrangler is already running against the same local D1, stop it before
re-seeding so the SQLite file is not locked.
