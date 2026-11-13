# Retrospective

Accident narratives for this repo.

## 2026-11-14: Sidebar regression test formatting rejected

- **What:** The first sidebar E2E test commit was rejected by the normal pre-commit hook because two new statements did not match Biome formatting.
- **Why:** A preceding check-only formatter reported the differences, but the shell command continued to attempt the commit.
- **Prevention:** Chain the targeted check and commit with `&&`; apply the reported formatting before staging. The hook was not bypassed, and the corrected test commit passed.

## 2026-11-14: Modal opener locator blocked geometry assertions

- **What:** Four new mobile geometry tests failed before measuring width because their role locator no longer found the menu button after the modal opened.
- **Why:** Radix correctly hides the background from the accessibility tree; Playwright role locators exclude that hidden opener by default.
- **Prevention:** Include the hidden opener when inspecting its ARIA attributes while a modal is open, retain all geometry assertions, and attach rendered measurements before assertions. Do not label a locator failure as a library geometry defect.

Routing: narrative stays here. A project-specific rule that will recur may become one line in `AGENTS.md`. Cross-project lessons go to nmem or a global rule. If it can be checked by a machine, add a hook or test instead of prose.

## CLI Access header Bypass is gone

- **What:** Spec said CF Access Bypass on `Authorization starts with "Bearer bogo_"`. That selector was removed; CLI calls never reached the Worker.
- **Why:** Cloudflare dropped Request Header Bypass. Same pattern as GitHub/Linear/Vercel: split hostnames.
- **Follow-up:** `bogo.hexly.ai` stays Access-protected (SPA + `/api/auth/cli`). `api.bogo.hexly.ai` has no Access app; `access-auth.ts` still requires `Bearer bogo_*` + `sha256` lookup in `api_tokens`. Do not restore a Bypass policy.
