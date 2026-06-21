# SPEC: CLI Bearer Auth

## 1. Objective

让用户在 Mac 上 `bun link` 安装由 clip 从 `clip.yaml` 生成的 `bogo` CLI 后，跑一句 **`bogo login`** 弹浏览器登录拿到长期 bearer token，之后所有 `bogo <command>` 直接 CRUD `https://bogo.hexly.ai/api/*`。

CLI 这一端由 [`../clip`](../../../clip) (v1.0.0+) codegen 出来，**本仓库零 CLI 代码**。本 spec 只覆盖 worker 端必须新增的能力：

1. D1 加 `api_tokens` 表
2. `access-auth` 中间件加 Bearer 分支
3. 新端点 `GET /api/auth/cli`（CF Access 已识别用户 → 生成 token → 302 回 loopback）
4. 仓库里维护一份 `clip.yaml`（不入 worker bundle，给用户/agent 跑 `clip generate` 用）

**目标用户**：哥本人 + agent 自动化脚本。每个 token = 一个长期凭证，可撤销。

**非目标**：UI 端 token 管理页（phase 2）；token rotation；workspace 粒度限权。

## 2. Context — 当前 clip / cli-base 形态（已就位，零扩展）

> 本节是写 spec 当天调查 `../clip` (v1.0.0) 和 `../cli-base` (v0.2.4) 后固化的契约。worker 端实现**严格按此对齐**，否则生成的 CLI 跑不通。

### 2.1 clip.yaml 的 `auth.type: browser-login`

`../clip/packages/cli/src/schema/validator.ts:85-92`：

```ts
const BrowserLoginAuthSchema = z.object({
  type: z.literal("browser-login"),
  loginUrl: z.string().url().optional(),                    // 可省，缺省由 baseUrl + loginPath 拼出
  tokenParam: z.string().min(1).default("api_key"),         // callback query 的 token 字段名
  loginPath: z.string().startsWith("/").default("/api/auth/cli"),
  headerName: z.string().min(1).default("Authorization"),   // 后续 fetch 注入 header 名
  headerPrefix: z.string().default("Bearer"),               // 前缀（含空格分隔），可为空字符串
});
```

历史命名提示：早期叫 `oauth`，因为这不是 RFC 6749，`812ec38 → 20fc262` 重命名为 `browser-login`。我们**不要**写成 `oauth`。

### 2.2 生成的 CLI 用户面（这是最终用户跑的命令）

`../clip/packages/cli/src/codegen/templates.ts:6-82` 的 `renderIndex`：当 `auth.type === "browser-login"` 时，生成的 CLI 入口会暴露 `<alias> login` 命令（**不是** `clip auth login <alias>`）：

```bash
bogo login                 # 弹浏览器，拿 token 落盘到 ~/.clip/bogo/credentials.json
bogo me                    # 之后所有子命令自动注入 Authorization: Bearer <token>
bogo workspaces:list
bogo persons --wid <uuid>
...
```

注意：endpoint name 不能叫 `login` 或 `logout`，`validator.ts:171-181` 校验保留字。

### 2.3 生成的 callback 形状（worker 必须按此响应）

`../clip/packages/cli/src/codegen/templates.ts:299-365` 的 `renderLoginCommand` 调用 `cli-base.performLogin`，行为见 `../cli-base/src/login.ts`：

1. 起 loopback HTTP server，监听 `127.0.0.1:RANDOM`（仅环回）
2. 生成 `state` 随机 nonce（CSRF 防护）
3. `openBrowser(apiUrl + loginPath + "?callback=http://127.0.0.1:RANDOM/callback&state=<nonce>")`
4. 等回调 `GET /callback?<tokenParam>=<token>&state=<nonce>&email=<email>&...`
5. 校验 `state` 匹配 → `onSaveToken(token)` → 落 `credentials.json`

**worker `/api/auth/cli` 必须**：
- 接受 `callback` 和 `state` query 参数
- 在 callback URL 上追加 `<tokenParam>=<明文 token>` 和原样的 `state`，可附 `email=<…>`
- 302 redirect 到该 callback
- 校验 callback 是 loopback URL + pathname `/callback`（防 open redirect）

