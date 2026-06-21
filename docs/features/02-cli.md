# SPEC: Bogo CLI

## 1. Objective

把 bogo 从浏览器 SPA 扩展成"**浏览器 + 命令行**"双形态。用户（哥本人 + agent 自动化脚本）在 Mac 上跑一条命令就能：

1. **登录** — `bogo login` 弹浏览器，复用 CF Access 已识别的身份,落 token 到 `~/.clip/bogo/credentials.json`(0600)
2. **完整 CRUD** — `bogo workspaces-list`、`bogo persons-create --wid …`、`bogo documents-update …` 等覆盖所有 `/api/*` 端点
3. **自证可用** — 仓库里有 `bogo cli` 的 e2e 测试,能从「`clip generate` → 启 wrangler dev → `bogo login` → 调一圈 CRUD → 撤销 token → 验 401」端到端跑通

**CLI 本身的代码不写在这个仓库**——本仓库只产出一份 `clip.yaml`,由 [`../clip` v1.0.0+](../../../clip) `clip generate` 自动生成 commander 驱动的 TypeScript CLI 项目。本仓库要做的是:

- worker 端补 bearer-token 鉴权 + `/api/auth/cli` 端点
- 维护一份与 worker 实现同步的根 `clip.yaml`
- 写 e2e 测试证明生成的 CLI 真能调通

**非目标**:写自己的 CLI 实现;UI 端 token 管理页(phase 2);token rotation;workspace 粒度限权。

## 2. Context — clip v1.0.0 / cli-base v0.2.4 契约

> 本节固化当天调查 `../clip` 和 `../cli-base` 后的事实。worker 端实现严格按此对齐,否则生成的 CLI 跑不通。

### 2.1 clip.yaml 的 `auth.type: browser-login`

`../clip/packages/cli/src/schema/validator.ts:85-92`:

```ts
const BrowserLoginAuthSchema = z.object({
  type: z.literal("browser-login"),
  loginUrl: z.string().url().optional(),
  tokenParam: z.string().min(1).default("api_key"),
  loginPath: z.string().startsWith("/").default("/api/auth/cli"),
  headerName: z.string().min(1).default("Authorization"),
  headerPrefix: z.string().default("Bearer"),
});
```

历史命名:早期叫 `oauth`,clip `812ec38 / 20fc262` 重命名为 `browser-login`(因为这不是 RFC 6749)。本仓库**绝不**写 `oauth`。

### 2.2 生成 CLI 的命令面(终端用户实际跑的命令)

`../clip/packages/cli/src/codegen/templates.ts:6-82` 在 `auth.type === "browser-login"` 时,把 `login` 作为子命令塞进生成的 CLI 入口。所以最终用户跑的是:

```bash
bogo login                       # 弹浏览器登录
bogo me                          # GET /api/me
bogo workspaces-list             # GET /api/workspaces
bogo persons-list --wid <uuid>   # GET /api/w/:wid/persons
…
```

**不是** `clip auth login bogo`。**endpoint name 不能叫 `login` 或 `logout`**(`validator.ts:171-181` 校验保留字)。

### 2.3 worker 必须实现的 callback 协议

`../cli-base/src/login.ts` 的 `performLogin`:

1. 起 loopback HTTP server,监听 `127.0.0.1:RANDOM`(仅环回)
2. 生成 `state` 随机 nonce(CSRF)
3. `openBrowser(<apiUrl> + <loginPath> + "?callback=http://127.0.0.1:RANDOM/callback&state=<nonce>")`
4. 等回调 `GET /callback?<tokenParam>=<token>&state=<nonce>&email=<email>&...`
5. 校验 `state` → `onSaveToken(token)` → 落 `credentials.json`

worker `/api/auth/cli` 必须接 `callback` 和 `state` query 参数,验完 loopback 合法性后 302 到 `callback`,追加 `<tokenParam>=<明文 token>` 和原样 `state`,附 `email`。`callback pathname` performLogin 写死 `/callback`(`cli-base/src/login.ts:115`)。

### 2.4 凭据落盘格式(worker 不关心,但要清楚)

`../clip/packages/cli/src/auth/storage.ts:11-16`:

```json
{ "type": "browser-login", "token": "bogo_xxxxx", "email": "user@example.com" }
```

之后每次请求,`templates.ts:140-202` 渲染的 `src/config.ts` 注入 `Authorization: Bearer <token>`(按 schema 的 `headerName` / `headerPrefix`)。

