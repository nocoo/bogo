# Retrospective

Accident narratives for this repo.

## 2026-11-14: Test fixture lifecycle and profile crop regressions

- **What:** The first isolated browser fixture detached Wrangler without configuring Playwright's graceful shutdown. Playwright's default SIGKILL bypassed cleanup and left this task's Worker on port 27036. Review also caught missing cleanup after a live-but-unhealthy startup and lost `object-cover` behavior when replacing the sidebar avatar.
- **Why:** Startup success alone did not exercise the fixture owner's failure/termination paths; testing only square or absent photos missed image distortion.
- **Prevention:** Cleanup belongs inside fixture startup failure handling. Playwright sends SIGTERM, and full-suite/repeated-Escape runs must leave no listener. A real 503 Worker tests termination and marker-checked store cleanup. A 96×48 profile fixture asserts equal-aspect crop and default 36px geometry; failed images assert the existing identity fallback.

## 2026-11-14: Repair validation setup mistakes

- **What:** The first diagnostic looked for Wrangler in root node_modules rather than the worker workspace. A new fixture commit was rejected because registry environment variables were not declared for Turbo, and a real startup-failure regression initially hit Bun's default five-second unit deadline during fixture setup/cleanup.
- **Why:** Workspace executable ownership, lint's environment contract and integration fixture cost were not checked together before the first attempts.
- **Prevention:** Resolve the installed workspace executable explicitly; declare subprocess registry passthrough without inheriting credentials. Give the new real-process regression an explicit integration-test budget while retaining the original 30-second readiness deadline. Rejected attempts were corrected without bypassing hooks or changing coverage thresholds.

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
