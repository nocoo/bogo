# Retrospective

Accident narratives for this repo.

Routing: narrative stays here. A project-specific rule that will recur may become one line in `AGENTS.md`. Cross-project lessons go to nmem or a global rule. If it can be checked by a machine, add a hook or test instead of prose.

## CLI Access header Bypass is gone

- **What:** Spec said CF Access Bypass on `Authorization starts with "Bearer bogo_"`. That selector was removed; CLI calls never reached the Worker.
- **Why:** Cloudflare dropped Request Header Bypass. Same pattern as GitHub/Linear/Vercel: split hostnames.
- **Follow-up:** `bogo.hexly.ai` stays Access-protected (SPA + `/api/auth/cli`). `api.bogo.hexly.ai` has no Access app; `access-auth.ts` still requires `Bearer bogo_*` + `sha256` lookup in `api_tokens`. Do not restore a Bypass policy.
