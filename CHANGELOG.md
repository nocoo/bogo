# Changelog

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