### 2.5 黄金参考实现

`../clip/packages/demo-app/src/index.ts:25-51` 用 30 行 hono 把整套契约跑通。我们的实现就是这套结构 + 业务(D1 持久化、CF Access 识别用户、loopback 校验、撤销)。

## 3. CLI 命令矩阵

把 `packages/worker/src/routes/*.ts` 上的全部端点映射到 CLI 子命令。endpoint name 用 kebab-case `^[a-z][a-z0-9-]*$`(clip 校验规则)。

### 3.1 公开 + 身份

| 子命令 | HTTP | Path | 备注 |
|--------|------|------|------|
| `bogo live` | GET | `/api/live` | 健康检查 |
| `bogo me` | GET | `/api/me` | 当前 userEmail |

### 3.2 Workspaces

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo workspaces-list` | GET | `/api/workspaces` |
| `bogo workspaces-create --name <…>` | POST | `/api/workspaces` |
| `bogo workspaces-get <id>` | GET | `/api/workspaces/:id` |
| `bogo workspaces-update <id> --name <…>` | PUT | `/api/workspaces/:id` |
| `bogo workspaces-delete <id>` | DELETE | `/api/workspaces/:id` |

### 3.3 Persons

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo persons-list --wid <…> [--tag-ids <a,b>]` | GET | `/api/w/:wid/persons` |
| `bogo persons-get <wid> <id>` | GET | `/api/w/:wid/persons/:id` |
| `bogo persons-create <wid> --name <…> --manager-id <…> [--title] [--dotted-manager-id] [--avatar-url]` | POST | `/api/w/:wid/persons` |
| `bogo persons-update <wid> <id> [--name] [--title] [--dotted-manager-id] [--avatar-url]` | PUT | `/api/w/:wid/persons/:id` |
| `bogo persons-move <wid> <id> --manager-id <…\|null>` | PUT | `/api/w/:wid/persons/:id/move` |
| `bogo persons-delete <wid> <id>` | DELETE | `/api/w/:wid/persons/:id` |
| `bogo persons-documents <wid> <id>` | GET | `/api/w/:wid/persons/:id/documents` |

### 3.4 Documents

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo documents-list <wid> [--tag-ids]` | GET | `/api/w/:wid/documents` |
| `bogo documents-get <wid> <id>` | GET | `/api/w/:wid/documents/:id` |
| `bogo documents-create <wid> --title <…> [--content] [--type-id] [--event-date] [--person-ids]` | POST | `/api/w/:wid/documents` |
| `bogo documents-update <wid> <id> [--title] [--content] [--type-id] [--event-date]` | PUT | `/api/w/:wid/documents/:id` |
| `bogo documents-delete <wid> <id>` | DELETE | `/api/w/:wid/documents/:id` |
| `bogo documents-versions <wid> <id>` | GET | `/api/w/:wid/documents/:id/versions` |
| `bogo documents-persons-list <wid> <id>` | GET | `/api/w/:wid/documents/:id/persons` |
| `bogo documents-persons-add <wid> <id> --person-id <…> [--role]` | POST | `/api/w/:wid/documents/:id/persons` |
| `bogo documents-persons-remove <wid> <id> <personId>` | DELETE | `/api/w/:wid/documents/:id/persons/:personId` |

### 3.5 Fields (Custom Field Definitions + Values)

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo fields-list <wid>` | GET | `/api/w/:wid/fields` |
| `bogo fields-create <wid> --name --field-type [--options] [--required] [--default-value]` | POST | `/api/w/:wid/fields` |
| `bogo fields-update <wid> <id> [--name --field-type --options --required --default-value --sort-order]` | PUT | `/api/w/:wid/fields/:id` |
| `bogo fields-delete <wid> <id>` | DELETE | `/api/w/:wid/fields/:id` |
| `bogo fields-values-get <wid> <personId>` | GET | `/api/w/:wid/fields/values/:personId` |
| `bogo fields-values-set <wid> <personId> <fieldDefId> --value <…>` | PUT | `/api/w/:wid/fields/values/:personId/:fieldDefId` |

