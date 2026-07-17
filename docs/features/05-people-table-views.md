# SPEC: People Table Views（多维表格）

## Objective

为 Workspace 增加与 **Documents / People** 平级的第三主功能：**People 多维表格
（Table Views）**。用户可创建多个命名 View，从内置 Person 字段与自定义字段中
挑选列、调整顺序，并以只读网格查看全量人员；支持按列排序与简单筛选。

**Target users**: Workspace owner（当前 Bogo 单用户模型），需要横向扫描
「人 × 字段」矩阵，而不是只在 org chart 上逐个点开节点。

**一句话定位**：View = workspace 级、可命名的「列布局 + 排序 + 筛选」配置；
数据源永远是现有 `persons` + `custom_field_*`，**不复制行数据**。

## Product Decisions（哥 2026-07-17 拍板）

| # | 议题 | 决议 |
|---|------|------|
| 1 | 存储与归属 | **Workspace 级**，D1 持久化；同 workspace 共享 |
| 2 | v1 交互深度 | **只读网格** + 列配置 + **排序 / 筛选**；编辑走全页 **`/people/:id`**（从 Table Name 进入） |
| 3 | 可选列 | **内置字段 + 自定义字段** |
| 4 | 导航 | 侧栏 **第三主入口**，文案 **`Table`**，路径 `/table` |
| 5 | View 数量 | **支持多个命名 View**；每个 workspace **有且仅有一个** default |
| 6 | 行点击 | 点 **Name** 进入全页 **`/people/:id`**（`?from=/table?view=` 保留来源 View） |
| 7 | 默认 View 名 | 固定 **`All People`** |
| 8 | manager 列排序 | 按 **resolved 姓名**（`localeCompare`），不是 person id |
| 9 | CLI | 与 API **同期上线**；必须补齐 CSV/JSON bridge + `check-clip-yaml` 计数 |

## Non-Goals（v1 明确不做）

- **单元格内联编辑**（PUT field value / update person 从表格触发）→ v2。
- **透视 / 分组 / 看板 / 甘特** 等「多维」高级形态；v1 是可配置列的数据表。
- **用户私有 View**（Bogo 尚无 workspace 多成员模型）。
- **服务端分页 / 虚拟滚动后端协议**（见 §Data Loading；客户端处理百人级）。
- **导出 CSV / Excel**、**打印布局**。
- **列宽 / 冻结列 / 列内搜索** 的服务端存储（列宽可 localStorage，见 §UI）。
- **派生列**（reports count、tree depth 等计算列）。
  - 例外：内置 `managerId` / `dottedManagerId` 在 UI **展示为经理姓名**（resolve 自
    同 workspace 的 persons map）；**筛选与排序均用 resolved 姓名**（eq/contains 写
    姓名即可；person id 仍兼容）。
- **改写现有 Custom Field 模型**（types / defaultValue / required 语义保持不变）。
- **Overview 上的表格入口或统计**（可后置）。
- **独立的 `PUT /:id/default` 端点**（default 转移只走 `PUT /:id` + `isDefault: true`，见 §Default Invariant）。

## Vocabulary

| 术语 | 含义 |
|------|------|
| **Table View**（`person_table_views`） | 一份命名配置：列、排序、筛选、是否 default |
| **Column key** | 稳定标识一列：`builtin:<name>` 或 `field:<uuid>` |
| **Builtin field** | Person 表上的一等字段（见 §Builtin Catalog） |
| **Grid** | 按当前 View 渲染的只读 HTML table / 等价网格 |
| **Resolved cell** | 展示值：有 stored value 用 stored；否则按规则 fallback（见 §Cell Resolution） |
| **Stale column** | `field:<uuid>` 在当前 workspace 的 field defs 中已不存在 |

---

## Data Model

### New Table: `person_table_views`

```sql
-- 0008_person_table_views.sql
CREATE TABLE person_table_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- JSON array of column keys, ordered left→right.
  -- e.g. ["builtin:name","field:019abc...","builtin:title"]
  columns_json TEXT NOT NULL,
  -- JSON: { "key": "builtin:name", "direction": "asc"|"desc" } or SQL NULL
  sort_json TEXT,
  -- JSON array of filter objects (AND). Empty array = no filter.
  filters_json TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);

CREATE INDEX idx_ptv_workspace_sort
  ON person_table_views(workspace_id, sort_order);

-- At most one default view per workspace (partial unique index).
-- "Exactly one" is enforced by application invariants + seed/backfill (see §Default Invariant).
CREATE UNIQUE INDEX idx_ptv_workspace_default
  ON person_table_views(workspace_id)
  WHERE is_default = 1;
```

**Design notes:**

- **不单独建 join 表存列**：列集合是 View 的配置快照（JSON），不是 N:M 实体关系。
  自定义字段被删除后，View 里可能残留 stale key —— 见 §Stale Columns。
- `UNIQUE (workspace_id, name)`：同 workspace 内 View 名不重复（大小写敏感，与 tags 一致）。
- `sort_order`：View 切换器展示顺序。**POST 时由服务端分配** `MAX(sort_order)+1`
  （workspace 内；无行时为 `0`），客户端 **不得** 在 create 时传 `sortOrder`。
- JSON 列在 Worker 层用 Zod 校验后再 `JSON.stringify` 写入；**禁止**把未校验 body
  直接塞进 D1。

### Why not materialize a “table rows” store?

People 数据已在 `persons` + `custom_field_values`。再复制一份会双写不一致、放大
surface、违背「View 只是投影」。v1 网格 = 读 persons + field defs + bulk field values，
**客户端**按 View 投影。

---

## Builtin Catalog

