# SPEC: Bogo CLI

## 1. Objective

把 bogo 从浏览器 SPA 扩展成"**浏览器 + 命令行**"双形态。用户（哥本人 + agent 自动化脚本）在 Mac 上跑一条命令就能：

1. **登录** — `bogo login` 弹浏览器，复用 CF Access 已识别的身份,落 token 到 `~/.clip/bogo/credentials.json`(0600)
2. **完整 CRUD** — `bogo workspaces-list`、`bogo persons-create <wid> --name …`、`bogo documents-update <wid> <id> …` 等覆盖所有 `/api/*` 端点
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
bogo persons-list <wid>          # GET /api/w/:wid/persons (wid 是位置参数)
…
```

**不是** `clip auth login bogo`。**endpoint name 不能叫 `login` 或 `logout`**(`validator.ts:171-181` 校验保留字)。

### 2.3 worker 必须实现的 callback 协议(两阶段 consent)

`../cli-base/src/login.ts` 的 `performLogin`:

1. 起 loopback HTTP server,监听 `127.0.0.1:RANDOM`(仅环回)
2. 生成 `state` 随机 nonce(CSRF)
3. `openBrowser(<apiUrl> + <loginPath> + "?callback=http://127.0.0.1:RANDOM/callback&state=<nonce>")`
4. 等回调 `GET /callback?<tokenParam>=<token>&state=<nonce>&email=<email>&...`
5. 校验 `state` → `onSaveToken(token)` → 落 `credentials.json`

worker `/api/auth/cli` 必须接 `callback` 和 `state` query 参数。**为防 drive-by CSRF**(任何已登 CF Access 的用户若被诱导 `<img src=…/api/auth/cli?callback=attacker_loopback>`,worker 会把 token 302 给攻击者控制的 loopback 进程):端点拆**两阶段 consent**——

- **Stage 1** (无 `confirm` query):
  - 不写 DB,不签 token
  - 设 HttpOnly + SameSite=Strict cookie `bogo_cli_csrf=<64-hex>`,Path=`/api/auth/cli`,maxAge=600s
  - 返回 HTML consent 页:显示 callback URL + 用户 email,form `method=GET action=/api/auth/cli`,hidden 字段 `callback` / `state` / **`confirm=<同一 csrf token>`**
- **Stage 2** (`confirm=<csrf>` 命中 cookie):
  - 常数时间比对 cookie 与 query 中的 `confirm`,不等 → 403,无 DB 写
  - 通过后 mint token + 撤销同 owner 旧 token(§5.4)+ 302 `<callback>?<tokenParam>=…&state=…&email=…`
  - 同时把 cookie maxAge 设 0 一次性消费

为什么这套防 drive-by:cross-site `<img src>` / `<script src>` / `window.open` 都**无法读到 cookie**,也无法构造匹配的 `confirm`,所以最坏只触发 stage 1 返回 HTML 的 no-op。哥要正常 `bogo login`,浏览器从 CF Access SSO 回来后**必须手动点 Authorize 按钮**才能完成。

`callback pathname` performLogin 写死 `/callback`(`cli-base/src/login.ts:115`)。

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

### 3.0 clip v1.0.0 codegen 行为(命令面的硬约束)

写命令前必须遵守以下事实(`../clip/packages/cli/src/codegen/templates.ts`):

- **path params 永远是位置参数**(`templates.ts:20`):`/api/w/:wid/persons/:id` ⇒ `bogo persons-update <wid> <id>`,**不会**生成 `--wid` flag
- **query / body params 是 camelCase flag,原样从 yaml key 取名**(`templates.ts:27,36`):yaml 写 `personIds` ⇒ flag 是 `--personIds`,**不会**自动转 `--person-ids`(也没有 alias)
- **boolean flag 必须传字符串 `"true"` / `"false"`**(`templates.ts:223`):`bogo fields-create <wid> --required true`,**不能**裸 `--required`
- **array body 不被理解**(`templates.ts:243-249`):所有 body 字段除 number/boolean 外原样塞 `args.<name>`,即 string。所以 `--personIds "uuid-1"` 实际只送 1 个字符串。**真正需要数组的请求一律 worker 端额外暴露 query 形式的 CSV**(下文 §3.4)
- **null 不能从 CLI 传**:commander 把所有 flag 值视为 string,worker 端的 nullable 字段(`managerId: null`)无法用 `--managerId null` 表达;`bogo persons-move` 这种"提升为根"的请求 v1 在 CLI 不支持(worker 端仍然支持,UI 端用)
- **client 默认调 `process.env.CLIP_BASE_URL || schema.baseUrl`**(`templates.ts:100`):e2e 必须 `CLIP_BASE_URL=http://127.0.0.1:<port>` 覆盖
- **任何子命令都会先 `loadConfig()`**(`templates.ts:97-99`):`loadConfig` 读不到 `credentials.json` 时 `process.exit(1)`,所以**生成的 CLI 没有"无凭据可调的公开端点"**——`bogo live` 也要先登录

### 3.1 公开 + 身份

| 子命令 | HTTP | Path | 备注 |
|--------|------|------|------|
| `bogo live` | GET | `/api/live` | 路由本身在 worker 中间件公开(无 bearer/JWT 时仍 200);**但 CLI 调用照样先 `loadConfig()` + 注入 `Authorization: Bearer <token>`**,而 §5.3 的 Bearer 分支优先于 `/api/live` 公开短路,所以 CLI 用撤销的 token 调 live 会 401。要做无凭据健康检查请 `curl /api/live` |
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
| `bogo persons-list <wid> [--tagIds <a,b>]` | GET | `/api/w/:wid/persons` |
| `bogo persons-get <wid> <id>` | GET | `/api/w/:wid/persons/:id` |
| `bogo persons-create <wid> --name <…> --managerId <…> [--title --dottedManagerId --avatarUrl]` | POST | `/api/w/:wid/persons` |
| `bogo persons-update <wid> <id> [--name --title --dottedManagerId --avatarUrl]` | PUT | `/api/w/:wid/persons/:id` |
| `bogo persons-move <wid> <id> --managerId <uuid>` | PUT | `/api/w/:wid/persons/:id/move` |
| `bogo persons-delete <wid> <id>` | DELETE | `/api/w/:wid/persons/:id` |
| `bogo persons-documents <wid> <id>` | GET | `/api/w/:wid/persons/:id/documents` — **summary; no content** |