### 3.6 Doc Types

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo doc-types-list <wid>` | GET | `/api/w/:wid/doc-types` |
| `bogo doc-types-create <wid> --name [--color]` | POST | `/api/w/:wid/doc-types` |
| `bogo doc-types-update <wid> <id> [--name --color --sort-order]` | PUT | `/api/w/:wid/doc-types/:id` |
| `bogo doc-types-delete <wid> <id>` | DELETE | `/api/w/:wid/doc-types/:id` |

### 3.7 Tags

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo tags-list <wid> [--scope --include-counts]` | GET | `/api/w/:wid/tags` |
| `bogo tags-stats <wid> [--scope]` | GET | `/api/w/:wid/tags/stats` |
| `bogo tags-create <wid> --name --scope [--color --sort-order]` | POST | `/api/w/:wid/tags` |
| `bogo tags-update <wid> <id> [--name --color --sort-order]` | PUT | `/api/w/:wid/tags/:id` |
| `bogo tags-delete <wid> <id>` | DELETE | `/api/w/:wid/tags/:id` |
| `bogo tags-documents-add <wid> <id> <docId>` | PUT | `/api/w/:wid/tags/:id/documents/:docId` |
| `bogo tags-documents-remove <wid> <id> <docId>` | DELETE | `/api/w/:wid/tags/:id/documents/:docId` |
| `bogo tags-persons-add <wid> <id> <personId>` | PUT | `/api/w/:wid/tags/:id/persons/:personId` |
| `bogo tags-persons-remove <wid> <id> <personId>` | DELETE | `/api/w/:wid/tags/:id/persons/:personId` |

**总计:约 45 个子命令 + 1 个内置 `login`**,clip 自动从 §6 的 `clip.yaml` 生成。

## 4. 数据模型(仅 §3 之外的新增)

### 4.1 `migrations/0004_api_tokens.sql`

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

| 字段 | 说明 |
|------|------|
| `id` | UUIDv7 |
| `owner_email` | 颁发时 `c.get("userEmail")`(CF Access `email` claim 或 service token `common_name`) |
| `token_hash` | `sha256(plain).hex` — 明文只在 callback 返回一次,永不入库 |
| `prefix` | 明文前 12 字符(如 `bogo_a3f2x9`),供 `auth show` / 日志展示 |
| `label` | 默认 `cli-login` |
| `expires_at` | 可空;空 = 永不过期 |
| `revoked_at` | 撤销时间;非空视为失效 |

### 4.2 Token 明文格式

`bogo_<base64url(32 字节 randomBytes)>` ≈ 50 字符。

- `bogo_` 前缀便于 gitleaks / grep 命中
- 用 Workers 原生 `crypto.getRandomValues`

## 5. Worker 实现

### 5.1 `packages/worker/src/utils/hash.ts`(新文件)

```ts
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
```

### 5.2 `packages/worker/src/middleware/access-auth.ts` — 新增 Bearer 分支

现状(`access-auth.ts:23-65`)只有 localhost / CF Access JWT 两个分支。新增第三分支,**优先于** CF Access JWT 校验:

```ts
export async function accessAuth(c, next) {
  const host = c.req.header("host") || "";
  if (isLocalhost(host)) { c.set("userEmail", "dev@localhost"); return next(); }
  if (c.req.path === "/api/live") return next();

  // === 新增 ===
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
  // === /新增 ===

  // …已有 CF Access JWT 路径整段保持不变…
}
```

### 5.3 `packages/worker/src/routes/auth.ts`(新文件)

```ts
import { Hono } from "hono";
import { generateId } from "@bogo/shared";
import type { AppEnv } from "../types.js";
import { sha256Hex } from "../utils/hash.js";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/cli", async (c) => {
  const email = c.get("userEmail");
  if (!email) return c.json({ error: "No authenticated user" }, 401);

  const callback = c.req.query("callback") ?? "";
  const state = c.req.query("state") ?? "";
  if (!isLoopbackCallback(callback)) {
    return c.text("Invalid callback URL", 400);
  }

  const plain = generateToken();
  const hash = await sha256Hex(plain);
  const prefix = plain.slice(0, 12);

  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)"
  ).bind(generateId(), email, hash, prefix, "cli-login").run();

  const redirect = new URL(callback);
  redirect.searchParams.set("api_key", plain);   // == clip.yaml tokenParam
  if (state) redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);
  return c.redirect(redirect.toString(), 302);
});

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
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `bogo_${b64}`;
}
```

`packages/worker/src/index.ts` 加挂载:

```ts
import { authRoutes } from "./routes/auth.js";
// …
app.route("/api/auth", authRoutes);
```

### 5.4 Phase 2(独立 PR,不在本 spec 覆盖)

```
GET    /api/auth/tokens          列出(不含明文)
POST   /api/auth/tokens          手动颁发,body: { label, expires_at? }
DELETE /api/auth/tokens/:id      撤销
```

