# CSS conventions

The frontend uses `@nocoo/basalt`. Its installed `ai/INTEGRATION.md` is the component integration reference. `packages/ui/src/index.css` contains the Tailwind imports, base resets, and the few application-specific rules for native selects, the people table, the organization chart, and rendered Markdown.

## Surfaces and colors

Use `basalt-` prefixed tokens. Do not maintain a second application palette or copy Basalt component styles into CSS classes.

| Level | Component | Purpose |
|---|---|---|
| L0 | `AppShell`, `Sidebar`, `AppHeader` | Application chrome |
| L1 | `ContentIsland` | The page content area |
| L2 | First `LayerCard` inside the island | Lists, editor panes, settings sections, chart canvas |
| L3 | Nested `LayerCard` or `LayerCard.Well` | Rows and controls within a card |

The components establish both the surface markers and the inherited control fill. A background utility alone does not establish a level. Use `bg-basalt-control` for native controls so they follow their containing surface. Do not force `bg-basalt-background` onto fields inside a card.

Use `text-basalt-muted-foreground` for supporting copy, `text-basalt-primary` for links, and `text-basalt-danger` for error text. Success text uses `text-emerald-700 dark:text-emerald-400`. Do not lower text opacity to distinguish unselected filters; use an outline or selected-state ring.

User-selected tag/type colors and deterministic avatar colors are data, so they may use inline styles. Keep the tag contrast calculation in `lib/tag-colors.ts`. Other surfaces and text use Basalt tokens.

## Controls and page layout

- Use Basalt `Button`, `Input`, `InputArea`, `Dialog`, `DropdownMenu`, `Popover`, and `Tabs`. Use `Button asChild` with React Router `Link` for navigation actions.
- Native `<select className="field-select">` retains native keyboard and mobile behavior while matching the current Basalt surface. Do not recreate `.btn-*`, `.field`, or `.panel-l*` classes.
- Start every application page with `PageHeader`, flush on the content island. Put primary page actions in `actions`, with creation last.
- Show document filters directly below the page header. Keep their labels and Clear action; avoid another title or wrapping card.
- Use `SectionRule` for separate page sections, and `LayerCard` for grouped content.
- Keep table scrolling inside its card. Document metadata and history remain available below the editor on smaller screens. Chart detail panels stack inside the viewport when they cannot sit alongside each other.
- Keep `ContentIsland` positioned (`relative`) so absolute accessibility labels scroll inside it instead of extending the document viewport.
- Keep icon actions visible on touch screens and when their row contains keyboard focus.

## Navigation

`AppHeader` renders ancestor breadcrumbs only. The current page title belongs to `PageHeader`. On narrow screens show the direct parent; every displayed ancestor has a working route.

The sidebar uses the center of its 68px rail as a fixed **34px icon axis**. The 24px logo starts at 22px; 16px navigation/search icons start at 26px. Header and navigation content keep a fixed width during the sidebar transition, so neither the logo nor the icon axis follows the animating container center. The avatar shares the same axis.

`PageBackLink` uses Basalt buttons and the same parent routes as the breadcrumbs: `/documents` or `/table`, preserving the source table view when provided.

## Theme and Markdown

Basalt's theme provider owns the theme. The entry point applies its pre-hydration classes before React renders. Controls, toasts, page surfaces, ReactFlow, and version diffs follow that theme; do not add localStorage readers or DOM mutation observers to individual components. Keep the stylesheet import order from `INTEGRATION.md`: Basalt source scan, Basalt Tailwind styles, then Tailwind.

Markdown uses the typography plugin with prose variables mapped to Basalt tokens. This keeps headings, body copy, code, tables, and links consistent in both themes without a separate inverted palette.

## Verification

Run the UI tests, UI build (including TypeScript), and repository lint. Check the sidebar throughout both width transitions, page/breadcrumb hit targets, native controls, and overflow at mobile and desktop widths in both themes. Retain semantic HTML and keyboard operation when replacing a custom widget with a library component.