### 2.4 凭据落盘格式（不需要 worker 关心，但要清楚）

`../clip/packages/cli/src/auth/storage.ts:11-16` 与 `templates.ts:140-202`：

```json
{
  "type": "browser-login",
  "token": "bogo_xxxxxxxxx...",
  "email": "user@example.com"
}
```

之后每次请求，生成的 `src/config.ts` 注入 `Authorization: Bearer <token>`（按 schema 的 `headerName` / `headerPrefix`）。

### 2.5 黄金参考实现：clip/packages/demo-app

clip 的 demo-app 就是这套契约的最简 server 端实现，端点 30 行：`../clip/packages/demo-app/src/index.ts:25-51`。我们的 worker 实现照此结构，加上业务（D1 持久化、CF Access 识别用户、loopback 校验、撤销）。

## 3. Data Model

### 新表（migration `0004_api_tokens.sql`）

```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'cli-login',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_api_tokens_owner ON api_tokens(owner_email);
CREATE INDEX idx_api_tokens_hash  ON api_tokens(token_hash);
```

| 字段 | 用途 |
|------|------|
| `id` | UUIDv7 主键 |
| `owner_email` | 颁发时 `c.get("userEmail")`（CF Access `email` claim 或 service token `common_name`） |
| `token_hash` | `sha256(plain).hex` —— 明文只在 callback 时返回一次，永不入库 |
| `prefix` | 明文前 8 字符（如 `bogo_a3f2`），供 `auth show` / 日志展示 |
| `label` | 默认 `cli-login`，phase 2 允许自定义 |
| `expires_at` | 可空；空 = 永不过期 |
| `revoked_at` | 撤销时间；非空视为失效 |

### Token 明文格式

`bogo_<base64url(32 字节 randomBytes)>` ≈ 50 字符。

- 前缀 `bogo_` 便于 gitleaks / grep 命中
- 用 Workers runtime 原生 `crypto.getRandomValues`

## 4. Worker Changes

### 4.1 Middleware — `packages/worker/src/middleware/access-auth.ts`

现状（`access-auth.ts:23-65`）只有两个分支：localhost / CF Access JWT。

**新增 Bearer 分支**，**优先于** CF Access JWT 校验（典型 SDK 顺序）：

```ts
// 改动伪代码——完整 diff 见实施 commit
export async function accessAuth(c, next) {
  const host = c.req.header("host") || "";
  if (isLocalhost(host)) { c.set("userEmail", "dev@localhost"); return next(); }
  if (c.req.path === "/api/live") return next();

  // === 新增分支 ===
  const auth = c.req.header("Authorization") ?? "";
  if (auth.startsWith("Bearer bogo_")) {
    const plain = auth.slice("Bearer ".length);
    const hash = await sha256Hex(plain);
    const row = await c.env.DB.prepare(
      "SELECT owner_email, revoked_at, expires_at FROM api_tokens WHERE token_hash = ?"
    ).bind(hash).first<{ owner_email: string; revoked_at: string | null; expires_at: string | null }>();
    if (!row || row.revoked_at || (row.expires_at && row.expires_at < new Date().toISOString())) {
      return c.json({ error: "Invalid or revoked bearer token" }, 401);
    }
    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
        .bind(new Date().toISOString(), hash).run()
    );
    c.set("userEmail", row.owner_email);
    c.set("accessAuthenticated", true);
    return next();
  }
  // === /新增分支 ===

  // …已有 CF Access JWT 路径，整段保持不变…
}
```

**实现要点**：
- `sha256Hex(s)` 用 `crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))` 转 hex；放 `src/utils/hash.ts`，独立单测
- `last_used_at` 走 `waitUntil`，失败不阻塞请求
- 非 `bogo_` 前缀的 Bearer 一律落到下面 CF Access 分支（让 CF Access 自己拒）

