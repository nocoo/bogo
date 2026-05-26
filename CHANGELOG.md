# Changelog

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
