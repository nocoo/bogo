# Changelog

## [0.6.0] - 2026-07-17

### Added
- **People Table** — full page for browsing people as a configurable grid
  (views, columns, sort, filters). Spec: `docs/features/05-people-table-views.md`.
- **Table Views API** — CRUD for workspace-scoped named views on
  `person_table_views` (columns layout, sort, filters, default flag).
- **Shared table-view schemas** — wire types and validation in `@bogo/shared`
  for worker + UI.
- **Full-page person editor** — open a person from the table name link
  (replaces table-only Open); breadcrumbs + PageBack navigation.
- **Dual-list Columns picker** — drag between available / visible columns
  with cancel restore.
- **Date cell distance** — table date columns show calendar distance
  (e.g. `1y 2m 25d`) alongside the date.
- **Avatars** in Name and Manager table columns.

### Changed
- Default view label **Default → All People** (UI + seed + migration rename).
- Table surface polish (L0–L3 control system); default view no longer
  uses a star affordance — view tabs + badge instead.
- Manager filter matches by **person name** (not only id).
- CLI base package: `@nocoo/cli-base` → `@nocoo/base-cli` `^0.3.0`.

### Fixed
- Filter/sort edge cases from review: trim on text/select/boolean/sort
  compare; default Name ASC (`sort: null`) reuses `compareRaw` trim;
  skip illegal filter values; skip `is_empty`/`is_not_empty` when a value
  is present; toast on view mutations; column drag order off-by-one;
  filter ops restricted by column kind.

### Migrations
- `0008_person_table_views.sql` — create `person_table_views`, unique
  default per workspace, backfill **All People** for existing workspaces.
- `0009_rename_default_view.sql` — rename workspace default view named
  `Default` → `All People` when no name conflict.

## [0.5.3] - 2026-07-15

### Changed
- **TypeScript upgraded to `^7.0.2`** across all workspaces (root + shared + ui + worker).
- **Biome upgraded to `^2.5.3`** with `linter.rules.preset: "recommended"` enabled,
  matching the sibling `bat` project's baseline. Also enables
  `css.parser.tailwindDirectives` for the Tailwind CSS files.
- **`turbo.json` declares `globalPassThroughEnv`** for `BOGO_E2E_BASE`,
  `BOGO_REQUIRE_CLI_E2E`, `BOGO_SKIP_CLI_E2E` — previously Biome's
  `noUndeclaredEnvVars` warned on every env var read in the CLI E2E
  scripts.

### Chore / gates
- **`.husky/pre-commit`** now includes a `biome_full` stage that runs
  `bun run lint` across the whole repo (not just staged files), so
  unstaged bit-rot in the tree can no longer slip past a commit that
  only touched a subset.
- **`.husky/pre-push`** now includes a `clip_yaml` stage that runs
  `gate:clip-yaml`, verifying the repo-root `clip.yaml` still produces a
  working CLI via `clip generate`. Same soft-skip semantics as the
  existing CLI E2E stage — local dev without `clip` installed keeps the
  escape hatch; CI hard-fails when `BOGO_REQUIRE_CLI_E2E=1`.
- **Removed `lint-staged`** dev dep and pre-commit stage — it duplicated
  the coverage of the new `biome_full` stage above.

### Fixes (surfaced by Biome 2.5.3 recommended)
- Two `useExhaustiveDependencies` sites now carry `biome-ignore`
  comments explaining the intent: `DashboardLayout.tsx` (pathname is a
  change-trigger for closing the mobile drawer) and `DocTypeManager.tsx`
  (`docType.color` change resets the inline color-editor UI). Both
  don't reference the dep in the effect body, so a "correct" dep list
  would break the trigger semantics.

## [0.5.2] - 2026-07-14

### Added
- **Custom field values can now surface directly on the org chart.** Each
  custom field definition gains a new `showOnChart` flag (default off).
  When enabled, the field's value appears under every person's node in
  the People page, ordered by the definition's `sortOrder`. Missing
  values render as an em-dash placeholder so the tree height stays
  stable as values start landing.
- **New bulk endpoint `GET /api/w/:wid/fields/values`** — returns every
  custom field value across the workspace in a single request. Powers
  the org-chart renderer without fanning out one GET per person.

