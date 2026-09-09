<p align="center">
  <img src="../logo.png" width="128" height="128" alt="Bogo logo" />
</p>

<h1 align="center">Bogo</h1>

<p align="center">A knowledge base for people, reporting relationships, documents, and revision history.</p>

<p align="center">
  <a href="https://bogo.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Bogo keeps people, reporting relationships, and related documents in the same workspace. Find someone in the org chart, read their linked 1:1 notes, meeting records, or reviews, and organize the material with people tables and tags. The web app and CLI share an API, with application data stored in Cloudflare D1.

It suits an individual or a trusted group maintaining a shared knowledge base. Authentication controls entry to the system; authenticated users can access the same workspace data. Workspaces are not isolated by account, and there are no per-member permissions.

## Features

- **People and org charts**: maintain names, titles, avatar URLs, and direct or dotted reporting relationships. Drag nodes to change a direct manager and open a person's document timeline.
- **People tables**: save column selections, sorting, filters, and a default view. Columns can use built-in person attributes or custom fields.
- **Documents and history**: edit Markdown, preview its body and YAML frontmatter, and link documents to multiple people. Saving records a title and body snapshot; adjacent revisions can be compared.
- **Classification and fields**: tag people and documents separately, define document types, and add text, number, date, select, or boolean fields to people. Selected fields can appear on org chart nodes.
- **Web and command line**: use Cloudflare Access for browser login and a [clip](https://github.com/nocoo/clip)-generated CLI for people, documents, fields, tags, and table views.

Revision snapshots contain titles and bodies; tags and person associations are not included in those snapshots.

## Usage

Open [bogo.hexly.ai](https://bogo.hexly.ai) and sign in with an account authorized through Cloudflare Access. Create or select a workspace, maintain people in People, edit records in Documents, and save people views in Table.

Install the CLI and sign in:

```bash
npm install -g @nocoo/bogo
bogo --help
bogo login
bogo me
bogo workspaces-list
```

`bogo login` opens a browser consent page and saves credentials in the CLI's local directory after approval. Signing in again revokes the previous CLI login token for that account; new tokens are long-lived by default. The server stores token digests, while the local CLI must retain usable credentials.

The npm release may lag behind the repository. Check `bogo --help` before using newer commands. To use the complete command set in the current [clip.yaml](../clip.yaml), build the CLI as described below.

Self-hosting requires separate browser login and CLI API addresses. `CLIP_BASE_URL` changes the API address only, not the login address. See the [self-hosting guide](features/03-self-hosting.md) and [CLI documentation](features/02-cli.md) for deployment, Access configuration, and token revocation.

## Development

Use Bun and Node.js 24 LTS. The repository's package manager declaration is in [package.json](../package.json); install dependencies with Bun.

```bash
git clone https://github.com/nocoo/bogo.git
cd bogo
bun install --frozen-lockfile
bun run build
bun run seed:local
bun run dev
```

Open `http://localhost:7036`. Vite forwards `/api` to the local Worker at `127.0.0.1:37036`. Local development uses the `dev@localhost` identity without a production Access login. The initial build creates the shared package and frontend assets, placing the latter in `packages/worker/static`.

`seed:local` loads the Northwind Labs fixture into this checkout's local D1 database. Running it again replaces that sample workspace and its records. Stop development processes using the same database before reloading it. See [local sample data](features/06-local-dev-seed.md).

```bash
bun run typecheck
bun run lint
bun run build
```

CLI source is generated from the schema. Set up the `clip` command using its [installation instructions](https://github.com/nocoo/clip#readme), then build:

```bash
bun run --filter @nocoo/bogo build
node packages/cli/dist/index.js --help
```

Main directories:

| Directory | Contents |
| --- | --- |
| `packages/shared` | Shared types, validation rules, and ID utilities |
| `packages/worker` | Hono API, D1 migrations, and local sample data |
| `packages/ui` | React pages, components, and viewmodels |
| `packages/cli` | CLI generation and bundling from clip.yaml |

## Tests

Install dependencies and run `bun run build` first. From the repository root:

| Layer | Command |
| --- | --- |
| Shared code, Worker, and UI unit tests | `bun run test` |
| Local Worker API integration tests | `bun turbo test:e2e --filter=@bogo/worker` |
| Chromium browser tests | `bunx playwright install chromium`, then `bun run test:e2e:pw` |
| Generated CLI login, CRUD, and revocation flow | `bun run test:cli-e2e`; requires `clip` |

API tests use local Wrangler and a separate D1 directory on port `17036`, and refuse an environment containing Cloudflare deployment credentials. Browser and CLI tests both use `27036`; run them separately and ensure that no other service owns the port. CLI tests use temporary credentials and a local consent flow.

## Stack

| Part | Technologies and role |
| --- | --- |
| Workspaces | TypeScript, Bun, Turborepo |
| API | Cloudflare Workers and Hono; Access JWT and CLI bearer authentication |
| Data | Cloudflare D1 for people, documents, revisions, fields, and views |
| Web app | React, Vite, Tailwind CSS |
| Data and navigation | React Query, React Router |
| Org chart | React Flow, Dagre |
| Document display | marked, js-yaml, @pierre/diffs |
| CLI and tests | clip code generation; Vitest, Playwright |

## Documentation

- [Documentation index](README.md)
- [Org chart and people interactions](features/04-org-tree-advanced.md)
- [People table views](features/05-people-table-views.md)
- [CLI and authentication](features/02-cli.md)
- [Self-hosting](features/03-self-hosting.md)
- [Local sample data](features/06-local-dev-seed.md)

## License

[MIT](../LICENSE). The CLI package also uses [MIT](../packages/cli/LICENSE).
