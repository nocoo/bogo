# SPEC: CLI Bearer Auth

## 1. Objective

让用户在 Mac 上 `bun install -g <生成的-bogo-cli>` 后，跑一句 `<cli> auth login bogo` 弹浏览器登录拿到长期 bearer token，之后所有 `<cli>` 子命令直接 CRUD bogo 的 `/api/*`。

CLI 这一端用 [`clip`](../../../clip) 从 OpenAPI/`clip.yaml` codegen 出来，**不在本仓库写 CLI 代码**。本 spec 只覆盖 worker 端必须新增的能力：

1. D1 加 `api_tokens` 表
2. `access-auth` 中间件新增 Bearer 分支
3. 新端点 `GET /api/auth/cli` 完成「CF Access 已识别用户 → 生成 token → 302 回 loopback」
4. （可选）token 列表/撤销端点

**目标用户**：自用 + agent 自动化脚本。每个 token 等价于一个长期凭证，需可撤销。

## 2. Context — clip / cli-base 已就位

### clip 的 `auth.type: oauth` 已支持

`packages/cli/src/schema/validator.ts:86-89` 定义的 schema：

```yaml
auth:
  type: oauth
  loginPath: /api/auth/cli   # 默认值，可省
  tokenParam: api_key         # 默认值，可改成 token 等
  loginUrl: https://...       # 可选；不填则用 baseUrl + loginPath
```

`packages/cli/src/commands/auth.ts:17-97` 已实现 `clip auth login <alias>`，调用 `@nocoo/cli-base.performLogin`，回写 `~/.clip/bogo/credentials.json`（`type: oauth`, `token`, `email`, 0600 权限）。

### cli-base `performLogin` 契约

`packages/cli-base/src/login.ts`：

1. 起 loopback HTTP server 监听 `127.0.0.1:RANDOM_PORT`
2. 生成 `state` 随机 nonce
3. `openBrowser(apiUrl + loginPath + "?callback=http://127.0.0.1:PORT/callback&state=<nonce>" + extraParams)`
4. 等待回调 `GET /callback?<tokenParam>=<token>&state=<nonce>&email=<email>&...`
5. 校验 `state` 匹配，提取 token，`onSaveToken(token)` → 关闭 server → 返回 `{success, email, params}`

**worker 端必须满足**：
- 在 `loginPath` 接收 GET 请求（用户浏览器已经过 CF Access，带 JWT cookie）
- 用 `callback` query 参数中的 URL 做 302 redirect，把 `token=<bearer>` 拼到 query 上
- callback 是 `http://127.0.0.1:<port>/callback`，**worker 不能假设 callback 是任何固定值**——只能信任 query 参数，但要做 origin 校验

## 3. Data Model

### 新表（migration `0004_api_tokens.sql`）

```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_api_tokens_owner ON api_tokens(owner_email);
CREATE INDEX idx_api_tokens_hash ON api_tokens(token_hash);
```

| 字段 | 用途 |
|------|------|
| `id` | UUIDv7 主键 |
| `owner_email` | 颁发时 `c.get("userEmail")` 的值；CF Access 失效后此 token 仍可用，但只能撤销，无法重新映射用户 |
| `token_hash` | `sha256(plain_token)` 的 hex；明文只在 callback 时回传给 CLI 一次，永不入库 |
| `prefix` | 明文前 8 字符（如 `bogo_a3f2`），用于 `auth show` 展示而无需明文 |
| `label` | 可选标签，如 `"laptop-cli"`、`"agent-sde-01"` |
| `expires_at` | 可空；空 = 不过期（自用场景常用） |
| `revoked_at` | 撤销时间；非空则视为失效 |

### Token 明文格式

`bogo_<base64url(32 字节 randomBytes)>`，约 50 字符。前缀 `bogo_` 便于 grep / gitleaks 命中。

## 4. Worker Changes

### 4.1 Middleware — `packages/worker/src/middleware/access-auth.ts`

现状（`access-auth.ts:23-65`）只有两个分支：localhost / CF Access JWT。

新增**第三分支**：Bearer token，**优先于 CF Access JWT 校验**（典型 SDK 都先检查 `Authorization`）。

```ts
// Pseudocode — 完整改动在实施时给出
export async function accessAuth(c, next) {
  const host = c.req.header("host") || "";
  if (isLocalhost(host)) { c.set("userEmail", "dev@localhost"); return next(); }
  if (c.req.path === "/api/live") return next();

  const auth = c.req.header("Authorization") || "";
  if (auth.startsWith("Bearer bogo_")) {
    const token = auth.slice("Bearer ".length);
    const row = await c.env.DB.prepare(
      "SELECT owner_email, revoked_at, expires_at FROM api_tokens WHERE token_hash = ?"
    ).bind(await sha256Hex(token)).first();
    if (!row || row.revoked_at || (row.expires_at && row.expires_at < nowIso())) {
      return c.json({ error: "Invalid or revoked bearer token" }, 401);
    }
    // Best-effort last_used_at update; failure must not block the request.
    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
        .bind(nowIso(), await sha256Hex(token)).run()
    );
    c.set("userEmail", row.owner_email);
    c.set("accessAuthenticated", true);
    return next();
  }

  // ...existing CF Access JWT path...
}
```