> `persons-move --managerId null`(提升为根)v1 不在 CLI 暴露 —— commander 把 `"null"` 当字符串传 worker,zod 会 400。哥要用就 `curl` 或 UI。

### 3.4 Documents — array 字段用 CSV query 解决

`documents-create.personIds` 是 array,但 commander 只能传 string。**worker 端额外接受 query `personIds=uuid-a,uuid-b` 形式**(实施 commit 4 同步加 query 解析逻辑,与 body 字段二选一),CLI 用 query 形式:

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo documents-list <wid> [--tagIds <a,b>]` | GET | `/api/w/:wid/documents` — **summary; no content** |
| `bogo documents-get <wid> <id>` | GET | `/api/w/:wid/documents/:id` (full content) |
| `bogo documents-create <wid> --title <…> [--content --typeId --eventDate] [--personIds <a,b>]` | POST | `/api/w/:wid/documents` |
| `bogo documents-update <wid> <id> [--title --content --typeId --eventDate]` | PUT | `/api/w/:wid/documents/:id` |
| `bogo documents-delete <wid> <id>` | DELETE | `/api/w/:wid/documents/:id` |
| `bogo documents-versions <wid> <id>` | GET | `/api/w/:wid/documents/:id/versions` — **summary; no content** |
| `bogo documents-version <wid> <id> <version>` | GET | `/api/w/:wid/documents/:id/versions/:version` (full content; for diff) |
| `bogo documents-persons-list <wid> <id>` | GET | `/api/w/:wid/documents/:id/persons` |
| `bogo documents-persons-add <wid> <id> --personId <…> [--role]` | POST | `/api/w/:wid/documents/:id/persons` |
| `bogo documents-persons-remove <wid> <id> <personId>` | DELETE | `/api/w/:wid/documents/:id/persons/:personId` |

> `personIds` 走 query 而不是 body,原因:clip codegen 把 body string 直接当字符串塞 JSON;而 query 在 worker 端做 split-CSV → string[],与 zod `z.array(z.string().uuid())` 对齐。clip.yaml 也要相应改:`personIds` 放在 `params.query`,worker 解析时 CSV → `personIds` body 字段。

### 3.5 Fields — boolean 用 `"true"/"false"` 字符串

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo fields-list <wid>` | GET | `/api/w/:wid/fields` |
| `bogo fields-create <wid> --name --fieldType [--options <a,b>] [--required true\|false] [--defaultValue]` | POST | `/api/w/:wid/fields` |
| `bogo fields-update <wid> <id> [--name --fieldType --options <a,b> --required true\|false --defaultValue --sortOrder]` | PUT | `/api/w/:wid/fields/:id` |
| `bogo fields-delete <wid> <id>` | DELETE | `/api/w/:wid/fields/:id` |
| `bogo fields-values-get <wid> <personId>` | GET | `/api/w/:wid/fields/values/:personId` |
| `bogo fields-values-set <wid> <personId> <fieldDefId> --value <…>` | PUT | `/api/w/:wid/fields/values/:personId/:fieldDefId` |

> 同上,`options` 走 query CSV;worker 端解析为 string[]。