强制走 CF Access JWT(用户必须浏览器登录),不允许 bearer token 管理自己。v1 撤销靠手动 D1 `UPDATE api_tokens SET revoked_at = …`。

## 6. 仓库根 `clip.yaml`(完整)

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
  - { name: live, method: GET, path: /api/live, description: "Health check" }

  - name: me
    method: GET
    path: /api/me
    description: "Current authenticated identity"

  # —— Workspaces ——
  - { name: workspaces-list,   method: GET,    path: /api/workspaces,        description: "List own workspaces" }
  - name: workspaces-create
    method: POST
    path: /api/workspaces
    description: "Create workspace"
    params: { body: { name: { type: string, required: true } } }
  - name: workspaces-get
    method: GET
    path: "/api/workspaces/:id"
    description: "Get workspace by id"
    params: { path: { id: { type: string, required: true } } }
  - name: workspaces-update
    method: PUT
    path: "/api/workspaces/:id"
    description: "Rename workspace"
    params:
      path: { id: { type: string, required: true } }
      body: { name: { type: string, required: true } }
  - name: workspaces-delete
    method: DELETE
    path: "/api/workspaces/:id"
    description: "Delete workspace"
    params: { path: { id: { type: string, required: true } } }

  # —— Persons ——
  - name: persons-list
    method: GET
    path: "/api/w/:wid/persons"
    description: "List persons in workspace"
    params:
      path: { wid: { type: string, required: true } }
      query: { tagIds: { type: string, description: "Comma-separated tag ids" } }
  - name: persons-get
    method: GET
    path: "/api/w/:wid/persons/:id"
    description: "Get one person"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: persons-create
    method: POST
    path: "/api/w/:wid/persons"
    description: "Add a person under a manager"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:             { type: string, required: true }
        managerId:        { type: string, required: true, description: "Use null only for root, but root is auto-created" }
        title:            { type: string }
        dottedManagerId:  { type: string }
        avatarUrl:        { type: string }
  - name: persons-update
    method: PUT
    path: "/api/w/:wid/persons/:id"
    description: "Update person fields"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        name:             { type: string }
        title:            { type: string }
        dottedManagerId:  { type: string }
        avatarUrl:        { type: string }
  - name: persons-move
    method: PUT
    path: "/api/w/:wid/persons/:id/move"
    description: "Move person under a new manager"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body: { managerId: { type: string, required: true } }
  - name: persons-delete
    method: DELETE
    path: "/api/w/:wid/persons/:id"
    description: "Delete person (must have no reports)"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: persons-documents
    method: GET
    path: "/api/w/:wid/persons/:id/documents"
    description: "Documents attached to this person"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }

  # —— Documents ——
  - name: documents-list
    method: GET
    path: "/api/w/:wid/documents"
    description: "List documents (filterable by tags)"
    params:
      path: { wid: { type: string, required: true } }
      query: { tagIds: { type: string, description: "Comma-separated tag ids" } }
  - name: documents-get
    method: GET
    path: "/api/w/:wid/documents/:id"
    description: "Get document with metadata"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: documents-create
    method: POST
    path: "/api/w/:wid/documents"
    description: "Create document"
    params:
      path: { wid: { type: string, required: true } }
      body:
        title:     { type: string, required: true }
        content:   { type: string }
        typeId:    { type: string }
        eventDate: { type: string, description: "ISO date YYYY-MM-DD" }
        personIds: { type: array, items: { type: string } }
  - name: documents-update
    method: PUT
    path: "/api/w/:wid/documents/:id"
    description: "Update document (auto-versions on content change)"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        title:     { type: string }
        content:   { type: string }
        typeId:    { type: string }
        eventDate: { type: string }
  - name: documents-delete
    method: DELETE
    path: "/api/w/:wid/documents/:id"
    description: "Delete document"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: documents-versions
    method: GET
    path: "/api/w/:wid/documents/:id/versions"
    description: "List immutable version history"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: documents-persons-list
    method: GET
    path: "/api/w/:wid/documents/:id/persons"
    description: "List people on a document"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: documents-persons-add
    method: POST
    path: "/api/w/:wid/documents/:id/persons"
    description: "Attach a person to a document"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        personId: { type: string, required: true }
        role:     { type: string }
  - name: documents-persons-remove
    method: DELETE
    path: "/api/w/:wid/documents/:id/persons/:personId"
    description: "Detach a person from a document"
    params:
      path:
        wid:      { type: string, required: true }
        id:       { type: string, required: true }
        personId: { type: string, required: true }

  # —— Fields (Custom Field Definitions + Values) ——
  - name: fields-list
    method: GET
    path: "/api/w/:wid/fields"
    description: "List custom field definitions"
    params: { path: { wid: { type: string, required: true } } }
  - name: fields-create
    method: POST
    path: "/api/w/:wid/fields"
    description: "Create custom field definition"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:         { type: string, required: true }
        fieldType:    { type: string, required: true, description: "text|number|date|select|boolean" }
        options:      { type: array, items: { type: string }, description: "Required when fieldType=select" }
        required:     { type: boolean }
        defaultValue: { type: string }
  - name: fields-update
    method: PUT
    path: "/api/w/:wid/fields/:id"
    description: "Update field definition"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        name:         { type: string }
        fieldType:    { type: string }
        options:      { type: array, items: { type: string } }
        required:     { type: boolean }
        defaultValue: { type: string }
        sortOrder:    { type: number }
  - name: fields-delete
    method: DELETE
    path: "/api/w/:wid/fields/:id"
    description: "Delete field definition (cascades to values)"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: fields-values-get
    method: GET
    path: "/api/w/:wid/fields/values/:personId"
    description: "Get all field values for a person"
    params: { path: { wid: { type: string, required: true }, personId: { type: string, required: true } } }
  - name: fields-values-set
    method: PUT
    path: "/api/w/:wid/fields/values/:personId/:fieldDefId"
    description: "Set a single field value for a person"
    params:
      path:
        wid:        { type: string, required: true }
        personId:   { type: string, required: true }
        fieldDefId: { type: string, required: true }
      body: { value: { type: string, required: true } }

  # —— Doc Types ——
  - name: doc-types-list
    method: GET
    path: "/api/w/:wid/doc-types"
    description: "List document types"
    params: { path: { wid: { type: string, required: true } } }
  - name: doc-types-create
    method: POST
    path: "/api/w/:wid/doc-types"
    description: "Create document type"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:  { type: string, required: true }
        color: { type: string }
  - name: doc-types-update
    method: PUT
    path: "/api/w/:wid/doc-types/:id"
    description: "Update document type"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        name:      { type: string }
        color:     { type: string }
        sortOrder: { type: number }
  - name: doc-types-delete
    method: DELETE
    path: "/api/w/:wid/doc-types/:id"
    description: "Delete document type (nullifies references)"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }

  # —— Tags ——
  - name: tags-list
    method: GET
    path: "/api/w/:wid/tags"
    description: "List tags (filterable by scope)"
    params:
      path: { wid: { type: string, required: true } }
      query:
        scope:         { type: string, description: "document|person" }
        includeCounts: { type: boolean }
  - name: tags-stats
    method: GET
    path: "/api/w/:wid/tags/stats"
    description: "Tag usage distribution"
    params:
      path: { wid: { type: string, required: true } }
      query: { scope: { type: string } }
  - name: tags-create
    method: POST
    path: "/api/w/:wid/tags"
    description: "Create tag"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:      { type: string, required: true }
        scope:     { type: string, required: true, description: "document|person" }
        color:     { type: string, description: "Hex #RRGGBB or null for neutral" }
        sortOrder: { type: number }
  - name: tags-update
    method: PUT
    path: "/api/w/:wid/tags/:id"
    description: "Update tag"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        name:      { type: string }
        color:     { type: string }
        sortOrder: { type: number }
  - name: tags-delete
    method: DELETE
    path: "/api/w/:wid/tags/:id"
    description: "Delete tag (cascades to assignments)"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: tags-documents-add
    method: PUT
    path: "/api/w/:wid/tags/:id/documents/:docId"
    description: "Assign tag to a document"
    params:
      path:
        wid:   { type: string, required: true }
        id:    { type: string, required: true }
        docId: { type: string, required: true }
  - name: tags-documents-remove
    method: DELETE
    path: "/api/w/:wid/tags/:id/documents/:docId"
    description: "Remove tag from a document"
    params:
      path:
        wid:   { type: string, required: true }
        id:    { type: string, required: true }
        docId: { type: string, required: true }
  - name: tags-persons-add
    method: PUT
    path: "/api/w/:wid/tags/:id/persons/:personId"
    description: "Assign tag to a person"
    params:
      path:
        wid:      { type: string, required: true }
        id:       { type: string, required: true }
        personId: { type: string, required: true }
  - name: tags-persons-remove
    method: DELETE
    path: "/api/w/:wid/tags/:id/persons/:personId"
    description: "Remove tag from a person"
    params:
      path:
        wid:      { type: string, required: true }
        id:       { type: string, required: true }
        personId: { type: string, required: true }
