# SPEC: Self-Hosting bogo

## 1. Objective

bogo is open-source. By default `@nocoo/bogo` (the published CLI) targets
the upstream `https://bogo.hexly.ai` worker, which is gated by the
maintainer's Cloudflare Access policy — so a fresh `npm i -g @nocoo/bogo`
**will not** let an external user log in without help.

This document is the operator's guide for someone who wants to run their
own bogo: stand up a worker, configure auth, point the CLI at it. Two
supported paths are described:

- **A — quick:** use the published CLI, redirect at runtime via env var.
  Zero codegen, depends on clip ≥1.1 baked into the upstream build.
- **B — clean:** fork the repo, regenerate the CLI from your edited
  `clip.yaml`, publish under your own scope.

Path A is enough for an internal team or a personal homelab. Path B is
right if you want a branded CLI on your team's npm scope.

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

# First deploy
bunx wrangler deploy --env production
# Note the *.workers.dev URL or set up a custom domain
```

`wrangler.toml` must list the same D1 binding name (`DB`) the worker code
expects. The `[env.production]` block in upstream points at
`bogo.hexly.ai` — change `routes` / `vars` to your domain before deploy.

## 3. Cloudflare Access setup

The worker assumes CF Access fronts the browser flow and a Bypass policy
lets bearer tokens through. Two policies needed:

| Policy | Purpose |
|--------|---------|
| **Allow** (Service Auth disabled) on email allowlist | Gates browser sessions and `bogo login` consent |
| **Bypass** on `Authorization starts with "Bearer bogo_"` | Lets the CLI bearer token reach the worker without being challenged again |

Set the two secrets the worker reads:

```bash
cd packages/worker
bunx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production
# value: your-team.cloudflareaccess.com

bunx wrangler secret put CF_ACCESS_AUD --env production
# value: the AUD tag from the Application's Settings tab
```

See `docs/features/02-cli.md` §7 for the threat model behind the bypass
policy and why `/api/auth/cli` is still safe under it (two-stage consent
inside the worker, not at the Access layer).

## 4. Path A — point @nocoo/bogo at your worker

This needs no fork. Requires the `@nocoo/bogo` build that was generated
from clip ≥1.1 (which is what every npm release will be from `1.1.0`
onward).

```bash
npm i -g @nocoo/bogo
export CLIP_BASE_URL=https://your-bogo.example.com
bogo login                 # opens YOUR worker's consent page
bogo me                    # routed at your worker too
```

`CLIP_BASE_URL` overrides **both** business calls and the login flow
(clip 1.1 change). The maintainer's `https://bogo.hexly.ai` is just the
fallback when the env var is unset.

Persistence options:

- Export `CLIP_BASE_URL` in your shell init (`~/.zshrc`, etc.) for
  permanent redirect.
- Wrap the binary: `alias bogo='CLIP_BASE_URL=https://your-bogo … bogo'`.
- Per-team: ship the env var via your dotfiles / nix / homebrew formula.

### Limitations of path A

- Help text and console output still say "bogo" / `https://bogo.hexly.ai`
  in the README and credentials are still stored under `~/.clip/bogo/`
  (a single alias is baked into the CLI at codegen time). For a team
  CLI with your own branding, go to path B.
- You can't change the *alias* from `bogo` without regenerating. If you
  already have another CLI named `bogo`, also see path B.

## 5. Path B — fork and regenerate

This gives you a CLI with your own alias, command name, and npm scope.

```bash
git clone https://github.com/nocoo/bogo your-bogo
cd your-bogo
```

Edit `clip.yaml`:

```yaml
name: "Your Bogo"
alias: yourbogo            # → ~/.clip/yourbogo/ + global command "yourbogo"
version: "0.4.0"
baseUrl: "https://your-bogo.example.com"   # your worker URL
# ... endpoints unchanged ...
```

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
You need either path A with `CLIP_BASE_URL` pointing at your worker, or
ask the maintainer to add your email.

**Q: Does setting `CLIP_BASE_URL` change the credential file location?**
No. Credentials still land at `$CLIP_HOME/bogo/credentials.json` (the
alias from clip.yaml is baked in at codegen). If you redirect to your
worker, you're mixing tokens for two deployments under one alias — set
`CLIP_HOME` to a separate dir per env, or use path B with a different
alias.

**Q: Can I override the loginPath, tokenParam, or headerName?**
Only at codegen time (path B — edit clip.yaml). The CLI burns those in.

**Q: Does the worker need a custom domain?**
For path A: yes if you want `Authorization: Bearer bogo_*` to pass
through unmodified. For path B: no, but your `clip.yaml` baseUrl needs
to be a routable URL (a `*.workers.dev` URL works for personal use).

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