### 3.6 Doc Types

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo doc-types-list <wid>` | GET | `/api/w/:wid/doc-types` |
| `bogo doc-types-create <wid> --name [--color]` | POST | `/api/w/:wid/doc-types` |
| `bogo doc-types-update <wid> <id> [--name --color --sortOrder]` | PUT | `/api/w/:wid/doc-types/:id` |
| `bogo doc-types-delete <wid> <id>` | DELETE | `/api/w/:wid/doc-types/:id` |

### 3.7 Tags

| 子命令 | HTTP | Path |
|--------|------|------|
| `bogo tags-list <wid> [--scope --includeCounts true\|false]` | GET | `/api/w/:wid/tags` |
| `bogo tags-stats <wid> --scope <document\|person>` | GET | `/api/w/:wid/tags/stats` |
| `bogo tags-create <wid> --name --scope [--color --sortOrder]` | POST | `/api/w/:wid/tags` |
| `bogo tags-update <wid> <id> [--name --color --sortOrder]` | PUT | `/api/w/:wid/tags/:id` |
| `bogo tags-delete <wid> <id>` | DELETE | `/api/w/:wid/tags/:id` |
| `bogo tags-documents-add <wid> <id> <docId>` | PUT | `/api/w/:wid/tags/:id/documents/:docId` |
| `bogo tags-documents-remove <wid> <id> <docId>` | DELETE | `/api/w/:wid/tags/:id/documents/:docId` |
| `bogo tags-persons-add <wid> <id> <personId>` | PUT | `/api/w/:wid/tags/:id/persons/:personId` |
| `bogo tags-persons-remove <wid> <id> <personId>` | DELETE | `/api/w/:wid/tags/:id/persons/:personId` |

**总计:约 45 个子命令 + 1 个内置 `login`**,clip 自动从 §6 的 `clip.yaml` 生成。

### 3.8 命令面尚未解决的能力缺口(列入 §11 Out of Scope)

- `null` 无法从 CLI 传:`persons-move --managerId null`、`documents-update --typeId null` 等"显式清空"操作
- 完整文档 body(长 Markdown 内容)经 `--content "..."` 在 shell 里转义体验差;后续可加 worker 端 `application/x-www-form-urlencoded` 或 stdin 通道
- 这些缺口都不阻塞 v1:UI 仍然完整支持,CLI 覆盖 95% 自动化场景

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

### 5.1 `packages/worker/src/types.ts` — 扩展 Variables

加 `authMethod`,供路由判定"调用者用哪种方式登录"(`/api/auth/cli` 必须拒绝 bearer 来源):

```ts
export type Variables = {
  accessAuthenticated?: boolean;
  userEmail?: string | null;
  authMethod?: "bearer" | "cf-access-jwt" | "localhost";  // 新增
};
```

### 5.2 `packages/worker/src/utils/hash.ts`(新文件)

```ts
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
```

### 5.3 `packages/worker/src/middleware/access-auth.ts` — 新增 Bearer 分支

现状(`access-auth.ts:23-65`)只有 localhost / CF Access JWT 两个分支。新增 Bearer 分支,**必须在 localhost shortcut 之前**——否则 wrangler dev 上撤销过的 token 还会被 `dev@localhost` 兜底放行,e2e 永远证伪不了"撤销 → 401"。同时**每个分支都设置 `c.set("authMethod", ...)`**(`"bearer" | "cf-access-jwt" | "localhost"`),供 `/api/auth/cli` 拒绝 bearer 自助换 token:

```ts
export async function accessAuth(c, next) {
  // === 新增:Bearer 分支必须最先匹配,避免被 localhost shortcut 旁路 ===
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
    c.set("authMethod", "bearer");
    c.set("accessAuthenticated", true);
    return next();
  }
  // === /新增 ===

  const host = c.req.header("host") || "";
  if (isLocalhost(host)) {
    c.set("userEmail", "dev@localhost");
    c.set("authMethod", "localhost");
    return next();
  }
  if (c.req.path === "/api/live") return next();

  // …已有 CF Access JWT 路径:成功时 c.set("authMethod", "cf-access-jwt")…
}
```

注意:非 `bogo_` 前缀的 Bearer header(如 CF Access service token JWT)会跳过这个分支,落到 CF Access 路径正常处理。

### 5.4 `packages/worker/src/routes/auth.ts`(实际实现摘要)

`/api/auth/cli` 同时承担三个职责,按短路顺序:

1. **拒 bearer 自助换 token**:`authMethod === "bearer"` → 403,无 DB 写。leak 的 token 不能延展自己的生命周期。
2. **校验 callback**:`isLoopbackCallback(callback)` 过滤非 loopback / 非 http / 非 `/callback` / 含 userinfo,失败 → 400。
3. **两阶段 consent** (anti-CSRF,见 §2.3):
   - 无 `confirm` query → 设 `Set-Cookie: bogo_cli_csrf=<64-hex>; Path=/api/auth/cli; HttpOnly; SameSite=Strict; Max-Age=600`,返回 HTML consent 页(form `method=GET action=/api/auth/cli`,hidden `confirm=<同 csrf>`)。无 DB 写。
   - 有 `confirm` → 常数时间比对 cookie,失败 → 403。通过 → atomic batch 撤销同 owner 旧 cli-login + INSERT 新 row,302 到 `<callback>?api_key=<plain>&state=<state>&email=<email>`,并置 cookie maxAge=0 单次消费。

token 生成: `bogo_<base64url(32 字节)>`,`crypto.getRandomValues`。`prefix = plain.slice(0, 12)`,`hash = sha256Hex(plain)`,**plaintext 不入库**。

D1 操作走 `c.env.DB.batch()`:UPDATE 先于 INSERT,二者原子,杜绝"发新 token 失败但旧 token 已撤销"。

完整代码以 `packages/worker/src/routes/auth.ts` 为准。

`packages/worker/src/index.ts` 已挂载:`app.route("/api/auth", authRoutes)`。

### 5.5 Phase 2(独立 PR,不在本 spec 覆盖)

```
GET    /api/auth/tokens          列出(不含明文)
POST   /api/auth/tokens          手动颁发,body: { label, expires_at? }
DELETE /api/auth/tokens/:id      撤销
```

强制走 CF Access JWT(用户必须浏览器登录),不允许 bearer token 管理自己。v1 撤销靠手动 D1 `UPDATE api_tokens SET revoked_at = …`。

## 6. 仓库根 `clip.yaml`(完整)

> **要点**:clip v1.0.0 把 query/body params 都生成为 camelCase flag,且 array/null 不支持。所以
>
> - **endpoint name 用 kebab-case**(`workspaces-list`),**字段名用 camelCase**(`personIds`),与 worker zod schema 直接对齐
> - **任何 array 字段**(`personIds`, `options`)放 `params.query`,worker 端 query 解析 CSV → `string[]`,并把对应的 body 写入交给 zod
> - **boolean 字段**声明 `type: boolean`,但用户必须传 `--required true` / `--required false`(clip 把 `"true"` 字符串当 true)
> - **`/api/auth/cli` 端点不在 clip.yaml 中**——它由 clip codegen 通过 `auth.type: browser-login` 自动织入 `bogo login` 内置命令,业务层不重复声明

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
  - { name: workspaces-list, method: GET, path: /api/workspaces, description: "List own workspaces" }
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
    description: "Add a person under a manager (root cannot be created via CLI; auto-created with workspace)"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:            { type: string, required: true }
        managerId:       { type: string, required: true, description: "UUID of parent manager" }
        title:           { type: string }
        dottedManagerId: { type: string }
        avatarUrl:       { type: string }
  - name: persons-update
    method: PUT
    path: "/api/w/:wid/persons/:id"
    description: "Update person fields"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      body:
        name:            { type: string }
        title:           { type: string }
        dottedManagerId: { type: string }
        avatarUrl:       { type: string }
  - name: persons-move
    method: PUT
    path: "/api/w/:wid/persons/:id/move"
    description: "Move person under a new manager (CLI cannot set managerId=null; use UI for promote-to-root)"
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
    description: "Get document"
    params: { path: { wid: { type: string, required: true }, id: { type: string, required: true } } }
  - name: documents-create
    method: POST
    path: "/api/w/:wid/documents"
    description: "Create document; pass personIds=uuid-a,uuid-b in query to attach"
    params:
      path: { wid: { type: string, required: true } }
      query: { personIds: { type: string, description: "Comma-separated person UUIDs" } }
      body:
        title:     { type: string, required: true }
        content:   { type: string }
        typeId:    { type: string }
        eventDate: { type: string, description: "ISO date YYYY-MM-DD" }
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
    description: "Create custom field definition; pass options=a,b in query when fieldType=select"
    params:
      path: { wid: { type: string, required: true } }
      query: { options: { type: string, description: "Comma-separated select options" } }
      body:
        name:         { type: string, required: true }
        fieldType:    { type: string, required: true, description: "text|number|date|select|boolean" }
        required:     { type: boolean, description: "Pass --required true / --required false" }
        defaultValue: { type: string }
  - name: fields-update
    method: PUT
    path: "/api/w/:wid/fields/:id"
    description: "Update field definition; pass options=a,b in query to replace select options"
    params:
      path: { wid: { type: string, required: true }, id: { type: string, required: true } }
      query: { options: { type: string, description: "Comma-separated select options" } }
      body:
        name:         { type: string }
        fieldType:    { type: string }
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
        includeCounts: { type: boolean, description: "Pass --includeCounts true to include counts" }
  - name: tags-stats
    method: GET
    path: "/api/w/:wid/tags/stats"
    description: "Tag usage distribution (scope required)"
    params:
      path: { wid: { type: string, required: true } }
      query: { scope: { type: string, required: true, description: "document|person" } }
  - name: tags-create
    method: POST
    path: "/api/w/:wid/tags"
    description: "Create tag"
    params:
      path: { wid: { type: string, required: true } }
      body:
        name:      { type: string, required: true }
        scope:     { type: string, required: true, description: "document|person" }
        color:     { type: string, description: "Hex #RRGGBB" }
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

### 6.1 Worker 端 query → body 桥接(配合 §3.4 的 array 折中)

`documents-create.personIds`、`fields-create.options`、`fields-update.options` 在 yaml 里挂 `params.query`,但 worker 路由必须**把 query CSV 解析回 body 字段**,使既有 zod schema 不变:

```ts
// packages/worker/src/routes/documents.ts (新增,Commit 4 一并实施)
documentRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const personIdsCsv = c.req.query("personIds");
  if (personIdsCsv && body.personIds === undefined) {
    body.personIds = personIdsCsv.split(",").filter(Boolean);
  }
  const parsed = createDocumentSchema.safeParse(body);
  // …已有逻辑不变…
});
```

`fields.ts` 同样在 POST/PUT 入口处理 `options` CSV → `options: string[]`。

> 这是为 CLI 体验加的"小妥协",对 UI / API 调用方完全向后兼容(它们继续传 `body.personIds: string[]`)。> 实施时再 `clip generate clip.yaml` 验证 schema 合法、文件能编译、命令能跑。

## 7. Cloudflare 部署 — 域名分离

> **历史注 (2026-06-23)**:本节最初描述 CF Access "Bypass" policy 走 `Request Header` selector 让 bearer 请求绕过 Access。**Cloudflare 在 2026 年从 Zero Trust UI 移除了 Request Header selector**,只剩 identity-based selector(Email/Service Token/Common Name/Login Methods 等)。Header bypass 不再可用,改用域名分离。

**两个 hostname 同一个 worker**:

| Hostname | CF Access | 用途 |
|---------|----------|-----|
| `bogo.hexly.ai` | ✅ 保护 | 浏览器 SPA + `/api/auth/cli` consent 页(需 CF Access JWT 识别用户身份才能签 token) |
| `api.bogo.hexly.ai` | ❌ 不挂 | CLI 业务请求(`bogo me` / `bogo workspaces-list` 等),worker 内 `access-auth.ts` 校验 `Authorization: Bearer bogo_*` |

clip.yaml 把 `loginUrl` 单独写,只有 login 走 CF Access 域,业务全走未保护域:

```yaml
auth:
  type: browser-login
  loginUrl: "https://bogo.hexly.ai/api/auth/cli"
  tokenParam: api_key
  headerName: Authorization
  headerPrefix: Bearer
