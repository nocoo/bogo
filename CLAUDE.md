# Bogo — Project Instructions

## Architecture (Edge Dashboard)

Bogo 使用 **单一 Worker 架构**，同时服务 API 和前端：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │   bogo.hexly.ai     │                                        │
│  │   (Access 保护)      │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                   Worker (Hono)                      │        │
│  │  ├── /*              → SPA 静态文件 (packages/ui)    │        │
│  │  ├── /api/live       → 公开路由 (liveness)           │        │
│  │  └── /api/*          → CF Access JWT 保护            │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Local Development

### Port Allocation

| Port  | Purpose           | Domain                  |
|-------|-------------------|-------------------------|
| 7036  | Vite dev server   | bogo.dev.hexly.ai      |
| 8787  | Wrangler dev      | localhost:8787          |
| 17036 | L2 E2E tests      | localhost:17036         |
| 27036 | L3 Playwright     | localhost:27036         |

### Caddy Setup

Caddyfile: `/opt/homebrew/etc/Caddyfile`

Add this block for local HTTPS:
```
bogo.dev.hexly.ai {
    tls /Users/nocoo/workspace/personal/workflow/certs/cert.pem /Users/nocoo/workspace/personal/workflow/certs/key.pem
    reverse_proxy localhost:7036
}
```

DNS: `*.dev.hexly.ai` 通配符 A→127.0.0.1（Cloudflare），无需 /etc/hosts。

### Development Modes

**日常开发：UI 本地 + 直连 prod worker（推荐）**
```bash
bun dev   # 启动 vite (7036) + 本地 wrangler dev (8787, 仅供 E2E)
```
- 访问 `http://localhost:7036` 或 `https://bogo.dev.hexly.ai`（Caddy 反代 → 7036）
- `/api/*` 由 vite proxy 转发到本地 wrangler (8787) 或远程 worker
- localhost/dev.hexly.ai 请求跳过 Access JWT 校验

**方式 2：接近生产的测试**
```bash
bun turbo build --filter=@bogo/ui   # 构建到 worker/static/
cd packages/worker && bun dev       # wrangler dev 服务静态资源
```
- 访问 `localhost:8787`（wrangler 端口）
- 测试 wrangler assets 配置、SPA fallback 等

## Testing

### 6-Layer Test Architecture

| Layer | Type       | Command                                              | Gate      |
|-------|------------|------------------------------------------------------|-----------|
| L1    | Unit       | `bun turbo test`                                     | Coverage  |
| L2    | E2E (API)  | `bun turbo test:e2e --filter=@bogo/worker`           | Route     |
| L3    | Playwright | `cd packages/ui && bunx playwright test`             | Page      |
| G1    | Static     | `bun turbo typecheck` + `bunx biome check`           | —         |
| G2    | Security   | `gitleaks` + `osv-scanner`                           | —         |
| G3    | Coverage   | `bash scripts/check-coverage.sh`                     | Threshold |

### Pre-commit hook (L1 + G1)
Runs in parallel: unit_cov, typecheck, lint, gitleaks, routes gate, pages gate

### Pre-push hook (L2 + G2)
Runs in parallel: l2_e2e, g2_security

## Deployment

### Remote (Production)
- **Worker**: Cloudflare Workers (`bogo`), deploy with `npx wrangler deploy --env production`
- **UI**: Built into Worker static assets (`packages/worker/static/`)
- **Auth**: Cloudflare Access on `bogo.hexly.ai`
- **Domain**: `bogo.hexly.ai` (custom domain)
- **CI**: GitHub Actions via `nocoo/base-ci` reusable workflow
- **CD**: Tag push (`v*.*.*`) or CI green on main → auto deploy

### Cloudflare Access 配置

需要在 Cloudflare Zero Trust 控制台配置：
1. Access Application: `bogo.hexly.ai`
2. Policy: Allow specific email
3. Worker secrets: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`

GitHub Secrets 依赖：`CLOUDFLARE_API_TOKEN`

## Package Manager

bun (declared in `packageManager` field, single `bun.lock` lockfile)

## Retrospective

(empty — record learnings here)
