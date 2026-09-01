# @nocoo/bogo

Command-line companion to the [bogo](https://bogo.hexly.ai) personal
knowledge dashboard. The CLI is generated from the canonical
[`clip.yaml`](https://github.com/nocoo/bogo/blob/main/clip.yaml) so
every endpoint in the worker is reachable as a subcommand.

> **Defaults:** login `https://bogo.hexly.ai/api/auth/cli` (Access),
> API `https://api.bogo.hexly.ai`. `CLIP_BASE_URL` overrides API only.
>
> **Self-hosting?** Fork and regenerate `clip.yaml` — do not expect
> `CLIP_BASE_URL` to make `bogo login` talk to your worker. See
> [docs/features/03-self-hosting.md](https://github.com/nocoo/bogo/blob/main/docs/features/03-self-hosting.md).

## Install

```bash
# bun
bun add -g @nocoo/bogo

# npm
npm install -g @nocoo/bogo
```

Check the install:

```bash
bogo --version
bogo --help
```

## Authenticate

```bash
bogo login
```

Opens your browser, walks through Cloudflare Access, asks you to click
**Authorize** on a consent page, then writes a long-lived bearer to
`~/.clip/bogo/credentials.json` (mode `0600`).

Running `bogo login` again automatically revokes any prior CLI token
for the same account — one active token per identity.

## Use

```bash
bogo me
bogo workspaces-list
bogo workspaces-create --name "Acme"
bogo persons-create <wid> --name "Alice" --managerId <root-id>
bogo documents-create <wid> --title "Plan" --personIds <p-uuid>
bogo tags-create <wid> --name "P0" --scope document
```

Path params (`<wid>`, `<id>`, …) are positional. Body / query fields are
camelCase flags. Arrays go via comma-separated query (`--personIds a,b`).
Booleans take an explicit value (`--required true`). Full command matrix
and walkthroughs are in
[`docs/features/02-cli.md`](https://github.com/nocoo/bogo/blob/main/docs/features/02-cli.md).

## Configuration

| Env var          | Default                              | Purpose                                          |
| ---------------- | ------------------------------------ | ------------------------------------------------ |
| `CLIP_HOME`      | `~/.clip`                            | Root of the credentials directory                |
| `CLIP_BASE_URL`  | `https://api.bogo.hexly.ai` (from yaml `baseUrl`) | API base URL for **business** requests. Does **not** override `loginUrl`. |

`CLIP_BASE_URL` does not change `bogo login` — `loginUrl` is baked at
`clip generate` (`https://bogo.hexly.ai/api/auth/cli`). Split-hostname
self-host needs a regenerated CLI (path B in `docs/features/03-self-hosting.md`).

## Security

- Tokens never leave your machine after issue; the worker stores
  `sha256(token)` only.
- The CSRF / clickjacking protections live in the worker (two-stage
  consent + SameSite=Strict cookie + CSP); the CLI just rides them.
- Revoke a leaked token immediately by running `bogo login` again, or
  ask the operator to `UPDATE api_tokens SET revoked_at=…` by prefix.

## How it's built

```
bogo.hexly.ai  ←  clip.yaml (this repo)  →  clip generate  →  @nocoo/bogo
```

The package is published by running `bun scripts/build.ts` inside
`packages/cli/`, which invokes [clip](https://github.com/nocoo/clip)
to regenerate the CLI source, bundles it with `bun build`, and
hands the resulting `dist/` to npm. No source ships unbundled.

## License

[MIT](https://github.com/nocoo/bogo/blob/main/packages/cli/LICENSE)