### 4.2 路由 — `packages/worker/src/routes/auth.ts`（新文件）

```ts
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { uuidv7 } from "@bogo/shared";    // 已存在
import { sha256Hex } from "../utils/hash.js";

const auth = new Hono<AppEnv>();

auth.get("/cli", async (c) => {
  // 中间件已认证用户身份（CF Access JWT 或本地 dev）
  const email = c.get("userEmail");
  if (!email) return c.json({ error: "No authenticated user" }, 401);

  const callback = c.req.query("callback") ?? "";
  const state = c.req.query("state") ?? "";
  if (!isLoopbackCallback(callback)) {
    return c.text("Invalid callback URL", 400);
  }

  const plain = generateToken();
  const hash = await sha256Hex(plain);
  const prefix = plain.slice(0, 8);

  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)"
  ).bind(uuidv7(), email, hash, prefix, "cli-login").run();

  const redirect = new URL(callback);
  redirect.searchParams.set("api_key", plain);   // == clip.yaml tokenParam 默认值
  if (state) redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);
  return c.redirect(redirect.toString(), 302);
});

export const authRoutes = auth;

export function isLoopbackCallback(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:") return false;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return false;
    if (u.pathname !== "/callback") return false;
    return true;
  } catch {
    return false;
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url, no padding
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `bogo_${b64}`;
}
```

挂载 `packages/worker/src/index.ts`：

```ts
import { authRoutes } from "./routes/auth.js";
// …
app.route("/api/auth", authRoutes);
```

**安全约束**：
- callback 必须 loopback + pathname `/callback`（performLogin 写死，见 `cli-base/src/login.ts:115` `if (url.pathname !== "/callback")`）
- 明文 token 仅 302 一次，**不写 worker 日志**（hono 默认不打 redirect URL，但要避免人为 `console.log`）
- `state` 透传，CLI 端 performLogin 自动比对

### 4.3 Token 管理端点（phase 2，独立 PR）

```
GET    /api/auth/tokens          列出（不含明文）
POST   /api/auth/tokens          手动颁发，body: { label, expires_at? }
DELETE /api/auth/tokens/:id      撤销
```

强制走 CF Access JWT（用户在浏览器登录），bearer token 不允许管理 token 防止盗用后自杀式删除。本 spec **不**实现，留 v2。撤销在 v1 可手动 D1 改 `revoked_at`。

## 5. clip.yaml（仓库根 `clip.yaml`）

按 clip v1.0.0 schema 写：

```yaml
name: "Bogo API"
alias: bogo
version: "0.3.0"
baseUrl: "https://bogo.hexly.ai"
auth:
  type: browser-login
  loginPath: /api/auth/cli
  tokenParam: api_key
  headerName: Authorization
  headerPrefix: Bearer
endpoints:
  # —— 公开端点 ——
  - name: live
    method: GET
    path: /api/live
    description: "Health check"

  # —— 用户身份 ——
  - name: me
    method: GET
    path: /api/me
    description: "Current user identity"
    response: { type: object, properties: { email: string } }

  # —— Workspaces ——
  - name: workspaces-list
    method: GET
    path: /api/workspaces
    description: "List own workspaces"
    response: { type: array, items: { type: object, properties: { id: string, name: string } } }

  - name: workspaces-create
    method: POST
    path: /api/workspaces
    description: "Create workspace"
    params:
      body:
        name: { type: string, required: true }

  - name: workspaces-update
    method: PUT
    path: "/api/workspaces/:id"
    description: "Rename workspace"
    params:
      path:
        id: { type: string, required: true }
      body:
        name: { type: string, required: true }

  - name: workspaces-delete
    method: DELETE
    path: "/api/workspaces/:id"
    description: "Delete workspace"
    params:
      path:
        id: { type: string, required: true }

  # —— Persons / Fields / Doc-Types / Documents / Tags ——
  # （按 docs/architecture/03-system-architecture.md 的端点表逐条对齐）
  # 首次 commit 可以先只放 me + workspaces-* 跑通 login → 调用链，其余增量补
```