| Column key | Person 字段 | 单元格展示 | 可排序 | 可筛选 | 备注 |
|------------|-------------|------------|--------|--------|------|
| `builtin:name` | `name` | 文本 | ✅ | text | **每个 View 强制包含且不可移除**（可改顺序） |
| `builtin:title` | `title` | 文本 | ✅ | text | |
| `builtin:managerId` | `managerId` | 经理 **姓名**（lookup） | ✅ **按 resolved 姓名** | person-ref | root / 缺失 → 排序沉底，展示 em-dash |
| `builtin:dottedManagerId` | `dottedManagerId` | 虚线经理姓名 | ✅ **按 resolved 姓名** | person-ref | null → 同上 |
| `builtin:avatarUrl` | `avatarUrl` | 小头像 / 占位 | ❌ | ❌ | 只读展示 |
| `builtin:isRoot` | `isRoot` | boolean badge | ✅ | boolean | |
| `builtin:tags` | embedded `tags` | TagBadge 列表 | ❌ | tag-ids | 复用 list persons 已 embed 的 tags |
| `builtin:createdAt` | `createdAt` | ISO timestamp 格式化 | ✅ | date-day（UTC） | 存完整 ISO；筛选见 §Timestamp Day Filters |
| `builtin:updatedAt` | `updatedAt` | 同上 | ✅ | date-day（UTC） | 同上 |

**不在 v1 catalog：** `sortOrder`、`id`、`workspaceId`。

### Custom field columns

- Key：`field:<custom_field_definitions.id>`
- 展示名 / 类型 / options / defaultValue：来自 field definition，**不**写入 View JSON
- View 只存 key 与列顺序；字段 rename / type change 自动反映到网格

### Column key grammar

```
column_key := "builtin:" builtin_name | "field:" uuid
builtin_name := "name" | "title" | "managerId" | "dottedManagerId"
              | "avatarUrl" | "isRoot" | "tags" | "createdAt" | "updatedAt"
```

Zod（实现时以项目 zod v4 惯用法为准）：

```ts
const builtinNameSchema = z.enum([
  "name", "title", "managerId", "dottedManagerId",
  "avatarUrl", "isRoot", "tags", "createdAt", "updatedAt",
]);
const columnKeySchema = z.union([
  z.string().regex(/^builtin:(name|title|managerId|dottedManagerId|avatarUrl|isRoot|tags|createdAt|updatedAt)$/),
  z.string().regex(/^field:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
]);
```

---

## Cell Resolution

对每一格 `(person, column)`：

### Builtin

直接读 person 属性；`managerId` / `dottedManagerId` 用
`personsById.get(id)?.name ?? "—"`。

### Custom field

1. 若存在 `custom_field_values` 行且 `value !== ""` → 用 `value`。
2. 否则若 definition.`defaultValue` 非 null 且非 `""` → 展示 defaultValue，UI 加
   `data-default="true"` / muted 样式。
3. 否则 → em-dash `—`。

**类型渲染**（只读）：

| fieldType | 渲染 |
|-----------|------|
| text | plain text, truncate + title tooltip |
| number | 右对齐文本（不强制 locale 分组） |
| date | 与 Documents `event_date` 一致 |
| select | badge / plain（与 Settings fields 一致） |
| boolean | 与 Person 字段面板一致（对照 `fields.ts` `validateFieldValue` 写入格式） |

**空值定义（resolved empty）**：无 stored 行，或 stored `""`，且无可用 defaultValue
（null 或 `""`）。空串与 null 同等对待。

---

## Sort Semantics

```ts
type ViewSort = {
  key: ColumnKey;
  direction: "asc" | "desc";
} | null;
```

- v1 **单列排序**。
- `sort === null` 时的网格默认序：**`name ASC`**（`localeCompare`，见下）；root 不特殊置顶。
- **不可排序列**（`avatarUrl`, `tags`）：写入 View 时若 sort 指向它们 → `400 INVALID_SORT`。
- **`managerId` / `dottedManagerId`**：比较 **resolved 姓名**（与展示一致），不是 id 字符串。
- **自定义字段**按 `fieldType`：
  - number：与 `fields.ts` 一致 — `Number(value)`，要求 `trim !== ""` 且 `Number.isFinite(n)`；非法沉底（**不用** `parseFloat`，避免 `"12abc"` → `12`）
  - date：ISO 字符串字典序
  - boolean：按 `fields.ts` 规范字面量；`false < true`
  - text / select：字符串比较（见 §Comparison Norms）
- **缺失值**（resolved empty）：**永远沉底**（asc/desc 皆沉底）。
- **defaultValue 参与排序**：是（resolved value）。

**读时 stale sort**：若 `sort.key` 指向已删除 field、或不在当前 `columns` 中、或列已不可排序
（历史脏数据），**跳过该 sort**（等同 `null` → name ASC），并 toast 警告
`Sort column unavailable`。**不 500**。

**排序执行位置（v1）**：客户端。Worker 在 **写入** View 时校验 sort/filter 形状与列类型，
不提供 `?viewId=` 投影端点。

### Comparison Norms（sort + filter 共用）

写测试前固定如下（`apply-sort-filter.ts` 与 L1 用例的唯一真相）：