**关键点**：
- bearer 路径**不**走 CF Access JWT 校验，所以 `/api/*` 在 CF Access 控制台需为带 `Authorization: Bearer` 的请求加 **Service Auth bypass policy**，否则 CF Access 会在 worker 之前 302 到登录页（参见 §7 部署）。
- `sha256` 用 `crypto.subtle.digest`（Workers runtime 原生）。
- `last_used_at` 更新走 `waitUntil`，失败不影响请求。

### 4.2 新路由 `/api/auth/cli` — `packages/worker/src/routes/auth.ts`（新文件）

```ts
import { Hono } from "hono";

const auth = new Hono<AppEnv>();

auth.get("/cli", async (c) => {
  // 走到这里时 access-auth 中间件已经放行：
  //   - 本地 dev → userEmail = "dev@localhost"
  //   - 生产 → CF Access JWT 已验证，userEmail 来自 JWT
  const email = c.get("userEmail");
  if (!email) return c.json({ error: "No authenticated user" }, 401);

  const callback = c.req.query("callback") || "";
  const state = c.req.query("state") || "";

  // 必须校验 callback 是 loopback URL，否则成 open redirect
  if (!isLoopbackCallback(callback)) {
    return c.text("Invalid callback URL", 400);
  }

  const plain = generateToken();              // bogo_<base64url32>
  const hash = await sha256Hex(plain);
  const prefix = plain.slice(0, 8);

  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)"
  ).bind(uuidv7(), email, hash, prefix, "cli-login").run();

  const redirect = new URL(callback);
  redirect.searchParams.set("api_key", plain);   // clip 默认 tokenParam
  redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);
  return c.redirect(redirect.toString(), 302);
});

export const authRoutes = auth;

function isLoopbackCallback(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:") return false;            // performLogin 用 http 不是 https
    if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return false;
    if (u.pathname !== "/callback") return false;        // performLogin 写死 /callback
    return true;
  } catch {
    return false;
  }
}
```

挂载在 `packages/worker/src/index.ts`：

```ts
app.route("/api/auth", authRoutes);
```

**安全约束**：
- callback 必须是 loopback（127.0.0.1 / localhost / [::1]）+ pathname = `/callback`，否则 400
- `state` 透传，由 CLI 端校验匹配（performLogin 已自动比对）
- 明文 token 只在 302 redirect URL 出现一次，**不写 worker 日志**

### 4.3 Token 管理端点（可选 — phase 2）

```
GET    /api/auth/tokens          列出当前用户的 token（不含明文，仅 id/prefix/label/created_at/last_used_at）
POST   /api/auth/tokens          手动颁发（body: { label, expires_at? }）→ 仅此响应中返回明文
DELETE /api/auth/tokens/:id      撤销（写 revoked_at）
```

走 CF Access JWT 校验（用户必须登录浏览器才能管理），不允许 bearer token 自己管理自己（避免被盗 token 自杀式删除）。

> **暂列为 phase 2**：先实现 §4.1 + §4.2 跑通 CLI 登录，token 撤销可临时手动 D1 SQL 改 `revoked_at`。

## 5. clip.yaml（bogo 端产出，供生成 CLI 用）

```yaml
name: "Bogo API"
alias: bogo
version: "0.3.0"
baseUrl: "https://bogo.hexly.ai"
auth:
  type: oauth
  loginPath: /api/auth/cli
  tokenParam: api_key
endpoints:
  - name: me
    method: GET
    path: /api/me
    description: "Current user identity"
    response: { type: object, properties: { email: string } }
  - name: workspaces:list
    method: GET
    path: /api/workspaces
    response: { type: array, items: { type: object, properties: { id: string, name: string } } }
  # ...其余 endpoints 后续补完或改用 clip generate --from openapi.json
```

**长期方向**：worker 生成 OpenAPI 文档（hono-openapi 或类似），CLI 端跑 `clip generate --from openapi.json --alias bogo` 自动同步。本 spec **不**覆盖 OpenAPI 生成，留作下一个 feature。

## 6. Atomic Commit Plan

按依赖顺序拆 6 个原子化 commit：