baseUrl: "https://api.bogo.hexly.ai"
```

### wrangler.toml

```toml
[[env.production.routes]]
pattern = "bogo.hexly.ai"
custom_domain = true

[[env.production.routes]]
pattern = "api.bogo.hexly.ai"
custom_domain = true
```

`wrangler deploy --env production` 会在 Cloudflare 上自动为新域签 cert + 建 DNS(custom_domain mode)。

### CF Access 控制台

`bogo.hexly.ai` 已有的 Access Application 不变(Email allowlist 等 Allow policy 保留)。**不要**为 `api.bogo.hexly.ai` 创建新 Application —— "Access 不挂 = 直达 worker"。

### Worker 端责任

`api.bogo.hexly.ai` 全公网可达,所有鉴权由 `packages/worker/src/middleware/access-auth.ts` 完成(§5.3):

- `Authorization: Bearer bogo_*` 前缀必匹配 → DB hash 查 row + 校验 `revoked_at`/`expires_at`,不命中 401
- 非 bearer 请求(包括健康检查) → `/api/live` 公开,其余按 CF Access JWT 校验(理论上 `api.*` 不会带 CF Access JWT,所以业务 endpoint 直接 401)

### 风险与缓解

- **API 域全公网可达**:worker 中间件必须严丝合缝,不能有"忘了挂中间件"的端点。`scripts/check-route-coverage.ts` 现有 gate 已覆盖。
- **DDoS**:CF free tier L7 rate-limit 默认开;可加 WAF custom rule(如 `cf.ip.country eq "XX"` 拦低质量国家或 `http.request.uri.path matches "/api/.*" and rate(1m) > 60` 等)
- **bearer 自助换新 token**:`/api/auth/cli` 由 `authMethod === "cf-access-jwt" | "localhost"` 守护(§5.4),且这个端点只在 `bogo.hexly.ai` 域上有意义(`api.*` 也接,但 caller 没 CF Access JWT → 403)。

## 8. 用户上手流程(README/CLAUDE.md 中要写)

> **状态**:仓库根 `clip.yaml` 已与本 spec 同步(browser-login + kebab endpoint + query CSV + headerName/Prefix)。**但 `clip generate` 之后 `bogo login` 真正能跑通,仍依赖 Commit 1–5 把 worker 端的 `api_tokens` 表、`/api/auth/cli` 端点、中间件 Bearer 分支落地**。在 Commit 5 之前,下方命令到 `bogo login` 这一步会因后端缺端点而 404。

```bash
# 一次性配置
git clone https://github.com/nocoo/clip && (cd clip && bun install && bun link packages/cli)
git clone https://github.com/nocoo/bogo
cd bogo
clip generate clip.yaml --output .clip-output/bogo
cd .clip-output/bogo && bun install && bun link
# 之后随处可用
bogo login                       # 浏览器登录,token 落 ~/.clip/bogo/credentials.json
bogo workspaces-list             # 自动注入 Authorization: Bearer …
bogo persons-create <wid> --name "Engineer" --managerId <root-id>
bogo documents-create <wid> --title "Q3 plan" --content "..." --personIds <uuid-a>,<uuid-b>
```

> `clip generate` 用 **`--output`**(无短参数 `-o`,见 `../clip/packages/cli/src/index.ts:17-18`)。

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

- 改 `packages/worker/src/types.ts` 加 `authMethod` 字段(§5.1)
- 改 `packages/worker/src/middleware/access-auth.ts`(§5.3 新分支,**放在 localhost shortcut 之前**;每个分支都 `c.set("authMethod", …)`)
- 改 `packages/worker/src/middleware/access-auth.test.ts` 加 7 case:
  - (a) 有效 bearer → 设 userEmail / authMethod="bearer" / next
  - (b) `revoked_at` 非空 → 401
  - (c) `expires_at` 已过 → 401
  - (d) 表中不存在 → 401
  - (e) 非 `bogo_` 前缀 Bearer(模拟 CF Access service token) → fallthrough 到 CF Access 分支
  - (f) **本地 host + 有效 bearer → bearer 分支命中(不能被 localhost 兜底放行)**——关键 case,e2e 撤销验证依赖此行为
  - (g) 本地 host + 无 Authorization header → localhost 分支命中,`authMethod="localhost"`
- 依赖:Commit 1 + 2
- Gate:pre-commit

### Commit 4 — `feat(worker): add /api/auth/cli + query→body bridge`

> **历史注**:Commit 4 最初按"无 consent 直接 302"实现,后续 review 加 task 12 (one-active-per-identity) + task 13 (两阶段 consent) + task 17 (anti-clickjacking headers) 把端点演进成 §2.3 / §5.4 描述的形态。下面是**最终落地形态**,与 main 上 `routes/auth.ts` 一致。

- 新增 `packages/worker/src/routes/auth.ts`(§5.4),`/api/auth/cli` 强制 `authMethod === "cf-access-jwt" | "localhost"`(防 bearer 自助换 token);两阶段 consent 流(§2.3)
- 改 `packages/worker/src/routes/documents.ts` POST `/`:在 zod 校验之前,若 query 有 `personIds` 而 body 没有,split CSV 注入 body(§6.1)
- 改 `packages/worker/src/routes/fields.ts` POST `/` 与 PUT `/:id`:同样处理 `options` query CSV
- 新增 `packages/worker/src/routes/auth.test.ts`:
  - (a) **Stage 1**: 无 confirm → 200 HTML consent + Set-Cookie `bogo_cli_csrf` (HttpOnly, SameSite=Strict, Path=/api/auth/cli) + 三条 CSP `frame-ancestors 'none'` / `base-uri 'none'` / `form-action 'self'` + `X-Frame-Options: DENY`(task 17)
  - (a2) **Stage 2**: confirm 匹配 cookie → 302 含 api_key / state / email
  - (a3) Stage 2 confirm 不匹配 cookie → 403,**无 INSERT**
  - (a4) Stage 2 有 confirm 无 cookie → 403,**无 INSERT**(drive-by 模拟)
  - (b) **`authMethod === "bearer"` 的请求 → 403**(防换 token),**无 INSERT**
  - (c) callback 非 loopback(外网) → 400
  - (d) callback pathname ≠ `/callback` → 400
  - (e) callback protocol https → 400
  - (f) callback 缺失 → 400
  - (g) Stage 2 走完后,batch INSERT 的 bind 参数中 token_hash == sha256(redirect URL 中 api_key),且所有 bind 参数均不含明文(task 12 + 13)
  - (h) Stage 2 走完后,prepare 顺序: UPDATE(撤销同 owner 旧 cli-login) 在 INSERT 之前,且二者走单一 `DB.batch()`(task 12)
  - 加上 `isLoopbackCallback` 工具函数 9 个 case(标准 + userinfo 拒绝 + IPv4 别名接受)
- 改 `documents.test.ts` / `fields.test.ts` 加 query→body 桥接的 3 个 case(query 有 / body 有 / 二者都有 → 以 body 为准)
- 改 `packages/worker/src/index.ts` 挂载 `app.route("/api/auth", authRoutes)`
- 依赖:Commit 1 + 2 + 3
- Gate:pre-commit

### Commit 5 — `test(e2e): bearer auth lifecycle`

> **D1 准备 = `--persist-to .wrangler/e2e` 全程一致**(参 `packages/worker/test/e2e/global-setup.ts:57-66`):先 `wrangler d1 migrations apply bogo --local --persist-to .wrangler/e2e`,再 `wrangler dev --persist-to .wrangler/e2e`。所有 D1 操作(撤销 token 的 `UPDATE`)也必须带相同 `--persist-to`,否则会打到默认本地库,断言失效。

- 新增 `packages/worker/test/e2e/auth.test.ts`,参照 `test/e2e/api.test.ts`:
  1. 起 wrangler dev(localhost 模式) on PORT 17036,持久化到 `.wrangler/e2e`(global-setup 已就位)
  2. `GET /api/auth/cli?callback=http://127.0.0.1:9999/callback&state=abc`
  3. 解析 302 Location,提 `api_key`
  4. 用 `Authorization: Bearer <api_key>` 调 `/api/me`,断言 `{email: "dev@localhost"}`(走 bearer 分支,因为 §5.3 bearer 优先于 localhost)
  5. **撤销**:`wrangler d1 execute --command` 不支持 `?` 参数绑定,只能字符串拼接;`prefix` 字符集受控(`bogo_` + base64url) 直接拼安全:
     ```ts
     const prefix = plain.slice(0, 12);  // e.g. "bogo_a3F2x9-"
     execSync(
       `npx wrangler d1 execute bogo --local --persist-to .wrangler/e2e ` +
       `--command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='${prefix}'"`,
       { cwd: WORKER_ROOT }
     );
     ```
     再用同一 bearer 调 `/api/me` 应 401
  6. 不带 Authorization 调 `/api/me`(本地 host) → 走 localhost 分支返回 `dev@localhost`(确认 localhost 后备未被破坏)
  7. 带 bearer 调 `/api/auth/cli` 应 403(防自助换 token)
- 验证:`bun turbo test:e2e --filter=@bogo/worker`
- Gate:pre-push

### Commit 6 — `chore(cli): validate root clip.yaml matches generated CLI`

> 根 `clip.yaml` 已经在前置改动里写成 §6 蓝图,Commit 6 只是"加 CI 守护 + 文档引用"。

- 不动 yaml 内容(已就位)
- 验证(手工,写进 PR 描述):`cd ../clip && bun packages/cli/src/index.ts generate ../bogo/clip.yaml --output /tmp/bogo-cli-test`,应零错误产出可 `bun install` 的 CLI 项目;`bogo --help` 能列出 §3 表里的所有子命令
- 加 CI step(或 pre-push hook)跑 `cd /tmp && rm -rf bogo-clip-validate && clip generate $REPO_ROOT/clip.yaml --output bogo-clip-validate`,失败即 yaml 损坏
- 不入 worker bundle(确认 `wrangler.toml` 的 `[assets].directory` 是 `./static` 不会扫到根目录的 yaml)
- Gate:pre-commit(validate 步骤可作为 CI-only 任务)

### Commit 7 — `test(cli-e2e): generated CLI smoke test (login + CRUD + revoke)`

> **关键事实**(决定 e2e 怎么写,违反就是"通过却失效"):
>
> - **`_login.ts` 把 `apiUrl` / `loginPath` / `tokenParam` 全部硬编码进生成的文件**(`../clip/packages/cli/src/codegen/templates.ts:306-332`)。`CLIP_BASE_URL` 只覆盖**普通业务请求**的 baseUrl(`templates.ts:100`),**不影响 `bogo login`**。要让 `bogo login` 打本地 wrangler,必须**生成时就给一份临时 schema**,把 `baseUrl` 改成 `http://127.0.0.1:<PORT>`,然后从这份 schema generate
> - **e2e 必须把 login URL 从 cli-base 里逼出来才能拿到**。`cli-base/src/login.ts:225-231` 的逻辑是先 `openBrowser(loginUrl)`,**只在 `openBrowser` 抛错时** `log("Could not open browser. Open this URL manually:\n  <url>")`。`_login.ts` 直接 import `@nocoo/base-cli.openBrowser`,而该函数(`cli-base/src/browser.ts:32-47`)直接 `exec("open <url>")`,**不读 `BROWSER` 环境变量**。所以要拿到 URL,得**把系统 `open` 替换成会失败的 fake**——在 e2e tmpdir 写一个 `fake-open` 脚本(`#!/usr/bin/env bash\nexit 1`),`chmod +x`,然后 spawn `bogo login` 时 `env.PATH=<tmpdir>:$PATH`。fake 失败 → cli-base fallback log → 主进程从 stdout 解析 URL → `fetch(loginUrl)` 完成 loopback
> - **D1 准备 = 生成 schema 同一目录的 `--persist-to`**(同 Commit 5),否则撤销 SQL 打不到 wrangler dev 看到的库
> - **生成 CLI 直接打印整个 worker 响应,包括 `{data: …}` 包装层**(`templates.ts:261`:`console.log(JSON.stringify(response, null, 2))`)。所有断言要走 `JSON.parse(stdout).data.<field>`,不能直接 `.id`
>
> 这四点全部落实,才能真的覆盖 §1 承诺的"e2e 包含 `bogo login`"且断言可靠。