| 规则 | 规范 |
|------|------|
| 大小写 | text 的 `eq` / `neq` / `contains` / `not_contains`：**大小写不敏感**（先 `toLocaleLowerCase("en-US")`） |
| trim | 比较前对 **操作数两侧** 做 `trim()`（列 resolved 字符串与 filter.value） |
| select | **不支持** `contains` / `not_contains`；仅 eq/neq/in/is_empty/is_not_empty。eq/neq 对 option 字符串 **大小写敏感**（选项是闭集，与存储一致） |
| number 比较 | `const n = Number(s)`；`trim === ""` 或 `!Number.isFinite(n)` → filter **不匹配** / sort 沉底（对齐 `fields.ts` `validateFieldValue`，拒绝 `"12abc"`） |
| date / date-day 比较 | 见 §Timestamp Day Filters 与 §Filter Value Shape；格式非法 → filter 不匹配 / sort 沉底 |
| `neq` 与空值 | resolved empty 对 `neq X`：**不命中**（空值只由 `is_empty` / `is_not_empty` 表达） |
| `not_contains` 与空值 | resolved empty：**不命中**（同 neq） |
| `contains` | 仅 text；两侧 lower+trim 后 `haystack.includes(needle)`。**needle 在写入时已强制非空**，故不存在 `contains ""` 命中全部的问题 |
| 查空 | **统一** `is_empty` / `is_not_empty`。不存在「resolved 为 `""` 的显式空」可被 `eq ""` 命中（Cell Resolution 把 stored `""` 吞进 empty/default） |
| 稳定次序 | 主比较相等时 tie-break：`person.id` 升序 |

### Timestamp Day Filters（builtin createdAt / updatedAt）

Person 的 `createdAt` / `updatedAt` 是 **完整 ISO-8601 timestamp**（如
`2026-07-17T07:28:10.123Z`）。UI date 控件提交 **`YYYY-MM-DD`**。v1 **不做**
datetime 精确到秒的 filter；统一按 **UTC 日历日** 比较：

| 步骤 | 规则 |
|------|------|
| 规范化 cell | 取 resolved ISO 字符串，解析为 `Date`；取 **UTC** `YYYY-MM-DD`（`toISOString().slice(0, 10)`） |
| 规范化 filter.value | 必须匹配 `^\d{4}-\d{2}-\d{2}$`（写入时校验）；否则 `400 INVALID_FILTER` |
| `eq` / `neq` | 比较两个 `YYYY-MM-DD` 字符串 |
| `gt` / `gte` / `lt` / `lte` | 同上，字典序即时间序 |
| sort | 仍按完整 ISO 字符串字典序（保留时分秒精度）；缺失沉底 |

**custom field `fieldType: date`**：存储已是 `YYYY-MM-DD`，直接字符串比较；filter.value
同样要求 `YYYY-MM-DD`。

**不采用**「本地时区日」：Workers / 浏览器时区不一致会导致同 filter 结果漂移；UTC 日
可复现、可测。

---

## Filter Semantics

```ts
type FilterOperator =
  | "eq" | "neq"
  | "contains" | "not_contains"  // text only（非 select）
  | "gt" | "gte" | "lt" | "lte"  // number / date / date-day
  | "is_empty" | "is_not_empty"
  | "in";                        // select multi / tag-ids / person-ref multi

type ViewFilter = {
  key: ColumnKey;
  op: FilterOperator;
  value?: string | string[] | null;
};

// View.filters: ViewFilter[]  — AND only in v1
```

### 按列类型允许的 op

| 列类型 | 允许 ops |
|--------|----------|
| text (builtin name/title, field text) | eq, neq, contains, not_contains, is_empty, is_not_empty |
| number | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty |
| date-day (builtin createdAt/updatedAt) | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty（value = `YYYY-MM-DD`，UTC 日） |
| date (fieldType date) | 同上（value = `YYYY-MM-DD`，直接比） |
| boolean / isRoot | eq, neq, is_empty, is_not_empty |
| select | eq, neq, in, is_empty, is_not_empty（**无** contains） |
| person-ref (manager*) | eq, neq, contains, not_contains, in, is_empty, is_not_empty（value = **resolved 姓名**或 person id） |
| tags | `in`（tag id[]，**any** 命中）、is_empty, is_not_empty |
| avatarUrl | **不可筛选** |

### Filter Value Shape（完整状态校验，写入时强制）

Zod 的粗类型 `string | string[] | null` **不够**；handler 在 op × 列类型维度做
**形状 + 格式**校验（POST 全部 filter；PUT 仅 **新写入/修改** 的 filter，见 §Stale）。

| op | `value` 形状 | 额外格式 |
|----|--------------|----------|
| `is_empty` / `is_not_empty` | **必须省略**或 `null`；出现非 null 字符串/数组 → `400 INVALID_FILTER` | 查空 **只** 走这两 op |
| `in` | **非空** `string[]`（`length ≥ 1`）；`string` 或空数组 → 400 | 每个元素 `trim()` 后 **非空**；再按列类型做 uuid/option 等格式校验 |
| 其余 ops（eq/neq/contains/not_contains/gt/…） | **必须是 `string`**（非数组、非 null） | **`trim()` 后非空** → 否则 `400 INVALID_FILTER`；再按下表做类型格式 |

**禁止** 用 `eq ""` / `contains ""` / 仅空白 的 string 表达「空」：

- Cell Resolution 将 stored `""` 与无 default 一并视为 **resolved empty**，网格里 **不存在** 可被 `eq ""` 命中的「显式空串 cell」。
- `contains ""`（或 trim 后空 needle）会数学上命中所有字符串，属未定义 UX。
- **查空统一 `is_empty` / `is_not_empty`**；所有非 empty 操作符在写入时拒绝 trim 后为空的 value。

**按列类型的 string 格式**（在「trim 后非空」之后）：

| 列类型 | value string 约束 |
|--------|-------------------|
| text | 任意非空（trim 后）string；比较时再 lower+trim |
| number | 与 `fields.ts`：`Number(value)` 且 `value.trim() !== ""` 且 `Number.isFinite(n)`；拒绝 `""`、`abc`、`12abc` |
| date / date-day | `^\d{4}-\d{2}-\d{2}$` 且日历合法（拒绝 `2026-13-40`） |
| boolean / isRoot | 与 `fields.ts` `validateFieldValue` 布尔字面量一致（实现时单测钉死允许集，如 `"true"`/`"false"`） |
| select | 单个 option 字符串（`in` 走数组分支） |
| person-ref | 非空字符串：优先 **resolved 经理姓名**（与单元格一致）；也可 person id。`in` 为上述字符串数组 |