**命名规范**：clip schema 校验 endpoint name 是 kebab-case，`/^[a-z][a-z0-9-]*$/`，所以用 `workspaces-list` 而不是 `workspaces:list`。

**`login` / `logout` 不能用作 endpoint name**（`validator.ts:171-181`）。

## 6. Atomic Commit Plan（细化版）

按依赖顺序拆 **8 个** 原子化 commit。每个独立可 review，pre-commit / pre-push 各自能过。

### Commit 1 — `feat(db): add api_tokens table`

| 项 | 内容 |
|----|-----|
| 新增文件 | `packages/worker/migrations/0004_api_tokens.sql` |
| 内容 | §3 的 CREATE TABLE + 2 个 INDEX |
| 本地验证 | `cd packages/worker && bunx wrangler d1 migrations apply bogo --local` 应零错误 |
| 测试 | 不需要新测试 |
| Gate | pre-commit（L1 + G1，不涉代码） |

### Commit 2 — `feat(worker): add sha256Hex util`

| 项 | 内容 |
|----|-----|
| 新增 | `packages/worker/src/utils/hash.ts` + `hash.test.ts` |
| 接口 | `export async function sha256Hex(s: string): Promise<string>` |
| 测试 | 5 个 case：空串、ASCII、中文、长字符串、与 Node.js crypto 输出对齐 |
| 验证 | `bun test packages/worker/src/utils/hash.test.ts` 全过 |
| Gate | pre-commit（L1 + G1） |

### Commit 3 — `feat(worker): add bearer token branch to access-auth`

| 项 | 内容 |
|----|-----|
| 修改 | `packages/worker/src/middleware/access-auth.ts`（按 §4.1 加分支） |
| 修改 | `packages/worker/src/middleware/access-auth.test.ts` 加 4 个 case |
| 测试 case | (a) 有效 bearer → 设 userEmail + next；(b) revoked 非空 → 401；(c) expires_at 已过 → 401；(d) 表中不存在 → 401；(e) 非 `bogo_` 前缀 Bearer → fallthrough 到 CF Access 分支 |
| 依赖 | Commit 1（表）+ Commit 2（hash） |
| 验证 | `bun test packages/worker/src/middleware/` 全过 |
| Gate | pre-commit |

### Commit 4 — `feat(worker): add /api/auth/cli login endpoint`

| 项 | 内容 |
|----|-----|
| 新增 | `packages/worker/src/routes/auth.ts`（§4.2 全文） |
| 新增 | `packages/worker/src/routes/auth.test.ts` |
| 修改 | `packages/worker/src/index.ts`（挂 `app.route("/api/auth", authRoutes)`） |
| 测试 case | (a) localhost dev 模式 → 302 含 api_key/state/email；(b) callback 非 loopback → 400；(c) callback pathname ≠ `/callback` → 400；(d) callback protocol https → 400；(e) callback 缺失 → 400；(f) 写入 DB 后 token_hash 与 redirect URL 中 api_key 的 sha256 相等 |
| 依赖 | Commit 1 + 2 |
| 验证 | `bun test packages/worker/src/routes/auth.test.ts` 全过；`bun turbo typecheck` 0 错 |
| Gate | pre-commit |

### Commit 5 — `test(e2e): add bearer auth e2e tests`

| 项 | 内容 |
|----|-----|
| 新增 | `packages/worker/test/e2e/auth.test.ts` |
| 风格 | 参照 `test/e2e/api.test.ts` 既有 wrangler dev 起 server 模式 |
| 流程 | (1) 模拟 `dev@localhost` 走 `/api/auth/cli?callback=…&state=abc`；(2) parse redirect → 取 token；(3) 用 token 调 `/api/me` 应得 `{email: "dev@localhost"}`；(4) 直接 D1 UPDATE `revoked_at` 后再调 `/api/me` 应 401 |
| 验证 | `bun turbo test:e2e --filter=@bogo/worker` 全过 |
| Gate | pre-push（L2 + G2 全跑） |