新增 `tests/cli-e2e/smoke.test.ts`(Bun runner,仓库根新 `tests/cli-e2e/`):

```
beforeAll:
  1. 分配端口 <PORT> (e.g. 27036,与 worker e2e 17036 错开)
  2. 临时 dir: TMP=$(mktemp -d -t bogo-cli-e2e); CLIP_HOME=<TMP>/clip-home
  3. 准备隔离 D1 持久化:PERSIST=<TMP>/wrangler;
     execSync("npx wrangler d1 migrations apply bogo --local --persist-to <PERSIST>",
              { cwd: packages/worker })
  4. spawn 临时 wrangler dev:
     spawn("npx", ["wrangler","dev","--port",PORT,"--local","--persist-to",PERSIST],
           { cwd: packages/worker, env: {...process.env, CF_ACCESS_TEAM_DOMAIN/AUD = dummy} })
     await waitForServer(`http://127.0.0.1:${PORT}/api/live`)
  5. 写 fake browser 脚本(故意 exit 1,触发 cli-base fallback log):
     const FAKE_BIN = `${TMP}/fake-bin`;
     mkdirSync(FAKE_BIN);
     writeFileSync(`${FAKE_BIN}/open`, "#!/usr/bin/env bash\nexit 1\n");
     writeFileSync(`${FAKE_BIN}/xdg-open`, "#!/usr/bin/env bash\nexit 1\n");
     chmodSync(`${FAKE_BIN}/open`, 0o755);
     chmodSync(`${FAKE_BIN}/xdg-open`, 0o755);
     // 之后所有 spawn 都用 env.PATH = `${FAKE_BIN}:${process.env.PATH}`
  6. 生成测试 schema(关键步骤——绕开 _login.ts 硬编码 baseUrl):
     const yaml = readFileSync(REPO_ROOT/clip.yaml, "utf-8").replace(
       /baseUrl:.*$/m,
       `baseUrl: "http://127.0.0.1:${PORT}"`);
     writeFileSync(`${TMP}/clip.yaml`, yaml);
  7. 跑 clip generate:
     execSync(`clip generate ${TMP}/clip.yaml --output ${TMP}/bogo-cli`);
     execSync("bun install", { cwd: `${TMP}/bogo-cli` });