失败码统一 **`400 INVALID_FILTER`**（可在 `message` 区分 shape vs format vs empty-value）。

- 过滤基于 **resolved value**（含 defaultValue）；person-ref 的 eq/contains 按 **姓名**（大小写不敏感）匹配，id 仍命中。
- OR 组合 → v2。
- **读网格**时非法 / stale filter → **跳过 + toast**，不 500。

**执行位置**：客户端 AND 链。

---

## Stale Columns

当用户删除某个 `custom_field_definitions` 行时：

1. DB **不**级联改 `person_table_views.columns_json`（JSON 无 FK）。
2. 网格渲染：stale 列头 `Missing field` + warning icon，单元格 `—`。
3. Configure UI：列出 stale keys，提供 **Remove stale columns**。
4. **不在 DELETE field 时静默 rewrite 全部 views**。

### 写入时（POST / PUT）与 stale 的关系（P1 闭环）

| 场景 | 行为 |
|------|------|
| **POST**（新建） | `columns` 中每个 `field:<uuid>` **必须**存在于当前 defs；否则 `400 UNKNOWN_FIELD`。`sort`/`filters` 不得引用缺失 field（无历史可保留）。 |
| **PUT** 未传 `columns` | 不碰列；允许在仍含历史 stale 的 view 上只改 `name` / `sortOrder` / 非 stale 的 sort·filters 等。 |
| **PUT** 传了 `columns` | 对 **新引入** 的 key（∈ nextColumns \ prevColumns）中的 `field:*`：必须存在于 defs，否则 `400 UNKNOWN_FIELD`。 **保留** 的 stale key（仍在 prev 与 next 中）**允许**。 |
| **从 columns 移除某 key**（含 stale） | **同步清除** `sort`（若 `sort.key` 等于该 key → 置 `null`）以及 `filters` 中 `key` 等于该 key 的项。在 merge 之后、校验之前执行。 |
| GET | `columns` / `sort` / `filters` **原样**返回（可含 stale），不静默过滤。 |

#### 历史 stale sort / filter 不得阻塞改名（关键）

缺失 field definition 时 **无法**判断列类型，因此 **不能**对「原样保留的历史
sort/filter」跑完整类型校验——否则「只改 name」也会 400。

定义：

- `sortTouched` := `patch.sort !== undefined`
- `filtersTouched` := `patch.filters !== undefined`
- **stale key**：`field:<uuid>` 且 uuid ∉ 当前 workspace field defs  
  （builtin key 永非 stale；未知 builtin 文法在 columnKeySchema 已拒）

| 对象 | 校验策略 |
|------|----------|
| **未修改**的 `next.sort`（`!sortTouched`，仍为 existing） | **原样保留**，即使 key 已 stale 或类型已不可解析。**不做** sortable / 类型检查。 |
| **新写入/修改**的 sort（`sortTouched`） | 必须：`null`，或（`key ∈ next.columns` ∧ key **非 stale** ∧ 列可排序）。禁止把 sort 指到 stale key。 |
| **未修改**的 `next.filters`（`!filtersTouched`） | **原样保留**每一条历史 filter（可含 stale key）。**不做** op/类型/value-shape 检查。 |
| **新写入/修改**的 filters（`filtersTouched`） | **数组整体替换**语义：patch.filters 中 **每一条** 必须：`key ∈ next.columns` ∧ key **非 stale** ∧ op 允许 ∧ value shape/format 合法。不得在新 filters 数组里写入 stale key。 |

列移除引发的自动清 sort/filter（上表「从 columns 移除」）在 `sortTouched` /
`filtersTouched` 判定 **之后**仍执行：若用户 PUT 了新 columns 去掉某 key，即使
未传 sort/filters，也会清掉引用该 key 的 sort/filter（属于 columns 变更的副作用，
不是「校验历史 stale」）。

读时 stale **sort** / **filter**：跳过 + toast（与上一致）。

---

## Default Invariant（有且仅有一个 default）

DB partial unique index 只保证 **至多一个** default。应用层闭环：

### 保证「至少一个」

1. **Seed**：`POST /workspaces` 的 `DB.batch` 插入 root person 的同时插入
   `name=All People`, `is_default=1`, `sort_order=0` 的 view（见 §Seed）。
2. **Backfill**：migration `0008` 为每个尚无 view 的 workspace 插入同样的 **All People**。
3. **DELETE 约束**：
   - workspace 内仅剩 1 条 view → `400 CANNOT_DELETE_LAST_VIEW`（无论是否 default）。
   - 目标 `is_default=1` 且还有其他 view → `400 CANNOT_DELETE_DEFAULT`
     （必须先转移 default，再删）。

### 保证「至多 / 转移唯一 API」

**唯一转移路径**：`PUT /api/w/:wid/table-views/:id`，body 含 **`isDefault: true`**。

实现（单 batch / 事务语义）：

```
UPDATE person_table_views SET is_default = 0
  WHERE workspace_id = ? AND is_default = 1 AND id != ?;
UPDATE person_table_views SET is_default = 1, updated_at = ?
  WHERE workspace_id = ? AND id = ?;
```

| 操作 | 结果 |
|------|------|
| `isDefault: true`（目标已是 default） | no-op 成功 |
| `isDefault: true`（目标非 default） | 原子转移 |
| `isDefault: false` 且目标 **当前是** default | **`400 CANNOT_CLEAR_DEFAULT`** —— 禁止「直接取消」导致零 default |
| `isDefault: false` 且目标不是 default | 忽略或 no-op（保持 false） |
| body **省略** `isDefault` | 不修改 default 标志 |