### Commit 6 — `chore: add root clip.yaml`

| 项 | 内容 |
|----|-----|
| 新增 | 仓库根 `clip.yaml`（§5） |
| 修改 | `.gitignore` 不动（`clip.yaml` 要入 git） |
| 修改 | `packages/worker/wrangler.toml` 不动（不入 worker bundle） |
| 验证 | `cd ../clip && bun packages/cli/src/index.ts generate ../bogo/clip.yaml --output /tmp/bogo-cli-test` 应产出可 `bun install` 的 CLI |
| Gate | pre-commit |

### Commit 7 — `docs(architecture): update auth flow for bearer tokens`

| 项 | 内容 |
|----|-----|
| 修改 | `docs/architecture/03-system-architecture.md` |
| 改动 | 把鉴权流程图加一条 Bearer 分支；在「Endpoints」表加 `GET /api/auth/cli`；新一节「CLI 鉴权」引用本 spec |
| 验证 | 人工 review |
| Gate | pre-commit |

### Commit 8 — `chore(cf-access): document bearer bypass policy in README`

| 项 | 内容 |
|----|-----|
| 修改 | 根 `README.md` 加「CLI 使用」节：`bun link` clip 后 `clip generate clip.yaml` → `bun link` 生成的 CLI → `bogo login` |
| 修改 | `CLAUDE.md` 加一节「Cloudflare Access 配置」描述 §7 的 bypass policy |
| 验证 | 人工 review |
| Gate | pre-commit |

> **顺序约束**：Commit 1 是表，Commit 2 是工具；3 和 4 都依赖 1+2；5 依赖 3+4；6/7/8 与代码无强依赖，但建议 5 跑通后再合，以免文档撒谎。

> **Phase 2（独立 PR，不在本 spec 8 个 commit 内）**：§4.3 token 管理端点 + UI Settings token 列表/撤销 + CHANGELOG.md 标记 0.4.0。

## 7. Cloudflare Access 部署配置

**当前**：`bogo.hexly.ai` 整域受 CF Access 保护，所有请求必须有 `CF-Authorization` cookie 或 service token headers。

**改动**：Zero Trust → Access → Applications → bogo → Policies 增加一条 **Bypass policy**：

| 字段 | 值 |
|------|---|
| Action | `Bypass` |
| Include → Selector | `Request Header` |
| Header name | `Authorization` |
| Operator | `starts with` |
| Value | `Bearer bogo_` |

效果：带此 header 的请求直达 worker；浏览器请求继续走 CF Access JWT。

**`/api/auth/cli` 不能加入 bypass**——这个端点要求用户已在 CF Access 登过，c.get("userEmail") 才有值。

**风险与缓解**：
- 误配 bypass 会让 `/api/*` 暴露。Mitigation：worker 中间件**必须**校验 Bearer 格式（`bogo_` 前缀 + DB 命中），不命中一律 401。bypass policy 严格匹配 `starts with "Bearer bogo_"`。
- D1 表泄漏（hash 而非明文）：攻击者无法反推 token。

## 8. 6DQ Quality Plan

| 维度 | 验收 | 触发 |
|------|------|------|
| **L1 Unit** | `hash.test.ts` 5 个 case；`access-auth.test.ts` 加 5 个 case；`auth.test.ts` 6 个 case。worker package 总覆盖率不下降 | pre-commit |
| **L2 E2E** | `test/e2e/auth.test.ts`：完整 login → bearer 调用 → 撤销 → 401 流程 | pre-push |
| **L3 Playwright** | 不涉及 UI（phase 2 加 token 管理页时再补 page test + a11y） | — |
| **G1 Static** | `bun turbo typecheck` + `bunx biome check`（pre-commit 自动跑） | pre-commit |
| **G2 Security** | gitleaks 检查 `bogo_` 前缀的明文 token 不入仓；osv-scanner 检查依赖（本 spec 不加新依赖） | pre-push |
| **G3 Coverage** | `bash scripts/check-coverage.sh` 阈值不降 | pre-push |