helper:
  const SUB_ENV = { ...process.env, CLIP_HOME, PATH: `${FAKE_BIN}:${process.env.PATH}` };
  const run = (args: string[]) => {
    const r = spawnSync("bun", ["src/index.ts", ...args],
                        { cwd: `${TMP}/bogo-cli`, env: SUB_ENV, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`${args.join(" ")} failed:\n${r.stderr}`);
    return JSON.parse(r.stdout).data;   // 注意:解 .data 包装
  };

测试主体:
  test("login → credentials.json", async () => {
    // bogo login 会 print "🔐 Opening browser...",随后 openBrowser 因 fake 失败,
    // cli-base 打印 "Could not open browser. Open this URL manually:\n  <URL>"
    const cli = spawn("bun", ["src/index.ts","login"],
                      { cwd: `${TMP}/bogo-cli`, env: SUB_ENV });
    const loginUrl = await readLineMatching(cli.stdout, /https?:\/\/127\.0\.0\.1:\d+\/api\/auth\/cli\?\S+/);
    // fetch 跟随 302,完成 loopback 回调
    await fetch(loginUrl, { redirect: "follow" });
    // 等 cli 进程退出(打印 "✅ Logged in")
    await waitForExit(cli);
    expect(cli.exitCode).toBe(0);
    const creds = JSON.parse(readFileSync(`${CLIP_HOME}/bogo/credentials.json`, "utf-8"));
    expect(creds).toMatchObject({
      type: "browser-login",
      token: expect.stringMatching(/^bogo_/),
      email: "dev@localhost",
    });
    expect(statSync(`${CLIP_HOME}/bogo/credentials.json`).mode & 0o777).toBe(0o600);
  });

  test("CRUD chain", () => {
    const me = run(["me"]);
    expect(me.email).toBe("dev@localhost");

    expect(run(["workspaces-list"])).toEqual([]);
    const ws = run(["workspaces-create", "--name", "Test"]);
    const wid = ws.id;

    const persons = run(["persons-list", wid]);
    const root = persons.find((p: any) => p.isRoot);
    expect(root).toBeTruthy();

    const eng = run(["persons-create", wid, "--name", "Eng", "--managerId", root.id]);
    expect(eng.name).toBe("Eng");

    const doc = run(["documents-create", wid, "--title", "Doc", "--personIds", root.id]);
    const docId = doc.id;

    const versions = run(["documents-versions", wid, docId]);
    expect(versions[0].version).toBe(1);

    const tag = run(["tags-create", wid, "--name", "P0", "--scope", "document"]);
    run(["tags-documents-add", wid, tag.id, docId]);

    run(["workspaces-delete", wid]);
  });

  test("revoke → 401", () => {
    const creds = JSON.parse(readFileSync(`${CLIP_HOME}/bogo/credentials.json`, "utf-8"));
    const prefix = creds.token.slice(0, 12);   // 字符集受控:bogo_ + base64url
    execSync(
      `npx wrangler d1 execute bogo --local --persist-to ${PERSIST} ` +
      `--command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='${prefix}'"`,
      { cwd: WORKER_ROOT }
    );
    const r = spawnSync("bun", ["src/index.ts","me"],
                        { cwd: `${TMP}/bogo-cli`, env: SUB_ENV, encoding: "utf-8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/HTTP 401/);
  });

afterAll:
  - kill wrangler proc;rm -rf <TMP>
```

**实现细节**:
- 端口分配:`getPort()` 或固定 `27036`(与 worker e2e 的 17036 错开)
- `readLineMatching` 用 readline 包 stdout 直至匹配并 return 第一个捕获组之外的整行 URL;5s 超时,超时则 dump stdout 给报错信息
- 测试 schema 替换用正则 `/baseUrl:.*$/m` 比硬字符串替换稳
- 不**`bun link`** 全局,避免污染开发环境;全程 `bun src/index.ts <cmd>` 调用
- **不**测 `bogo live`(生成 CLI 任何子命令都先 `loadConfig()`,无法做"无凭据健康检查",见 §3.1)
- **所有 spawn 必须** `env.PATH = <FAKE_BIN>:...`(login 用到 fake open;其他子命令不调 open 但保持一致便于 review)

加根 `package.json` script:`"test:cli-e2e": "cd tests/cli-e2e && bun test"`

加 `.husky/pre-push` 一段(语义:CI 严格、本地可跳过):
```bash
if [ -n "$BOGO_REQUIRE_CLI_E2E" ] || [ -z "$BOGO_SKIP_CLI_E2E" ]; then
  bun run test:cli-e2e
else
  echo "[pre-push] BOGO_SKIP_CLI_E2E set — skipping CLI e2e"
fi
```
CI workflow 显式 `export BOGO_REQUIRE_CLI_E2E=1`,让"跳过"开关在 CI 失效。

依赖:`clip` 在 PATH。**`clip` 缺失不能 hard fail**(开发机可能没装),但 `beforeAll` 里调 `test.skip(...)` 此时测试已经注册,跳不掉。模块顶层做条件分发:

```ts
import { describe, test, beforeAll, afterAll, expect } from "bun:test";

const hasClip = (() => {
  try { execSync("command -v clip", { stdio: "ignore" }); return true; }
  catch { return false; }
})();

// CI must hard-fail when clip is missing — silent skip would defeat
// BOGO_REQUIRE_CLI_E2E=1 (see §9 Commit 7 pre-push gate).
if (!hasClip && process.env.BOGO_REQUIRE_CLI_E2E) {
  throw new Error(
    "BOGO_REQUIRE_CLI_E2E=1 but `clip` is not on PATH — install clip or unset the flag.",
  );
}

const maybeDescribe = hasClip ? describe : describe.skip;

maybeDescribe("bogo CLI e2e (login + CRUD + revoke)", () => {
  beforeAll(/* …spawn wrangler, generate CLI… */);
  afterAll(/* …kill wrangler, rm -rf tmp… */);

  test("login → credentials.json", async () => { /* … */ });
  test("CRUD chain", () => { /* … */ });
  test("revoke → 401", () => { /* … */ });
});
```

`hasClip=false` 且 `BOGO_REQUIRE_CLI_E2E` 未设 → 整个 describe 块被 Bun runner 标记为 skipped,**不会进 `beforeAll`**(开发机友好)。`BOGO_REQUIRE_CLI_E2E=1` 时若 clip 仍缺失,模块顶层 throw 让 runner 直接报错 —— 这才与 §9 Commit 7 pre-push 段的"CI 强跑"语义一致。CI workflow 负责在跑 e2e 前 `bun link` clip,确保命中。

Gate:pre-push(条件性)

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

- [ ] 本地 dev:`bun dev` 后 `curl -i 'http://localhost:8787/api/auth/cli?callback=http://127.0.0.1:9999/callback'` → **200 HTML consent 页 + Set-Cookie: bogo_cli_csrf=…; HttpOnly; SameSite=Strict**(不再是 302)
- [ ] consent 页表单 hidden `confirm=<csrf>` 与 Set-Cookie 的 token 一致;手动 follow form → 302 含 api_key
- [ ] **drive-by 模拟**:用 stage 1 拿到的 cookie 但传**不同** `confirm=…` → 403,DB 无新 row
- [ ] **drive-by 模拟**:不带 cookie,传任意 `confirm=…` → 403
- [ ] 用拿到的 token 调 `Authorization: Bearer <token>` `/api/me` → `{email: "dev@localhost"}`
- [ ] **本地 host + bearer 已撤销 → 401**(bearer 分支在 localhost 之前,无法被兜底)
- [ ] **bearer 调用 `/api/auth/cli` → 403**(防自助换 token,在 stage 1 之前 reject)
- [ ] 篡改 token 任意一字符 → 401
- [ ] `callback=https://evil.com/callback` → 400(open redirect 防护)
- [ ] `callback=http://127.0.0.1:9999/admin` → 400(path 校验)
- [ ] `callback=http://evil@127.0.0.1/callback` → 400(userinfo 拒绝)
- [ ] 无 callback query → 400
- [ ] 端到端:`bogo login` 弹浏览器 → 出现 "Authorize bogo CLI" 页 → 点 Authorize → token 落 `~/.clip/bogo/credentials.json`、0600 权限
- [ ] 端到端:第二次 `bogo login` 后,第一次的 token 调 `/api/me` → 401(one-active-per-identity)
- [ ] 端到端:`bogo workspaces-create --name X` → `bogo workspaces-list` 能看到
- [ ] 端到端:`bogo persons-create <wid> --name "Eng" --managerId <root>` 成功
- [ ] 端到端:`bogo documents-create <wid> --title "Test" --personIds <id1>,<id2>` 成功(query CSV);`bogo documents-versions <wid> <id>` 返回 v1
- [ ] 端到端:`bogo fields-create <wid> --name "Dept" --fieldType select --options Eng,Mkt --required true` 成功(query CSV + boolean 字符串)
- [ ] CF Access service token JWT 仍能调 `/api/*`(与 bearer 并存)

## 11. Out of Scope

- OpenAPI 自动生成(让 worker 暴露 `/openapi.json`) —— 下一个 feature
- UI Settings token 管理页 —— phase 2
- 自定义 token label / 过期时间设置(v1 全部默认) —— phase 2
- Token scope 限权(仅某 workspace) —— phase 2
- Token rotation —— v1 撤销 + 重发即可
- Audit log(谁、何时、调了什么) —— v1 只有 `last_used_at`
- 把 bogo 作为 clip 仓库的 e2e fixture —— clip 有自己的 demo-app,无需互相塞
- **CLI 传 `null`** —— commander 把 flag 值视为 string,`--managerId null` 会成字符串 `"null"`。`persons-move` 提升为根、`documents-update` 清空 typeId 等场景 CLI 不支持,走 UI
- **CLI 真正的 array body** —— v1 用 query CSV 折中(§6.1);后续要么 clip 加 `--repeat` flag 形态、要么 worker 端通用支持 query-as-array
- **`bogo live` 无凭据调用** —— clip 生成的 CLI 任何子命令都先 `loadConfig()`,无法做"无 token 健康检查"。要 ping 服务直接 `curl /api/live`
- **`tagMode` 标志** —— worker 当前 `persons-list` / `documents-list` 只支持 OR(任一 tag 命中),没消费 `tagMode` query。所以 yaml 不暴露此 flag;若以后加 AND 模式,同时更新 worker + 重启在 yaml 加入

## 12. Decisions(2026-06-21 哥拍板)

1. **Token 不过期** —— `expires_at` 字段保留(Phase 2 token 管理可用),v1 颁发时一律为 NULL。撤销靠手动 D1 `UPDATE api_tokens SET revoked_at = …`(或 Phase 2 的 `DELETE /api/auth/tokens/:id`)
2. **`prefix` 长度 12 字符** —— `bogo_` + 7 字符 base64url,多 token 下区分度高,`auth show` / 日志可读
3. **CLI e2e 进 pre-push,本地可跳** —— `BOGO_SKIP_CLI_E2E=1` 跳过,CI 设 `BOGO_REQUIRE_CLI_E2E=1` 强跑;`command -v clip` 在模块顶层探测,缺失时 `describe.skip` 整组(本地无 clip 友好);若 `BOGO_REQUIRE_CLI_E2E` 已设且 clip 仍缺,模块顶层 throw 让 CI hard-fail
4. **CLI alias = `bogo`** —— 与仓库名一致,与 `bun link` 后全局命令名一致。若哥本机已有同名,届时再调整

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