**不提供** `PUT /:id/default` 第二套 API（避免双入口）。

**POST** `isDefault: true`：创建为 default 时同样 batch 清掉旧 default。  
**POST** 省略 / `false`：新 view 非 default（workspace 已有 seed default）。

---

## Seed All People View

| 字段 | 值 |
|------|-----|
| name | `All People` |
| columns | `["builtin:name","builtin:title","builtin:managerId"]` |
| sort | `null`（网格默认 name ASC） |
| filters | `[]` |
| is_default | `1` |
| sort_order | `0` |

### Migration backfill ID（D1 可执行、无 JS）

SQLite/D1 无 `generateId()`。backfill 使用 **random UUID 文本**（v4 形，足够唯一）：

```sql
-- After CREATE TABLE …
INSERT INTO person_table_views (
  id, workspace_id, name, columns_json, sort_json, filters_json,
  is_default, sort_order, created_at, updated_at
)
SELECT
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  ),
  w.id,
  'All People',
  '["builtin:name","builtin:title","builtin:managerId"]',
  NULL,
  '[]',
  1,
  0,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM person_table_views v WHERE v.workspace_id = w.id
);
```

> 运行时 `POST /workspaces` 仍用 JS `generateId()`（UUIDv7）；仅 migration 用上式。

---

## API

Hono sub-app：`/api/w/:wid/table-views`。

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | 列出 views。顺序：`ORDER BY sort_order ASC, created_at ASC, id ASC` |
| POST | `/` | 创建 view；`sort_order = COALESCE(MAX(sort_order),-1)+1` |
| GET | `/:id` | 单个 view |
| PUT | `/:id` | 部分更新（见 §Update merge）；`isDefault: true` 转移 default |
| DELETE | `/:id` | 受 §Default Invariant 约束 |

**不新增** rows 投影 API。网格复用：

| 已有端点 | 用途 |
|----------|------|
| `GET /api/w/:wid/persons` | 行 + tags |
| `GET /api/w/:wid/fields` | 列元数据 |
| `GET /api/w/:wid/fields/values` | bulk 单元格 |

### Response contract

与全站 API 一致：成功 `{ data: T }`，失败 `{ error: { code, message, issues? } }`。

```ts
// packages/shared — wire type returned by all table-view endpoints
interface PersonTableView {
  id: string;
  workspaceId: string;
  name: string;
  columns: ColumnKey[];       // parsed from columns_json；可含 stale
  sort: ViewSort;             // null when sort_json IS NULL
  filters: ViewFilter[];      // parsed；可含历史 stale
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;          // ISO-8601
  updatedAt: string;
}

type ColumnKey = string; // validated by columnKeySchema
type ViewSort = { key: ColumnKey; direction: "asc" | "desc" } | null;
// ViewFilter — see §Filter Semantics
```

| Method | Path | Success | `data` 形状 |
|--------|------|---------|-------------|
| GET | `/` | `200` | `PersonTableView[]` |
| POST | `/` | `201` | `PersonTableView`（新建完整对象） |
| GET | `/:id` | `200` | `PersonTableView` |
| PUT | `/:id` | `200` | `PersonTableView`（merge 后完整对象，非 patch 回显） |
| DELETE | `/:id` | `200` | `{ deleted: true }`（与 tags/doc-types 删除回包风格对齐；若项目另有惯例以实现为准并单测钉死） |

错误：`400`（VALIDATION_ERROR / INVALID_* / CANNOT_* / UNKNOWN_FIELD / DUPLICATE_NAME）、
`404`（NOT_FOUND）。不使用 `204`。

map 行时：`columns_json` / `filters_json` `JSON.parse`；`sort_json` null → `sort: null`；
`is_default` 0/1 → boolean。

### Schemas（create ≠ update）

```ts
// Shared pieces
viewSortSchema = z.object({
  key: columnKeySchema,
  direction: z.enum(["asc", "desc"]),
}).nullable();

// Coarse wire shape only — op×value 形状与 number/date/boolean 格式见
// §Filter Value Shape（handler 完整状态校验，不能单靠本 schema）。
viewFilterSchema = z.object({
  key: columnKeySchema,
  op: z.enum([
    "eq", "neq", "contains", "not_contains",
    "gt", "gte", "lt", "lte",
    "is_empty", "is_not_empty", "in",
  ]),
  value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
});

// POST — defaults only here
createPersonTableViewSchema = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(columnKeySchema).min(1).max(64),
  sort: viewSortSchema.optional(),           // default null at handler if omitted
  filters: z.array(viewFilterSchema).max(32).optional(), // default [] at handler
  isDefault: z.boolean().optional(),         // default false at handler
});
// Handler defaults (NOT zod .default on fields that will be .partial()'d):
//   sort ?? null, filters ?? [], isDefault ?? false

// PUT — independent schema, NO .default(), all optional, no accidental clear
updatePersonTableViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  columns: z.array(columnKeySchema).min(1).max(64).optional(),
  sort: viewSortSchema.optional(),           // explicit null clears sort
  filters: z.array(viewFilterSchema).max(32).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "empty patch" });
```

**禁止** `createPersonTableViewSchema.partial()` 当 update：Zod v4 下带
`.default([])` / `.default(false)` 的字段在 `safeParse({})` 时仍会产出
`{ filters: [], isDefault: false }`，导致「只改 sort」清空 filters、取消 default。

### Update merge 算法（PUT handler 必须）

