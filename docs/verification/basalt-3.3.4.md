# Basalt 3.3.4 acceptance

The UI uses exact `@nocoo/basalt@3.3.4` with a matching Bun lock resolution.

## Approved geometry

**用户批准验收标准从外层260改为外层320、内层仍260。**

This is a user-approved acceptance amendment, not a Basalt implementation fix or a passing result under the former outer-260px requirement.

`tests/sidebar.spec.ts` in `packages/ui` verifies light/dark themes and 390/700px mobile viewports against the built application:

- Outer `SidebarDrawer`: bounding width 320px, left/right padding 0.
- Inner `Sidebar`: width 260px, forced expanded, no resize handle.
- Desktop: expanded/collapsed widths 260/68px, 24px logo, default 36×36px avatar, identical expanded/collapsed avatar y, email line-height 16px.
- Expanded name and version have positive painted area inside ancestor clipping boundaries; collapsed brand copy is hidden.
- Mouse and keyboard opening, first Escape, focus return, route close, active destination and Access logout remain covered. Retries are disabled.
- Uploaded non-square profile images retain `object-fit: cover`; a failed image falls back to the existing first-letter identity. Neither Avatar nor AvatarImage has a consumer size override.

The mobile menu opener uses the public `tooltip={false}` API. A focus-opened opener tooltip must not compete with the drawer for the first Escape. The drawer close control uses `SidebarToggle mode="dismiss"`.

## Retained application behavior

| Customization                                                     | Reason                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Workspace selector                                                | Application-owned workspace switching                                           |
| Persisted desktop collapse                                        | Existing user preference, independent of the mobile drawer                      |
| Navigation groups, active-route matching and command palette      | Preserve routing and search                                                     |
| Profile photo, accessible user name and first-letter fallback     | Preserve identity using default Basalt Avatar geometry                          |
| `object-cover` on AvatarImage                                     | Preserve the former photo renderer's equal-aspect crop, not a geometry override |
| `SidebarUser.signOutHref`                                         | Cloudflare Access logout at `/cdn-cgi/access/logout`                            |
| Product logo, build-derived version, ProjectLinks and ThemeToggle | Preserve accepted branding and framework controls                               |

No local Sheet sizing/padding, brand-hiding CSS, body overflow lock, inline repair, Basalt patch or alternate package version is used.

## Local integration isolation

L2, CLI and browser suites share the fixture in `tests/helpers/test-worker.ts`. Every run creates its own HOME, Wrangler configuration, synthetic D1 binding and fresh SQLite store. It does not load the developer's Wrangler config, credentials or `.dev.vars`. A marker is created before serving, then checked before direct SQL writes and cleanup. Fixtures capture startup stdout/stderr and require HTTP 200 with `{status: "ok", component: "worker"}`. HTTP 401/503 and process failure are negative cases, not readiness. A real missing-entrypoint probe and a live-but-unhealthy Worker exercise failure diagnostics and cleanup.

CLI login/CRUD/revoke uses generated code, an isolated CLI credential directory and local synthetic identities. Browser servers are never reused; Playwright terminates them gracefully so detached Wrangler children are reaped. The default 30-second startup deadline is unchanged.

## Quality evidence

The 2026-11-14 repair adds sparse-data, invalid-reference, unexpected-storage-error, cache-eviction, pending-control, profile and keyboard regressions. All original tests and thresholds are retained. The final measured branch coverage is Worker 95.12% and UI 95.05%; all four coverage dimensions meet the repository's 95% contract. The existing configured branch floors remain 90%, a documented enforcement gap rather than a relaxed acceptance target.

A successful local suite does not establish PR CI, deployment or a real signed-in user's visual acceptance. Production avatar appearance remains **待哥登录验收**.