**手测 checklist**（PR 描述里要勾）：
- [ ] 本地 dev：`bun dev` 后 `curl http://localhost:8787/api/auth/cli?callback=http://127.0.0.1:9999/callback` 应 302 含 api_key
- [ ] D1 改 `revoked_at` 后再调 `/api/me` → 401
- [ ] 篡改 token 任意一字符 → 401
- [ ] `callback=https://evil.com/callback` → 400（open redirect 防护）
- [ ] `callback=http://127.0.0.1:9999/admin` → 400（path 校验）
- [ ] 无 callback query → 400
- [ ] 端到端：本地起 wrangler dev + 跑 `cd /tmp/bogo-cli-test && bun src/index.ts login`（dev 模式跳过 CF Access），浏览器 302 后 token 落到 `~/.clip/bogo/credentials.json`
- [ ] 端到端：上一步后跑 `bogo me` 应输出 `{email: "dev@localhost"}`
- [ ] CF Access service token JWT 仍能调 `/api/*`（与 bearer 并存，不互斥）

## 9. Out of Scope

- OpenAPI 自动生成（hono-openapi 等）—— 下一个 feature
- UI Settings token 管理页 —— phase 2
- Token 范围（仅某些 workspace）—— 所有 token 与颁发用户同权限
- Token rotation / refresh —— 长期有效，撤销 + 重新颁发即可
- Audit log（谁、何时、调了什么） —— 当前仅 `last_used_at`
- 把 bogo 作为 clip 的 e2e fixture —— clip 那边已有 demo-app，bogo 不需要进 clip 仓库

## 10. Open Questions（需哥确认后再开干）

1. **Token 默认是否过期？** 倾向"不过期"（自用 + agent 长期跑），保留 `expires_at` 字段。
2. **`label` 是否在 v1 暴露？** 当前默认 `"cli-login"`，phase 2 token 管理 UI 暴露。
3. **是否限制单用户最大活跃 token 数？** 自用场景无所谓，暂不限制。
4. **`prefix` 长度 8 字符够不够区分？** `bogo_` + 3 个 base64url 字符；可改 12（含 `bogo_` + 7 字符）。

## References

### 本仓库
- 现状鉴权中间件：[`packages/worker/src/middleware/access-auth.ts`](../../packages/worker/src/middleware/access-auth.ts)（特别是第 23-65 行）
- 中间件挂载与路由表：[`packages/worker/src/index.ts:15`](../../packages/worker/src/index.ts)
- 现有迁移命名：[`packages/worker/migrations/`](../../packages/worker/migrations/)（0001/0002/0003）
- 现有 E2E 风格：[`packages/worker/test/e2e/api.test.ts`](../../packages/worker/test/e2e/api.test.ts)
- 系统架构（鉴权流程图待更新）：[`docs/architecture/03-system-architecture.md`](../architecture/03-system-architecture.md)

### clip v1.0.0（外部）
- Schema 定义（auth.type 三选项）：`../clip/packages/cli/src/schema/validator.ts:80-104`
- 保留字校验：`../clip/packages/cli/src/schema/validator.ts:171-181`
- 生成 CLI 入口模板（`<alias> login` 子命令）：`../clip/packages/cli/src/codegen/templates.ts:58-82`
- 生成的 login 命令模板：`../clip/packages/cli/src/codegen/templates.ts:299-365`
- 生成的 config 模板（header 注入）：`../clip/packages/cli/src/codegen/templates.ts:140-202`
- 凭据存储：`../clip/packages/cli/src/auth/storage.ts:11-29`
- Server 端黄金参考实现：`../clip/packages/demo-app/src/index.ts:25-51`
- Demo schema：`../clip/packages/demo-app/clip.yaml`
- clip 项目宪法：`../clip/CLAUDE.md`（提到 bogo 是真实用户，schema 改动会先 grep bogo）

### cli-base v0.2.4（外部）
- performLogin 契约：`../cli-base/src/login.ts`（特别是 callback path 写死 `/callback` 在 :115）