```
1. Load existing row; 404 if missing.
2. Parse body with updatePersonTableViewSchema (patch only; omitted keys absent).
3. sortTouched = patch.sort !== undefined
   filtersTouched = patch.filters !== undefined
4. next = {
     name: patch.name ?? existing.name,
     columns: patch.columns ?? existing.columns,
     sort: sortTouched ? patch.sort : existing.sort,
     filters: filtersTouched ? patch.filters : existing.filters,
     isDefault: patch.isDefault ?? existing.isDefault,
     sortOrder: patch.sortOrder ?? existing.sortOrder,
   }
5. If patch.columns defined:
     removed = prevColumns \ next.columns
     if next.sort?.key ∈ removed → next.sort = null
     next.filters = next.filters.filter(f => f.key ∉ removed)
6. Validate (分档，避免 stale 阻塞改名):
     ALWAYS:
       - columns includes builtin:name, unique keys, max 64
       - field keys: only NEW keys (next.columns \ prev) must exist in defs
       - isDefault false while existing.isDefault → CANNOT_CLEAR_DEFAULT
     IF sortTouched:
       - next.sort is null OR (
           key ∈ next.columns ∧ key not stale ∧ column sortable
         )
     ELSE:
       - skip sort type checks (historical stale sort may remain)
     IF filtersTouched:
       - for each filter in next.filters:
           key ∈ next.columns ∧ key not stale
           ∧ op allowed for resolvable column type
           ∧ value shape/format per §Filter Value Shape
     ELSE:
       - skip filter type/shape checks (historical stale filters may remain)
7. Persist; if next.isDefault && !existing.isDefault → batch clear other defaults.
8. Return full PersonTableView.
```

### POST 校验规则

1. `columns` 含 `builtin:name`；keys 唯一。
2. 全部 `field:*` 必须存在于 defs（无 stale）。
3. `sort` / `filters` **全部**按「新写入」标准校验（无历史保留）；含 §Filter Value Shape。
4. `sort_order` 服务端分配，忽略客户端若误传。
5. `isDefault: true` → batch 转移。

### Error codes

| code | when |
|------|------|
| `VALIDATION_ERROR` | Zod / 空 patch / column 结构 |
| `NOT_FOUND` | view id |
| `DUPLICATE_NAME` | UNIQUE name |
| `CANNOT_DELETE_DEFAULT` | 删除当前 default（且非最后一条时的语义，见上） |
| `CANNOT_DELETE_LAST_VIEW` | 删除 workspace 内最后一条 view |
| `CANNOT_CLEAR_DEFAULT` | PUT `isDefault: false` 打在当前 default 上 |
| `UNKNOWN_FIELD` | 新引入的 field key 不在 defs |
| `INVALID_SORT` | 不可排序列或 sort.key ∉ columns |
| `INVALID_FILTER` | op/类型不匹配或 filter.key ∉ columns |

### clip.yaml / CLI

与 API **同期**交付。clip codegen 不支持 body 数组/对象 → **必须 bridge**（对齐
`docs/features/02-cli.md` 的 `personIds` / `options` 模式）。

#### 命令集合（5 个 endpoint + 既有 login）

| Endpoint name | Method | Path |
|---------------|--------|------|
| `table-views-list` | GET | `/api/w/:wid/table-views` |
| `table-views-create` | POST | `/api/w/:wid/table-views` |
| `table-views-get` | GET | `/api/w/:wid/table-views/:id` |
| `table-views-update` | PUT | `/api/w/:wid/table-views/:id` |
| `table-views-delete` | DELETE | `/api/w/:wid/table-views/:id` |

#### Bridge 约定

| 字段 | clip.yaml | CLI 用户传参 | Worker |
|------|-----------|--------------|--------|
| `columns` | `params.query`，string | `--columns "builtin:name,builtin:title,field:<uuid>"` CSV | query → `string[]` 写入 body 再 Zod（body 已有数组则 body 优先，与 fields options 一致） |
| `sort` | `params.query`，string | `--sort '{"key":"builtin:name","direction":"asc"}'` 或 `--sort null` | `JSON.parse` → body.sort；非法 JSON → 400 |
| `filters` | `params.query`，string | `--filters '[{"key":"builtin:title","op":"contains","value":"eng"}]'` | `JSON.parse` → body.filters |
| `name` / `isDefault` / `sortOrder` | body 标量 | 普通 flag | 无 bridge |

UI / 程序化调用方继续发 JSON body，**不依赖** query bridge。

#### `scripts/check-clip-yaml.ts`

当前 `EXPECTED_COMMAND_FILES = 44`（含 `_login.ts`）。新增 5 个 endpoint 后
生成物多 5 个 command 文件：

```ts
const EXPECTED_COMMAND_FILES = 49; // was 44; +5 table-views-*
```

**Project Structure 与 Implementation Order 必须包含该文件修改**，否则 gate 红。

CLI 不渲染网格，只管理 View 配置。

---

## UI

### Navigation

`AppSidebar` `WORKSPACE_ITEMS`：

```
Documents  → /documents
People     → /people
Table      → /table          // 文案固定 Table
```

Icon：`Table2`（lucide）。

### Routes

| Path | Page |
|------|------|
| `/table` | `TablePage` — 见下方 `?view=` 解析 |
| 配置 | page 内 Drawer / Dialog，无独立 edit 路由 |

#### `?view=` 解析（非阻塞补强，v1 必做）

| 条件 | 行为 |
|------|------|
| 无 `view` query | 使用 workspace 的 **default** view |
| `view=<id>` 且 id ∈ 当前 workspace 的 views 列表 | 选中该 view |
| `view=<id>` 无效（未知 id）、或属于其他 workspace（列表查无） | **回退 default**，并用 `navigate(..., { replace: true })` **改写 URL** 为 `/table` 或 `/table?view=<defaultId>`（二选一实现时固定一种：推荐 `/table?view=<defaultId>` 以便刷新稳定） |
| views 仍在 loading | 不闪回退；load 完成后再解析 |

`App.tsx` 注册路由；`gate:pages` + `tests/smoke.spec.ts` 覆盖（含无效 `?view=` 回退）。

### TablePage 布局

