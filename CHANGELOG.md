# Changelog

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
