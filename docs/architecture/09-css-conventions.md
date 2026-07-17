# 10. CSS Conventions

Single source of truth for styling decisions in `packages/ui`. Tailwind v4 + `@tailwindcss/typography` + Basalt design tokens.

## TL;DR

- **Use Tailwind utilities by default.** Reach for a custom class only when a pattern is reused or a className exceeds ~6–8 visual concerns.
- **Never use color hex/oklch in component code.** Use theme tokens (`bg-card`, `text-foreground`, etc.).
- **`prose-invert` is always `dark:prose-invert`.** Unscoped `prose-invert` makes light-mode text near-white on near-white background.
- **All custom rules go in `src/index.css`.** No CSS modules, no inline `<style>`, no per-component `.css` files.

## File structure (`src/index.css`)

Six sections, in this order — see the file's own banner comments:

| § | Section | What lives here |
|---|---|---|
| 1 | Imports + plugins | `@import "tailwindcss"`, `@plugin "@tailwindcss/typography"` |
| 2 | Variants | `@custom-variant dark` |
| 3 | `@theme inline` | Maps semantic vars → Tailwind utility names |
| 4 | `:root` / `.dark` | Raw oklch design tokens |
| 5 | `@layer base` | Element-level resets + body typography only |
| 6 | `@layer components` | Reusable component classes + themed element chrome |

Do **not** create additional `.css` files. The file is small (<200 lines today) and easier to reason about as one ordered document.

## Color tokens — when to use which

Four luminance layers (aligned with pew Basalt tiers). Prefer the semantic
component classes in `index.css` (`.panel-l2`, `.btn-*`, `.field`, `.data-table-*`)
over ad-hoc utility soup.

| Token / class | Luminance tier | Use for |
|---|---|---|
| `bg-background` | **L0** | App shell, sidebar, root canvas |
| `bg-card` (+ DashboardLayout island) | **L1** | Page content island lifted off L0 |
| `bg-secondary` / `.panel-l2` | **L2** | Section panels nested in L1 (filters, config, table shell) |
| `bg-muted` / `.panel-l3` | **L3** | Deepest nests (sticky table header, checklist rows inside L2) |
| `bg-popover` | L1 elevated | Popovers, dropdowns, modals |
| `bg-accent` | — | Hovered/selected list items |
| `bg-primary` / `.btn-primary` | — | Call-to-action buttons, active state |
| `bg-destructive` / `.btn-destructive` | — | Delete/danger buttons, error toasts |
| `border-border` | — | Default borders (already applied to `*` in base) |
| `border-input` / `.field` | — | Form field borders |
| `ring-ring` | — | Focus rings |

**Controls**: use `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-destructive`
(+ optional `.btn-sm`) and `.field` / `.field-select` so height (`h-8`), radius, and
focus rings stay consistent. Do not invent one-off `px-2 py-1 text-xs` buttons.

**View switcher**: multi-named configs (e.g. Table views) use `.view-switcher` +
`.view-tab` / `.view-tab-active`. Mark the workspace default with `.badge-soft`
(active) / `.badge-soft-muted` (inactive) — never a star glyph or icon-only “Default” button.

**Never** put raw `oklch(...)`, `#...`, `rgb(...)` in `.tsx` files. If you find yourself wanting one, the token is missing — add it to `:root` + `.dark` + `@theme inline`, then use it.

## When to abstract into a component class

Keep className inline **unless any of these are true**:

1. **The same long combination appears in ≥2 places.** Extract.
2. **A single className exceeds ~200 characters / ~12 utility tokens.** Extract.
3. **The styling encodes a domain concept** (e.g., "this is the markdown surface", "this is a kbd hint"). Extract under a semantic name.

When extracting:

- Put it in `@layer components` (utilities can still override at call sites).
- Use a semantic, BEM-like name: `.markdown-surface`, `.kbd-hint`, `.field-row` — not `.flex-blue-thing`.
- Apply theme tokens via `@apply`, not raw values.
- Pair `.dark` variants right after the base rule.

Example:

```css
@layer components {
  .markdown-surface {
    @apply prose prose-sm max-w-none rounded-lg border border-border bg-secondary p-6 text-foreground;
  }
  .dark .markdown-surface {
    @apply prose-invert;
  }
}
```

Then in `.tsx`:

```tsx
<article className="markdown-surface flex-1 w-full" />
```

## Typography (prose)

We use `@tailwindcss/typography` for rendered markdown.

- **Always** wrap `prose-invert` in `dark:` (or `.dark .your-class`). Unconditional `prose-invert` forces near-white text on light backgrounds → invisible bold text bug we fixed in `1984521`.
- Tune `prose-h*`, `prose-p`, `prose-a` modifiers at the call site rather than overriding global prose vars.

## Element chrome

A bare HTML element that needs themed defaults (e.g., `<select>` arrow) goes in `@layer components`, **not** `@layer base`:

- `@layer base` is for resets and global typography.
- `@layer components` lets utilities override it, and signals "this is a component default, not a reset."

## Avoid

- ❌ `style={{ ... }}` for layout/color. Allowed only for genuinely dynamic values (e.g., a chart bar width tied to data).
- ❌ `className={cn("a", "b", isFoo && "c")}` for conditional **classNames** — fine. But avoid `cn` to glue together what should be one semantic class.
- ❌ `!important` overrides. If you need it, you're fighting a misplaced rule — fix the source.
- ❌ Raw colors anywhere in `.tsx`.
- ❌ Adding `.css` files outside `src/index.css`.