```
┌─────────────────────────────────────────────────────────┐
│ [View switcher ▾]  [Configure]  [New view]   filter chips │
├─────────────────────────────────────────────────────────┤
│ name ▼ │ title │ manager │ Department │ Level │ …        │
├─────────────────────────────────────────────────────────┤
│ Alice  │ Eng   │ —       │ Platform   │ L5    │          │
│ Bob    │ PM    │ Alice   │ —          │ L4    │          │
└─────────────────────────────────────────────────────────┘
│ N people (M filtered)                                     │
```

**交互（已拍板）**：

1. **View switcher**：全部 views，default 星标；切换写 `?view=`。
2. **Configure**：列选择 + 拖拽顺序；Save → PUT（可只改 columns）。
3. **列头**：可排序列点击 asc → desc → clear；`aria-sort` 在 **`<th scope="col">`**
   上（`none` | `ascending` | `descending`），不在内部 button 上单独充当 columnheader。
4. **Filters**：draft → **Save filters** 显式 PUT（防误改共享 view）。
5. **Sort**：列头变更后 **立即 PUT** `sort`（merge 算法，不传 filters 则保留）。
6. **Name 链接**：进入 **`/people/:id?from=/table?view=<id>`** 全页编辑；返回恢复来源 View。
7. **空状态**：无 people → CTA「Go to People」；始终至少有 All People view。

### MVVM / 文件清单（完整）

```
packages/ui/src/
├── lib/api/
│   ├── table-views.ts            # NEW: fetch wrappers
│   └── index.ts                  # MODIFY: re-export
├── models/
│   └── table-view.model.ts       # NEW: React Query options
├── viewmodels/table/
│   ├── use-table-views.ts
│   ├── use-table-grid.ts
│   ├── resolve-cell.ts
│   ├── apply-sort-filter.ts
│   └── column-catalog.ts
├── components/table/
│   ├── TableGrid.tsx
│   ├── TableViewSwitcher.tsx
│   ├── TableColumnConfig.tsx
│   ├── TableFilterBar.tsx
│   └── TableCell.tsx
├── pages/
│   └── TablePage.tsx
├── components/
│   ├── AppSidebar.tsx            # MODIFY: Table nav item
│   └── layout/
│       └── DashboardLayout.tsx   # MODIFY: /table breadcrumb（若现有 map 有路径标题）
├── App.tsx                       # MODIFY: route
└── tests/… → packages/ui/tests/smoke.spec.ts  # MODIFY: /table smoke

packages/shared/src/schemas/
  table-view.ts
  index.ts

packages/worker/
  migrations/0008_person_table_views.sql
  src/routes/table-views.ts
  src/routes/table-views.test.ts
  src/routes/workspaces.ts
  src/index.ts
  test/e2e/…

clip.yaml
scripts/check-clip-yaml.ts        # EXPECTED_COMMAND_FILES 44 → 49
```

### 列宽

localStorage key：`bogo.table.colwidth.<viewId>`；不进 D1。

### 无障碍

- 语义化 `<table>` / `<th scope="col">`；
- **`aria-sort` 在 `<th>`**（columnheader），排序控件为 th 内 button；
- filter 可键盘操作；
- Name 列可点进全页编辑；返回保留 `?view=`。

---

## Data Loading Strategy

```
parallel:
  personsQuery(wid)
  fieldDefsQuery(wid)
  fieldValuesQuery(wid)
  tableViewsQuery(wid)
→ useTableGrid(view, persons, defs, values)
    → resolve → filter (AND, skip invalid) → sort (skip invalid)
```

规模：≤ 500 persons、≤ 64 columns、≤ 32 filters。

---

## Workspace Create Hook

`workspaces.ts` 创建路径：`DB.batch` 含 workspace + root person + **All People** table view。
任一条失败整批回滚。

---

## Testing Strategy

| Layer | 覆盖 |
|-------|------|
| L1 shared | create vs update schema：`parse({})` on update **不得**注入 filters/isDefault；columnKey |
| L1 worker | merge PUT；rename 含 stale sort/filter 成功；PUT 新 sort/filter 拒 stale；value shape（in/empty/eq）；CANNOT_CLEAR_DEFAULT；default 转移；DELETE last/default；UNKNOWN_FIELD 仅新 key；remove column 清 sort/filter；POST sort_order MAX+1；CLI bridge |
| L1 ui | resolve-cell；UTC day filter for createdAt；comparison norms；stale skip；manager 按姓名 sort；invalid `?view=` replace |
| L2 | table-views CRUD；workspace create 带 All People |
| L3 | smoke `/table` + breadcrumb；打开 panel |
| G1 | typecheck + biome |
| clip | `EXPECTED_COMMAND_FILES === 49` |

### 6DQ

| 维 | 关注点 |
|----|--------|
| Correctness | 恰有一个 default；PUT 不清空；stale 可改名；filter norms |
| Isolation | workspace FK / wid |
| UX | 共享 filters 显式 Save；Name → `/people/:id` 全页 |
| Perf | 四请求并行 |
| A11y | aria-sort on th |
| Regression | workspace create batch；clip gate |

---

## Boundaries

### Always Do

- View 只存配置
- `builtin:name` 必在 columns
- update 用独立 schema + load-merge-validate；**未 touch 的历史 stale sort/filter 原样保留**
- 新写入的 sort/filter **不得**引用 stale key；完整 value shape/format 校验
- 非 empty 操作符的 value **trim 后非空**；查空只用 `is_empty` / `is_not_empty`
- number 与 `fields.ts` 一致（`Number` + finite）
- 端点返回完整 `PersonTableView`（或 list 数组 / delete `{ deleted: true }`）
- createdAt/updatedAt 筛选按 **UTC 日历日** vs `YYYY-MM-DD`
- default 只能 `isDefault: true` 转移，禁止 clear
- JSON Zod 后再入库；`updated_at` 显式更新
- CLI columns CSV + sort/filters JSON bridge；更新 `check-clip-yaml.ts`
- 非法 `?view=` 回退 default 并 `replace` URL