| # | Commit | 内容 |
|---|--------|------|
| 1 | `feat(db): add api_tokens table` | `migrations/0004_api_tokens.sql` + 本地 `wrangler d1 migrations apply` 验证 |
| 2 | `feat(worker): add bearer token middleware branch` | `access-auth.ts` 加 Bearer 分支；`access-auth.test.ts` 加 3 个 case（有效 / 撤销 / 过期） |
| 3 | `feat(worker): add /api/auth/cli login endpoint` | `routes/auth.ts` + 挂载；`auth.test.ts` 覆盖 callback 校验 / 成功 redirect / 拒绝非 loopback |
| 4 | `test(e2e): add bearer auth e2e tests` | `test/e2e/auth.test.ts` 跑完整登录流程（mock CF Access JWT → /api/auth/cli → Bearer 调 /api/me） |
| 5 | `docs(features): record bogo clip.yaml` | 提交 `clip.yaml` 到仓库（不入 worker bundle），README 加 CLI 安装说明 |
| 6 | `chore(cf-access): document bearer bypass policy` | `docs/architecture/03-system-architecture.md` 更新鉴权流程图 + Zero Trust 配置说明 |

Phase 2（独立 PR）：token 管理端点 + UI Settings 页签。

## 7. Cloudflare Access 部署配置

**当前**：`bogo.hexly.ai` 整域受 CF Access 保护，所有请求必须有 `CF-Authorization` cookie。

**改动**：在 Zero Trust → Access → Applications → bogo → Policies 增加一条 **Bypass policy**：

```
Selector: Request Header
Header: Authorization
Value: starts with "Bearer bogo_"
Action: Bypass
```

效果：带 Bearer header 的请求直达 worker；浏览器请求继续走 CF Access JWT。

**风险**：CF Access 的 header-based bypass 是有效手段（CF 官方支持），但若 bypass 规则误配会把 `/api/*` 完全暴露。Mitigation：
- worker 中间件**必须**校验 Bearer 格式（`bogo_` 前缀 + DB 查表），任何不命中的 Bearer 一律 401
- bypass policy 严格匹配 `starts with "Bearer bogo_"`，不放任何 Bearer 都过

## 8. 6DQ Quality Plan

| 维度 | 内容 | 触发 |
|------|------|------|
| **L1 Unit** | `access-auth.test.ts` 加 Bearer 分支 case；`routes/auth.test.ts` 新建覆盖端点逻辑；`sha256Hex` 工具单测 | pre-commit |
| **L2 E2E** | `test/e2e/auth.test.ts` 新建：完整模拟「带假 CF Access JWT → /api/auth/cli → 拿 token → Bearer 调 /api/me」 | pre-push |
| **L3 Playwright** | 不涉及 UI 变更（phase 2 加 token 管理页时再补） | — |
| **G1 Static** | tsc + biome（pre-commit hook 自动跑） | pre-commit |
| **G2 Security** | gitleaks 规则确保 `bogo_` 前缀的明文 token 永不入仓 | pre-push |
| **G3 Coverage** | worker package 总覆盖率不下降（当前阈值见 `scripts/check-coverage.sh`） | pre-push |

**额外校验项**（手测，写入 PR 描述 checklist）：
- [ ] 撤销 token（DB 改 `revoked_at`）后再调用 `/api/me` 返回 401
- [ ] 篡改 token 一位后返回 401
- [ ] `/api/auth/cli?callback=https://evil.com/cb` 返回 400（open redirect 防护）
- [ ] `/api/auth/cli` 无 callback query 返回 400
- [ ] CF Access service-token JWT 仍可正常调用 `/api/*`（兼容性）

## 9. Out of Scope

- OpenAPI 生成（worker 端导出 spec）—— 下一个 feature
- UI Settings 里的 token 管理页 —— phase 2
- Token 范围控制（仅某些 workspace）—— 当前所有 token 与颁发用户同权限
- Token rotation / refresh —— 当前长期有效，撤销重新颁发即可
- Audit log（谁在什么时候用 token 调了什么）—— 当前仅 `last_used_at`

## 10. Open Questions

1. **Token 默认是否过期？** 倾向"不过期"（自用 + agent 长期跑），但留 `expires_at` 字段。哥确认？
2. **`label` 颁发时是否必填？** 当前默认 `"cli-login"`，phase 2 token 管理 UI 可改。
3. **是否需要在 worker 限制单用户最大活跃 token 数？** 自用场景无所谓，先不做。

## References

- 现状鉴权中间件：[`packages/worker/src/middleware/access-auth.ts:23-65`](../../packages/worker/src/middleware/access-auth.ts)
- 中间件挂载：[`packages/worker/src/index.ts:15`](../../packages/worker/src/index.ts)
- 系统架构：[`docs/architecture/03-system-architecture.md`](../architecture/03-system-architecture.md)
- clip OAuth schema：`../../../clip/packages/cli/src/schema/validator.ts:86-89`
- clip auth login 实现：`../../../clip/packages/cli/src/commands/auth.ts:17-97`
- cli-base performLogin：`../../../cli-base/src/login.ts`
