# SPEC: Self-Hosting bogo

## 1. Objective

bogo is open-source. By default `@nocoo/bogo` (the published CLI) targets
the upstream `https://bogo.hexly.ai` worker, which is gated by the
maintainer's Cloudflare Access policy — so a fresh `npm i -g @nocoo/bogo`
**will not** let an external user log in without help.

This document is the operator's guide for someone who wants to run their
own bogo: stand up a worker, configure auth, point the CLI at it.

**Supported CLI path:** fork, edit `clip.yaml` (`loginUrl` + `baseUrl`),
`clip generate`, publish under your own scope.

Do **not** treat `CLIP_BASE_URL` + published `@nocoo/bogo` as self-hosting.
`loginUrl` is baked at generate time; `bogo login` still mints a token in
upstream D1, then API calls to your worker 401.

## 2. Worker deployment

Same shape as the upstream worker (single Cloudflare Worker + D1 + CF
Access). Roughly:

```bash
git clone https://github.com/nocoo/bogo your-bogo
cd your-bogo
bun install

# Create your own D1
cd packages/worker
bunx wrangler d1 create your-bogo
# Copy the database_id wrangler prints into packages/worker/wrangler.toml

# Apply migrations
bunx wrangler d1 migrations apply your-bogo --remote

# BEFORE deploy: edit [env.production] routes to YOUR two hostnames
# (SPA + api.*) — cloned wrangler.toml still points at bogo.hexly.ai.
# Not a single *.workers.dev host.

bunx wrangler deploy --env production
```

`wrangler.toml` must list the same D1 binding name (`DB`) the worker code
expects.

## 3. Cloudflare Access setup (split-hostname model)

Cloudflare moved off Header-based Bypass in 2026 — the only viable
production wiring is **two hostnames, one worker**:

| Hostname                  | CF Access | Purpose                                   |
|---------------------------|-----------|-------------------------------------------|
| `your-bogo.example.com`   | ✅ Allow on email allowlist | Browser SPA + `/api/auth/cli` consent page |
| `api.your-bogo.example.com` | ❌ Not covered by any Access app | All other CLI requests; bearer auth in worker |

Two `wrangler.toml` routes:

```toml
[[env.production.routes]]
pattern = "your-bogo.example.com"
custom_domain = true

[[env.production.routes]]
pattern = "api.your-bogo.example.com"
custom_domain = true
```

`wrangler deploy --env production` auto-provisions the cert and DNS
record for both (custom_domain mode). Verify with
`curl https://api.your-bogo.example.com/api/live`.

Add **only one** CF Access Application (on `your-bogo.example.com`):

```
Zero Trust → Access → Applications → Add an application → Self-hosted
  Domain: your-bogo.example.com
  Policies:
    Allow:
      Include → Emails (or Emails ending in @yourdomain)
```

Do NOT create an Access app for `api.your-bogo.example.com`. The CLI
side relies on it being publicly reachable so the worker can do bearer
auth itself.

Set the worker secrets so it can verify the Access JWT on the SPA host:

```bash
cd packages/worker
bunx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production
# value: your-team.cloudflareaccess.com

bunx wrangler secret put CF_ACCESS_AUD --env production
# value: the AUD tag from the Application's Settings tab
```

See `docs/features/02-cli.md` §7 for the threat model and why the
public `api.*` host is safe under it (worker's bearer middleware is
the trust boundary, not CF Access).

## 4. Why `CLIP_BASE_URL` is not self-hosting

`CLIP_BASE_URL` only overrides business `baseUrl`. `bogo login` still
hits baked `loginUrl` (`https://bogo.hexly.ai/api/auth/cli`), mints a
token in **upstream** D1, then your worker's `api_tokens` lookup 401s.

There is no supported “quick path” with published `@nocoo/bogo`. Fork
and regenerate.

## 5. Fork and regenerate

This gives you a CLI with your own alias, command name, and npm scope.

```bash
git clone https://github.com/nocoo/bogo your-bogo
cd your-bogo
```