### Never Do

- `createSchema.partial()` 当 update
- `PUT /:id/default` 第二入口
- v1 内联编辑单元格
- DELETE field 时静默 rewrite 全部 views
- 用 PATCH
- localStorage-only 当主存储

---

## Implementation Order（原子提交）

| Step | Commit 方向 | 内容 |
|------|-------------|------|
| 0 | `docs: …` | 本 spec（已提交 / 本轮修订） |
| 1 | `feat(shared): person table view schemas` | create/update 分离 |
| 2 | `feat(worker): migration person_table_views + backfill` | 含 SQL UUID |
| 3 | `feat(worker): table-views CRUD + default invariant` | merge PUT、L1 |
| 4 | `feat(worker): seed default table view on workspace create` | batch |
| 5 | `test(worker): L2 e2e table-views` | |
| 6 | `feat(ui): table-view model + grid pure helpers` | |
| 7 | `feat(ui): TablePage shell + nav + breadcrumb` | AppSidebar + DashboardLayout |
| 8 | `feat(ui): column config + view switcher + /people/:id editor` | |
| 9 | `feat(ui): sort + filter bar` | |
| 10 | `feat(cli): clip.yaml table-views + bridge + gate count` | **含 check-clip-yaml 49** |
| 11 | `test(ui): L3 smoke /table` | smoke.spec.ts |

代码步等文档 LGTM 后再开。

---

## Key Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 资源形态 | 命名 View 配置表 | 单一数据源 |
| 列 key | `builtin:*` / `field:<uuid>` | 可序列化、可校验 |
| 强制 name 列 | 是 | 行可识别 |
| sort/filter | 客户端 + Comparison Norms | 可测、免动态 SQL |
| PUT schema | 独立、无 default，merge 后校验 | 避免清空 filters/default |
| default | 恰一个；仅 `isDefault:true` 转移 | partial index + 应用闭环 |
| stale 写入 | 只拒新未知 field；删列清 sort/filter | 含 stale 的 view 仍可 rename |
| stale sort/filter | 未 touch 则原样保留；touch 则禁 stale | 改名不被历史脏数据阻塞 |
| filter value | op×形状+格式；非 empty 的 value trim 后非空 | 查空只走 is_empty；拒 eq "" / contains "" |
| number 解析 | `Number` + finite（同 fields.ts） | 拒 parseFloat 的 `"12abc"` |
| API 响应 | `PersonTableView` + `{ data }` 状态码表 | 契约可测 |
| createdAt 筛选 | UTC 日历日 vs `YYYY-MM-DD` | 避免 ISO eq 永不命中 |
| 侧栏 | `Table` / `/table` | 拍板 |
| 行点击 | `/people/:id` 全页 + `from` 回跳 | 拍板 |
| 默认名 | `All People` | 拍板 |
| manager sort | resolved 姓名 | 拍板 |
| CLI | 同期 + CSV/JSON bridge + gate 49 | 可实现、可 CI |
| 新 view 序 | MAX(sort_order)+1，GET 稳定排序 | 避免并列 0 |
| `?view=` 非法 | 回退 default + replace URL | 防死链 |
| aria-sort | 在 `<th>` | a11y 正确语义 |

---

## Resolved Questions（原 Open Questions）

| # | 决议 |
|---|------|
| 侧栏文案 | **Table** |
| 行点击 | **`/people/:id` 全页**（from Table view） |
| 默认 View 名 | **All People** |
| manager 排序 | **resolved 姓名** |
| CLI | **与 API 同期**；columns=CSV query，sort/filters=JSON query string；`EXPECTED_COMMAND_FILES=49` |

---

## Alternatives Considered

| 方案 | 弃因 |
|------|------|
| localStorage-only | 不符第三主功能 |
| 服务端 table-rows 投影 | v1 不需要 |
| create.partial() 当 update | Zod default 清空状态 |
| 双 API 设 default | 入口重复；已收束到 PUT isDefault:true |
| PUT 拒绝任何 stale column | 无法在含 stale 时改名 |
| 完整校验未 touch 的历史 sort/filter | 缺 def 无法判类型 → 改名 400；改为 touch 才严校验 |
| createdAt 直接 ISO eq | date 控件 `YYYY-MM-DD` 永不命中；改 UTC 日 |
| 本地时区日比较 | Worker/浏览器漂移；固定 UTC |
| `eq ""` 查空 | Cell Resolution 无「显式空」cell；统一 is_empty |
| `Number.parseFloat` | 接受 `"12abc"`；与 fields.ts 不一致 |
| select 支持 contains | 闭集选项用 eq/in 即可 |

---

## PR Plan

| PR | 标题 | 依赖 | 说明 |
|----|------|------|------|
| PR0 | docs: people table views spec | — | 含本轮 P1–P3 修订 |
| PR1 | shared + migration + table-views API | PR0 | Steps 1–5 |
| PR2 | UI TablePage MVP | PR1 | Steps 6–8 |
| PR3 | sort/filter + clip bridge + L3 | PR2 | Steps 9–11 |

---

## References

- `docs/architecture/01-entity-relationship.md`
- `docs/architecture/03-system-architecture.md`
- `docs/architecture/05-ui-mvvm-architecture.md`
- `docs/features/01-tag-system-spec.md`
- `docs/features/02-cli.md`（array CSV bridge 范本）
- `packages/worker/src/routes/fields.ts`（options CSV bridge、`GET /values`）
- `scripts/check-clip-yaml.ts`（`EXPECTED_COMMAND_FILES`）