```

> 实施时再 `clip generate clip.yaml` 验证 schema 合法、文件能编译、命令能跑。

## 7. Cloudflare Access 部署

**改动**:Zero Trust → Access → Applications → bogo → Policies 加一条 **Bypass policy**:

| 字段 | 值 |
|------|---|
| Action | `Bypass` |
| Include → Selector | `Request Header` |
| Header name | `Authorization` |
| Operator | `starts with` |
| Value | `Bearer bogo_` |

效果:带此 header 的请求直达 worker;浏览器请求继续走 CF Access JWT。**`/api/auth/cli` 不能加入 bypass**——这个端点要求 CF Access 已识别用户,`c.get("userEmail")` 才有值。

**风险**:误配 bypass 会让 `/api/*` 暴露 → worker 中间件必须校验 `bogo_` 前缀 + DB 命中,不命中一律 401。D1 泄漏只暴露 hash,明文无法反推。

## 8. 用户上手流程(README/CLAUDE.md 中要写)

```bash
# 一次性配置
git clone https://github.com/nocoo/clip && (cd clip && bun install && bun link packages/cli)
git clone https://github.com/nocoo/bogo
cd bogo
clip generate clip.yaml -o .clip-output/bogo
cd .clip-output/bogo && bun install && bun link
# 之后随处可用
bogo login                       # 浏览器登录
bogo workspaces-list             # 自动注入 Authorization: Bearer …
bogo persons-create <wid> --name "Engineer" --manager-id <root-id>
```

撤销:v1 暂时手动改 D1:
```bash
cd packages/worker
bunx wrangler d1 execute bogo --remote --command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='bogo_xxxxxx'"
```

## 9. 原子化提交计划

按依赖顺序拆 **10 个** commit。每个独立可 review,pre-commit / pre-push 各自能过。

### Commit 1 — `feat(db): add api_tokens table`

- 新增 `packages/worker/migrations/0004_api_tokens.sql`(§4.1 CREATE TABLE + 2 INDEX)
- 本地验证:`cd packages/worker && bunx wrangler d1 migrations apply bogo --local`
- 不需新测试
- Gate:pre-commit

### Commit 2 — `feat(worker): add sha256Hex util`

- 新增 `packages/worker/src/utils/hash.ts`(§5.1)
- 新增 `packages/worker/src/utils/hash.test.ts` — 5 case:空串 / ASCII / 中文 / 长串 / 与 Node `crypto` 输出比对
- 验证:`bun test packages/worker/src/utils/`
- Gate:pre-commit

### Commit 3 — `feat(worker): add bearer token branch to access-auth`

- 改 `packages/worker/src/middleware/access-auth.ts`(§5.2 新分支)
- 改 `packages/worker/src/middleware/access-auth.test.ts` 加 5 case:
  - (a) 有效 bearer → 设 userEmail + next
  - (b) `revoked_at` 非空 → 401
  - (c) `expires_at` 已过 → 401
  - (d) 表中不存在 → 401
  - (e) 非 `bogo_` 前缀 Bearer → fallthrough 到 CF Access 分支(确认现有 case 仍通过)
- 依赖:Commit 1 + 2
- Gate:pre-commit

### Commit 4 — `feat(worker): add /api/auth/cli login endpoint`

- 新增 `packages/worker/src/routes/auth.ts`(§5.3)
- 新增 `packages/worker/src/routes/auth.test.ts`:
  - (a) localhost dev:302 含 api_key / state / email
  - (b) callback 非 loopback(外网) → 400
  - (c) callback pathname ≠ `/callback` → 400
  - (d) callback protocol https → 400
  - (e) callback 缺失 → 400
  - (f) DB 中 token_hash == sha256(redirect URL 中 api_key)
  - (g) `isLoopbackCallback` 工具函数 6 个 case 单独测
- 改 `packages/worker/src/index.ts` 挂载 `app.route("/api/auth", authRoutes)`
- 依赖:Commit 1 + 2
- Gate:pre-commit

### Commit 5 — `test(e2e): bearer auth lifecycle`

- 新增 `packages/worker/test/e2e/auth.test.ts`,参照 `test/e2e/api.test.ts`:
  1. 起 wrangler dev(localhost 模式跳过 CF Access)
  2. `GET /api/auth/cli?callback=http://127.0.0.1:9999/callback&state=abc`
  3. 解析 302 Location,提 `api_key`
  4. 用 `Authorization: Bearer <api_key>` 调 `/api/me`,断言 `{email: "dev@localhost"}`
  5. 直接 D1 `UPDATE api_tokens SET revoked_at = ...`,再调 `/api/me` 断言 401
- 验证:`bun turbo test:e2e --filter=@bogo/worker`
- Gate:pre-push

### Commit 6 — `feat(cli): add root clip.yaml`

- 新增仓库根 `clip.yaml`(§6 全文)
- 验证(手工):`cd ../clip && bun packages/cli/src/index.ts generate ../bogo/clip.yaml -o /tmp/bogo-cli-test`,应零错误产出可 `bun install` 的 CLI 项目
- 不入 worker bundle(确认 `wrangler.toml` 的 `[assets].directory` 是 `./static` 不会扫到根目录的 yaml)
- Gate:pre-commit

### Commit 7 — `test(cli-e2e): generated CLI smoke test`

- 新增 `tests/cli-e2e/smoke.test.ts`(Bun runner,仓库根新 `tests/cli-e2e/`):
  1. `beforeAll`:起 wrangler dev on 临时端口,临时 `CLIP_HOME=<tmpdir>`
  2. spawn `clip generate ../../clip.yaml -o <tmpdir>/bogo-cli` 并 `bun install`
  3. spawn 生成的 CLI:
     - `bogo live` → 200
     - `bogo me`(无 token) → 提示 "Run: bogo login"
     - 手工模拟 login:直接 GET `/api/auth/cli?callback=...` 拿 token 写入 `<tmpdir>/bogo/credentials.json`
     - `bogo me` → 含 email
     - `bogo workspaces-list` → 数组
     - `bogo workspaces-create --name "Test"` → 201
     - `bogo persons-list <wid>` → 至少 root
     - 撤销 token → `bogo me` → 非 0 退出 + 401
  4. `afterAll`:kill wrangler,清 tmpdir
- 加根 `package.json` script:`"test:cli-e2e": "cd tests/cli-e2e && bun test"`
- 不依赖远程 prod;纯本地全自动
- Gate:pre-push 加这一步;CI 同上

### Commit 8 — `docs(architecture): record bearer auth flow`

- 改 `docs/architecture/03-system-architecture.md` 的鉴权流程图加 Bearer 分支
- Endpoints 表加 `GET /api/auth/cli`
- 新增小节「CLI 鉴权」指向本 spec
- Gate:pre-commit

### Commit 9 — `docs: link bogo CLI from README`

- 改根 `README.md` 加「CLI」节:§8 安装/使用流程
- 改 `CLAUDE.md` 加「Cloudflare Access 配置」节描述 §7 的 bypass policy
- Gate:pre-commit

### Commit 10 — `chore(release): v0.4.0 — bogo CLI`

- 更新 `package.json` 与各 package 的 version 到 0.4.0
- 写 `CHANGELOG.md` 0.4.0 段落
- Gate:pre-commit;tag 与 release 在 PR 合并后手动

> **依赖关系**:1→2→{3,4}→5→{6,7}→8/9/10。Commit 7 是这个 spec 的"自证"环节,跑通才说明生成的 CLI 与 worker 端真正能配合。

> **Phase 2 独立 PR**:§5.4 token 管理端点 + UI Settings token 列表/撤销 + CHANGELOG.md 0.5.0。

## 10. 6DQ Quality Plan

| 维度 | 验收 | 触发 | 落在哪个 commit |
|------|------|------|----------------|
| **L1 Unit** | hash 5 case;access-auth 加 5 case;auth route 6 case + isLoopbackCallback 6 case。worker 包总覆盖率不下降 | pre-commit | 2/3/4 |
| **L2 worker E2E** | `test/e2e/auth.test.ts` 完整 login→bearer→撤销 | pre-push | 5 |
| **L2 CLI E2E(新增层)** | `tests/cli-e2e/smoke.test.ts` 从 `clip generate` 到完整 CRUD + 撤销 | pre-push | 7 |
| **L3 Playwright** | 不涉及 UI(phase 2 加 token 管理页时再补) | — | — |
| **G1 Static** | `bun turbo typecheck` + `bunx biome check` 0 错 | pre-commit | all |
| **G2 Security** | gitleaks 规则:`bogo_[A-Za-z0-9_-]{40,}` 不入仓;osv-scanner 0 高危 | pre-push | 5/7 |
| **G3 Coverage** | `bash scripts/check-coverage.sh` 阈值不降 | pre-push | all |

**手测 checklist**(PR 描述里勾):

- [ ] 本地 dev:`bun dev` 后 `curl 'http://localhost:8787/api/auth/cli?callback=http://127.0.0.1:9999/callback'` → 302 含 api_key
- [ ] D1 改 `revoked_at` 后再调 `/api/me` → 401
- [ ] 篡改 token 任意一字符 → 401
- [ ] `callback=https://evil.com/callback` → 400(open redirect 防护)
- [ ] `callback=http://127.0.0.1:9999/admin` → 400(path 校验)
- [ ] 无 callback query → 400
- [ ] 端到端:`bogo login` 弹浏览器、token 落 `~/.clip/bogo/credentials.json`、0600 权限
- [ ] 端到端:`bogo workspaces-create --name X` → `bogo workspaces-list` 能看到
- [ ] 端到端:`bogo persons-create <wid> --name … --manager-id <root>` 成功;`bogo persons-move <wid> <id> --manager-id null` 拒 409
- [ ] 端到端:`bogo documents-create <wid> --title "Test" --person-ids <id1,id2>` 成功;`bogo documents-versions <wid> <id>` 返回 v1
- [ ] CF Access service token JWT 仍能调 `/api/*`(与 bearer 并存)

## 11. Out of Scope

- OpenAPI 自动生成(让 worker 暴露 `/openapi.json`) —— 下一个 feature
- UI Settings token 管理页 —— phase 2
- 自定义 token label / 过期时间设置(v1 全部默认) —— phase 2
- Token scope 限权(仅某 workspace) —— phase 2
- Token rotation —— v1 撤销 + 重发即可
- Audit log(谁、何时、调了什么) —— v1 只有 `last_used_at`
- 把 bogo 作为 clip 仓库的 e2e fixture —— clip 有自己的 demo-app,无需互相塞

## 12. Open Questions(哥确认后开干)

1. **Token 默认是否过期?** 倾向"不过期"(自用 + agent 长期跑),保留 `expires_at` 字段
2. **`prefix` 长度 12(含 `bogo_`)还是 8?** 倾向 12,便于多 token 区分
3. **CLI e2e 测试是否进 pre-push?** 它依赖 `clip` 本地存在(`bun link`)。倾向:进 pre-push,但若 `command -v clip` 未命中就跳过并打 warning,避免锁死开发环境
4. **`bogo` 名字冲突?** `bun link` 后 `bogo` 会成为全局命令;若哥本机已有同名,需要在 clip.yaml 改 `alias`

## References

### 本仓库
- 路由表:[`packages/worker/src/index.ts`](../../packages/worker/src/index.ts)
- 鉴权中间件:[`packages/worker/src/middleware/access-auth.ts:23-65`](../../packages/worker/src/middleware/access-auth.ts)
- 各 route 处理器:[`packages/worker/src/routes/`](../../packages/worker/src/routes/)
- 共享 zod schema:[`packages/shared/src/schemas/`](../../packages/shared/src/schemas/)
- E2E 风格参考:[`packages/worker/test/e2e/api.test.ts`](../../packages/worker/test/e2e/api.test.ts)
- 系统架构:[`docs/architecture/03-system-architecture.md`](../architecture/03-system-architecture.md)

### clip v1.0.0
- Schema:`../clip/packages/cli/src/schema/validator.ts:80-104`
- 保留字校验:`../clip/packages/cli/src/schema/validator.ts:171-181`
- 入口 codegen(`<alias> login` 子命令):`../clip/packages/cli/src/codegen/templates.ts:58-82`
- login 命令 codegen:`../clip/packages/cli/src/codegen/templates.ts:299-365`
- config 注入 header:`../clip/packages/cli/src/codegen/templates.ts:140-202`
- 凭据存储:`../clip/packages/cli/src/auth/storage.ts:11-29`
- Server 端黄金参考:`../clip/packages/demo-app/src/index.ts:25-51`
- clip 项目宪法:`../clip/CLAUDE.md`(bogo 是已注册的真实用户)

### cli-base v0.2.4
- performLogin:`../cli-base/src/login.ts`(callback pathname 写死 `/callback` 在 :115)