### Changed
- **Documents list now sorts by `updated_at DESC` with a stable
  `id DESC` tie-break.** The just-created / just-edited doc lands at
  the top instead of buried by `event_date` order. Applies to both the
  plain list and the tag-filtered list.
- **Optimistic create for documents prepends** rather than appends, so
  a newly created doc renders at the top immediately, aligned with the
  server ordering above.

### Fixed
- Concurrent field-value writes now invalidate the workspace-wide bulk
  cache alongside the single-person cache, so chart labels reflect
  edits from any surface (edit panel, CLI, other tab).
- Chart field defs are now sorted explicitly by `sortOrder` in the UI —
  optimistic post-create cache mutations could otherwise prepend a
  fresh def and break the row order.

### Migrations
- `0005_documents_updated_at_index.sql` — covering index
  `(workspace_id, updated_at DESC, id DESC)` for the list query.
- `0006_custom_field_show_on_chart.sql` — adds the `show_on_chart`
  column to `custom_field_definitions` (default 0).
- `0007_custom_field_values_workspace_index.sql` — covering index
  `(workspace_id, person_id)` for the bulk values read; prior queries
  fell back to a full-table SCAN.

### Docs / chore
- `biome.json` now excludes the entire `.claude/` directory (the local
  `settings.local.json` is machine-managed and doesn't need lint).

## [0.5.1] - 2026-07-09

### Added
- **Save-feedback toasts across every write mutation.** Editing a
  person, tag, doc-type, custom field definition, custom field value,
  or document now surfaces a "…saved" toast on success in addition to
  the pre-existing error toast. Nine viewmodels audited; success
  feedback added to every `update` / `move` / `setValue` path that
  was previously silent on the happy path.
- Success labels are user-facing verbs ("Person saved", "Person moved",
  "Tag saved", "Document type saved", "Field saved", "Document saved"),
  not the underlying mutation name.

### Design decisions
- **Reorder swaps stay silent.** DocType and FieldDef reorder issues
  two `update` calls to swap `sortOrder`; the shared `updateMutation`
  now attaches the toast via a per-call `mutate(vars, { onSuccess })`
  callback rather than the mutation config, so `reorder` reuses the
  same mutation without toasting twice.
- **Tag assignment stays silent.** Toggling a tag on a person or
  document is a high-frequency action; a toast per click would be
  noise. `use-tag-assignment` remains success-silent by design.

### Docs
- New spec `docs/features/04-org-tree-advanced.md` — advanced
  interactions for the People org tree (collapse/expand, drag via
  ReactFlow handle-connect, minimap + canvas shortcuts). Design only;
  no code shipped in this release.

## [0.5.0] - 2026-06-23

### Changed (breaking on responses)
- **List endpoints no longer return `content`.** Three endpoints
  previously inlined the full Markdown body of every document
  they listed, defeating the point of a list view; payloads got
  unbounded as documents grew. Affected:
  - `GET /api/w/:wid/documents`
  - `GET /api/w/:wid/persons/:id/documents`
  - `GET /api/w/:wid/documents/:id/versions`
  Fetch the body via the single-resource endpoints instead
  (`GET /:id` for a document, see next bullet for versions).
- New type `DocumentSummary` / `DocumentVersionSummary` published
  from `@bogo/shared` so clients can type-check the shrunk shape.

### Added
- **`GET /api/w/:wid/documents/:id/versions/:version`** — fetch a
  single version with full content. The UI's VersionDiff component
  now uses this on demand instead of receiving every body up front;
  CLI users can call `bogo documents-version <wid> <id> <version>`.

### Internal
- Worker: split `mapDocRow` / `mapDocSummaryRow` so "list omits
  content" is enforced by types, not convention. Added/updated
  worker unit cases pinning `not.toHaveProperty("content")` on
  the three list endpoints + four cases for the new single-version
  GET.
- UI: `documentApi.list` / `listVersions` typed as `DocumentSummary[]`
  / `DocumentVersionSummary[]`; `VersionDiff` rewritten to fetch
  two version bodies on demand via a new `documentApi.getVersion`.

## [0.4.3] - 2026-06-23

### Changed (production wiring)
- **Split-hostname production deployment.** Cloudflare removed
  Request Header selectors from Zero Trust Access policies in 2026,
  so the previous CLI bearer Bypass policy is no longer available.
  Worker now serves both `bogo.hexly.ai` (CF Access — browser SPA +
  `/api/auth/cli` consent) and `api.bogo.hexly.ai` (no CF Access —
  CLI business calls, worker's bearer middleware as trust boundary).
- `clip.yaml` splits accordingly:
  `baseUrl: https://api.bogo.hexly.ai` for business calls,
  `auth.loginUrl: https://bogo.hexly.ai/api/auth/cli` for consent.
- `@nocoo/bogo@0.4.3` republished off the new yaml so the default
  install hits both hosts correctly.

### Docs
- `docs/features/02-cli.md` §7 rewritten around split-hostname; CF
  Access Bypass section deleted with a historical note.
- `docs/features/03-self-hosting.md` updated: §3 walks the operator
  through configuring the two hostnames + one Access app; §4 / §5
  note that `loginUrl` is what lets path B redirect the consent
  flow.
- `docs/architecture/03-system-architecture.md` Authentication Flow
  notes match the new wiring.
- `CLAUDE.md` CF Access section replaced.

## [0.4.2] - 2026-06-23

### Fixed
- Consent page CSP `form-action 'self'` blocked the legitimate
  Authorize submit on production. The CF Access 302 chain trips
  strict form-action validation in some browsers, so the
  directive is dropped. Anti-clickjacking still rests on
  `frame-ancestors 'none'` + `X-Frame-Options: DENY`; CSRF still
  rests on the HttpOnly + SameSite=Strict cookie. No change to
  the threat model.

## [0.4.1] - 2026-06-23

### Fixed
- `@nocoo/bogo` published with a missing `bin` entry — npm silently
  rejected `"./dist/index.js"` (the leading `./` is invalid) so 0.4.0
  installs cleanly but exposes no `bogo` command. Drop the `./`
  prefix and normalise the repository URL to `git+https://…` to
  silence the related publish warning.

### Added
- `CLIP_BASE_URL` now overrides `bogo login` too (clip v1.1.0
  upstream). Self-hosted deployments can redirect every CLI call —
  login included — with one env var. Docs: `docs/features/03-self-hosting.md`.

## [0.4.0] - 2026-06-22

### Added
- **`bogo` CLI** — generated from the repo-root `clip.yaml` by
  [clip](https://github.com/nocoo/clip), covering the full `/api/*` surface
  (workspaces / persons / fields / doc-types / documents / tags / me).
  Source code is **not** vendored here; this repo carries the schema and
  the worker-side auth surface required to make the generated CLI work.
- **`/api/auth/cli` browser-login endpoint** (`packages/worker/src/routes/auth.ts`)
  — handles the loopback callback for clip's `browser-login` auth type,
  mints a `bogo_<base64url(32)>` bearer token, persists only
  `sha256(plain).hex` plus a 12-char display prefix to D1, and 302s back
  with `api_key`/`state`/`email`. Refuses requests whose `authMethod ===
  "bearer"` (403) so a leaked CLI token cannot self-mint another.
- **`api_tokens` D1 table** (`migrations/0004_api_tokens.sql`) — hash-only
  token store with `revoked_at` / `expires_at` columns and indexes on
  `owner_email` and `token_hash`.
- **Bearer branch in `access-auth.ts` middleware** — runs BEFORE the
  localhost shortcut so a revoked CLI token on wrangler dev still 401s
  instead of falling through to `dev@localhost`. Variables now carry an
  `authMethod` discriminator (`"bearer" | "cf-access-jwt" | "localhost"`).
  Non-`bogo_` Bearer values fall through to the CF Access JWT path
  unchanged.
- **`sha256Hex` utility** (`packages/worker/src/utils/hash.ts`) — Web
  Crypto–based SHA-256 hex digest used by the bearer branch and
  `/api/auth/cli`.
- **Query → body CSV bridge** in `documents.ts` (POST `/`) and `fields.ts`
  (POST `/`, PUT `/:id`) for `personIds` / `options`. clip codegen
  cannot send arrays in body, so the CLI sends them as comma-separated
  query strings; the route splits the CSV into the body field before zod
  validation. Body always wins over query for non-CLI callers.
- **CLI bearer auth lifecycle E2E** (`packages/worker/test/e2e/auth.test.ts`):
  login via `/api/auth/cli`, present bearer to `/api/me`, revoke via D1
  `UPDATE`, assert same bearer now 401s. Plus the localhost fallback
  baseline and the bearer-self-mint refusal case.
- **Generated CLI smoke E2E** (`tests/cli-e2e/smoke.test.ts`) — drives an
  end-to-end run against a real wrangler dev with a clip-generated CLI:
  fake `open`/`xdg-open` so cli-base's openBrowser fails and emits the
  login URL; loopback fetch completes the callback; CRUD chain over
  generated commands; same `--persist-to` for the revoke UPDATE so the
  401 assertion is real.
- **clip.yaml validator gate** (`scripts/check-clip-yaml.ts` + new CI step
  in `coverage-gates`) — round-trips the repo-root `clip.yaml` through
  `clip generate` so a future yaml edit that breaks codegen fails the
  gate. CI checks out `nocoo/clip` as a sibling for the runner fallback;
  `BOGO_REQUIRE_CLI_E2E=1` makes a missing clip a hard CI failure.
- **Pre-push CLI E2E stage** — `bun run test:cli-e2e` runs alongside the
  existing L2 + G2 stages. Locally bypassable via `BOGO_SKIP_CLI_E2E=1`;
  CI exports `BOGO_REQUIRE_CLI_E2E=1` so the skip toggle is a no-op there.
- **New `cli-e2e` CI job** that checks out bogo + `nocoo/clip` siblings,
  builds the static UI, and runs the smoke E2E under
  `BOGO_REQUIRE_CLI_E2E=1`.

### Changed
- **Worker access-auth middleware** now resolves identity through three
  ordered branches (bearer → localhost → CF Access JWT). Order is
  load-bearing: any other order lets revoked CLI tokens fall through to a
  shortcut. The localhost dev shortcut and the CF Access JWT path retain
  their existing behaviour and `userEmail` semantics; the only addition
  is the `c.set("authMethod", …)` calls so `/api/auth/cli` can refuse
  bearer-driven self-minting.
- **Endpoints documentation** (`docs/architecture/03-system-architecture.md`)
  now records the dual identity model, the loopback callback flow, the
  bearer self-mint refusal, and the production CF Access Bypass policy
  requirement (`Authorization starts with "Bearer bogo_"`).
- **Documents POST and Fields POST/PUT route signatures** keep the same
  zod schemas; the new CSV query → body bridging happens before zod
  validation and is transparent to existing callers.
- **README** gains a top-level CLI section pointing at `clip.yaml`, the
  minimum workflow, the production CF Access requirement, and the
  manual v1 revoke flow.
- **CLAUDE.md**: architecture diagram updated to show `/api/auth/cli` and
  the dual-identity `/api/*`; new "CLI bearer bypass policy" subsection
  under Cloudflare Access 配置; Testing table adds L4 CLI E2E; pre-push
  description updated.

### Security
- CLI plaintext tokens cross the wire exactly once (in the `api_key`
  query parameter on the loopback redirect) and are never persisted in
  D1. The `prefix` column stores the first 12 chars for display in logs
  / `auth show`; full reverse lookup is not possible from D1 alone.
- `credentials.json` written by the generated CLI is `chmod 0600`.
- The route-coverage gate regex (`scripts/check-route-coverage.ts`) was
  tightened so `c.get("authMethod")` / `c.set("userEmail")` Hono
  Variables accessors are no longer mis-parsed as `GET /api/...` routes.

### Notes
- v1 revocation is **manual** — `UPDATE api_tokens SET revoked_at=…`
  against the live D1. The token-management UI and `/api/auth/tokens*`
  endpoints (list / create / DELETE) are Phase 2 scope and explicitly
  not in this release.
- The CLI source itself is generated; nothing in this repo runs
  `bun link` of the generated CLI into the developer environment to keep
  dev envs clean.

## [0.3.0] - 2026-06-08

### Added
- **Person avatars as first-class data**
  - `persons.avatar_url` column (migration `0003_persons_avatar.sql`)
  - `PersonAvatar`: deterministic letter avatar with stable djb2 name → 8-color palette mapping; uploaded URL takes precedence and falls back on load failure
  - `PersonChip` (left avatar + name + optional subtitle/× button) and `PersonAvatarCluster` (overlapping avatars + "+N" overflow) — the only sanctioned person-rendering surfaces
  - `EditPersonPanel` gains an Avatar URL field with live preview
- **YAML frontmatter rendering**
  - Markdown preview auto-detects a leading `--- ... ---` block and renders it as a compact property table; arrays render as chips, nested objects collapse to inline JSON
  - Malformed YAML and mid-document fences silently strip / fall through to normal markdown
  - `js-yaml` `JSON_SCHEMA` keeps scalars verbatim — date-shaped strings like `2026-05-30` are preserved instead of being coerced into Date ISO strings
- **DocType picker on the document editor** — colored pill in the right inspector, full set/unset menu via new `DocTypePicker` component
- **Document list shows associated people** — overlapping avatar cluster on each row (later removed per spec; see Changed)
- **Frontmatter-style YAML examples and component classes** documented in `docs/architecture/09-css-conventions.md`

### Changed
- **Document editor — full GitHub-style redesign**
  - Two-column layout: editor + preview in main, fixed inspector on the right with grouped Type / Tags / People / Event date / History
  - Inline-editable title (24px, hover shows pencil), back link on its own row, save chip with dirty/all-saved status indicator
  - Viewport-locked height chain in `DashboardLayout`: long content scrolls inside the editor and preview panes instead of pushing the whole page
  - Padding tightened so the editor inherits the layout card's `p-5` instead of double-padding
  - Header strip aligns to column 0; control heights unified at `h-8`
- **Markdown rendering rewrite**
  - Replaced the 50-line regex stub with a proper `marked` v17 renderer mirroring firefly's architecture: HTML escaped, URLs sanitised, heading anchor ids, external links open in new tab
  - `prose-invert` now scoped to `dark:`, fixing the white-bold-on-white-bg bug in light mode
  - `.markdown-surface` extracted as a `@layer components` semantic class; `<select>` chrome moved from `@layer base` to `@layer components`
- **CSS structure cleanup**
  - `index.css` reorganised into 6 numbered sections (imports / variants / theme tokens / design tokens / base / components)
  - Document list rows aligned to `EditPersonPanel` panel vocabulary (`bg-secondary` + `rounded-xl` + `shadow-sm`); titles wrap to two lines
  - Person nodes keep an opaque `bg-secondary` background when selected (no more dotted-canvas bleed-through)
- **PersonDocTimeline → Documents panel** — same panel vocabulary as `EditPersonPanel`, doc cards show title (2-line) + type chip + version + tag badges
- **Worker `GET /persons/:id/documents`** — joins `tag_documents` so each doc carries its tag list
- **Worker `GET /documents`** — embeds `personIds[]` per document; nested `if (tagIds && ids.length > 0)` collapsed to a single check
- **Person `update` API surfaces** — `PersonListVM.update` / `EditPersonPanel.onUpdate` widened to `UpdatePersonInput` so the shared schema is the single source of truth

### Fixed
- White bold-text-on-white-background in markdown preview (light mode)
- Editor + preview being pushed past the viewport when content was long
- Frontmatter `2026-05-30` no longer rendered as `2026-05-30T00:00:00.000Z`

## [0.2.2] - 2026-06-08

### Changed
- Dependency upgrades — close out outdated batch (#5)
  - `@bogo/ui` minor: `@pierre/diffs` 1.2.3 → 1.2.7, `@tanstack/react-query` 5.100.14 → 5.101.0, `@xyflow/react` 12.10.2 → 12.11.0, `react` / `react-dom` 19.2.6 → 19.2.7, `react-router` 7.15.1 → 7.17.0, `@types/react` 19.2.15 → 19.2.17, `happy-dom` 20.9.0 → 20.10.2
  - `@bogo/worker` minor: `hono` 4.12.22 → 4.12.23, `@cloudflare/workers-types` 4.20260523.1 → 4.20260607.1, `wrangler` 4.94.0 → 4.98.0
  - `typescript` 5.8 → 6.0.3 in all workspaces (root was already 6.0.3)
  - Major: `lucide-react` 0.511.0 → 1.17.0 (brand icons removed in v1; `Github` reintroduced as local `createLucideIcon` component)
- `vite` / `@vitejs/plugin-react` deferred — major upgrade requires separate evaluation

### Fixed
- `PersonTree.onNodeDragStop` signature adjusted for `@xyflow/react` 12.11's narrower event type
- Removed deprecated `baseUrl` from `packages/ui/tsconfig.json` (TS 6.0 warning; `paths` entries already use relative `./` prefixes)

## [0.2.1] - 2026-06-07

### Changed
- Dependency upgrades — refresh toolchain to latest
  - Minor: `vitest` 4.1.5 → 4.1.8, `@vitest/coverage-v8` 4.1.5 → 4.1.8, `turbo` 2.5.0 → 2.9.16
  - `packageManager`: `bun` 1.3.11 → 1.3.14
  - Major: `lint-staged` 16.4.0 → 17.0.7
  - Major: `@biomejs/biome` 1.9.4 → 2.4.16 (config migrated to v2 schema)
  - Major: `typescript` 5.8.2 → 6.0.3
- A11y improvements driven by Biome v2 rules
  - Loading wrappers now expose `role="status"` for screen readers
  - `MarkdownPreview` promoted from `<div role="article">` to `<article>`
  - Dropped redundant `aria-label` from static `<span>` tab labels
- CLI: add `clip.yaml` for cf-access-protected API consumption

### Fixed
- Tag E2E PUT response shape mismatch in regression test

## [0.2.0] - 2026-05-29

### Added
- Tag system: end-to-end tags for documents and persons
  - DB migration with junction tables and composite UNIQUE constraints
  - Shared Zod schemas (`tagSchema`, `tagWithCountSchema`, `tagStatsSchema`)
  - Worker routes: tag CRUD, assignment, stats
  - List endpoints (`/documents`, `/persons`) accept `tagIds` + `tagMode=any` for server-side filtering
  - Detail endpoints (`/documents/:id`, `/persons/:id`) embed assigned tags
- TagsSettingsPage with scope tabs (Document/Person) and full CRUD
- TagPicker integrated on document and person detail pages
- TagFilter on Documents list page and PeoplePage (flat list view when active)
- TagBadge component and tag color tokens
- ColorPicker now supports custom hex input (validated)
- `/api/me` endpoint and user email displayed in sidebar
- DocumentEditor side-by-side edit/preview layout
- Event date input on DocumentEditor (already in 0.1.2, polished here)

### Changed
- DocumentPersons rendered as consistent tag-style chips
- All select dropdowns now use a custom chevron icon
- PUT `/tags/:id` returns the full updated tag object instead of `{ updated: true }`

### Fixed
- PUT `/tags/:id` handles UNIQUE constraint violations → 409 DUPLICATE
- PersonNode renders embedded tags as badges below name/title
- Responsive version history layout for screens < xl
- Select element padding to prevent chevron overlap with text
- Tailwind typography plugin loaded via `@plugin` directive
- Input heights and color hierarchy
- Removed obsolete template gallery button

## [0.1.2] - 2026-05-26

### Added
- Person document timeline component on People page
- GET /persons/:id/documents API endpoint
- Event date input on DocumentEditor

### Fixed
- Version History now shows human-readable relative time instead of raw ISO timestamps
- Document event date defaults to today when unset
- Timeline vertical axis now passes through center of circles
- Tab jitter in DocumentEditor

## [0.1.1] - 2026-05-25

### Added
- Toast notification system using sonner with theme-aware styling
- Pencil edit affordance (hover-revealed) on DocType and FieldDef rows
- Required toggle and type select dropdown on FieldDef rows
- `fieldType` field to the update field definition API schema and route

### Changed
- Migrated all mutation feedback from inline error banners to toast notifications