Edit `clip.yaml` (split-hostname model — see §3):

```yaml
name: "Your Bogo"
alias: yourbogo                                  # → ~/.clip/yourbogo/ + global command "yourbogo"
version: "0.4.0"
baseUrl: "https://api.your-bogo.example.com"     # CLI business host (not behind CF Access)
auth:
  type: browser-login
  loginUrl: "https://your-bogo.example.com/api/auth/cli"   # SPA host, CF Access protected
  tokenParam: api_key
  headerName: Authorization
  headerPrefix: Bearer
# ... endpoints unchanged ...
```

`loginUrl` (clip v1.0+) lets login target a different origin than
`baseUrl`. This is the whole point of the split-hostname model.

Regenerate locally:

```bash
clip generate ./clip.yaml --output ./yourbogo-cli
cd yourbogo-cli && bun install && bun link
yourbogo login
```

If you want to publish:

```bash
# Update packages/cli/package.json:
#   "name": "@yourorg/yourbogo"
# Then:
cd packages/cli
npm publish          # bun scripts/build.ts runs in prepack
```

The build script (`packages/cli/scripts/build.ts`) reads the root
`clip.yaml` and bundles a single-file CLI; it has no knowledge of the
upstream URL beyond what your yaml says.

## 6. Identity model — who can log in

`bogo login` mints a row in `api_tokens` keyed by `owner_email`. The
worker accepts any identity CF Access lets through, so **the CF Access
policy is the operator's allowlist**. Two practical setups:

- **Personal**: Allow policy with `Emails Ending In @yourdomain.com`.
- **Team**: Allow policy with `Country` / `IdP groups` / explicit list.

Service tokens also work (`common_name` claim populates `owner_email` —
spec §5.3) for agent automation that shouldn't go through a browser.

## 7. Token revocation

v1 has no admin UI. Operator can revoke any bearer by `prefix` (visible
in any `auth.token.slice(0, 12)` log line):

```bash
cd packages/worker
bunx wrangler d1 execute your-bogo --remote \
  --command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='bogo_xxxxxx'"
```

Also: `bogo login` always revokes the caller's prior `cli-login` row
atomically — one active CLI token per identity per deployment (spec §5.4
task 12).

## 8. FAQ

**Q: I can't `npm i -g @nocoo/bogo` and log in. What's happening?**
The upstream worker has a CF Access policy that does not include you.
`CLIP_BASE_URL` will not fix login. Fork and regenerate, or ask the
maintainer to add your email.

**Q: Does setting `CLIP_BASE_URL` change the credential file location?**
No. Credentials still land at `$CLIP_HOME/bogo/credentials.json` (the
alias from clip.yaml is baked in at codegen). Do not mix upstream login
tokens with a self-hosted API host.

**Q: Can I override the loginPath, tokenParam, or headerName?**
Only at codegen time (edit `clip.yaml`, regenerate). The CLI burns those in.

**Q: Does the worker need a custom domain?**
The production Access split needs **two** hostnames (`SPA` + `api.*`).
`*.workers.dev` is a single hostname and cannot do that split.

**Q: What does the `state` parameter on the callback do?**
CSRF protection — generated client-side by `cli-base`, echoed back by
the worker, validated by the loopback server. Even if a third party
forged a callback URL, the state mismatch would reject it. See spec
§2.3.

## 9. References

- Upstream worker code:
  [`packages/worker/`](../../packages/worker/)
- Migration files:
  [`packages/worker/migrations/`](../../packages/worker/migrations/)
- Auth implementation:
  [`packages/worker/src/middleware/access-auth.ts`](../../packages/worker/src/middleware/access-auth.ts),
  [`packages/worker/src/routes/auth.ts`](../../packages/worker/src/routes/auth.ts)
- Spec for the CLI auth flow:
  [`docs/features/02-cli.md`](./02-cli.md) §2.3 / §5.4 / §7
- clip's env-override behaviour:
  `../clip/packages/cli/src/codegen/templates.ts:299-372` (v1.1+)
