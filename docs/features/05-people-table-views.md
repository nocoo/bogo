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
| 2 | v1 交互深度 | **只读网格** + 列配置 + **排序 / 筛选**；编辑仍走 People 侧栏 |
| 3 | 可选列 | **内置字段 + 自定义字段** |
| 4 | 导航 | 侧栏 **第三主入口**（与 Documents / People 平级） |
| 5 | View 数量 | **支持多个命名 View**（本 spec 同时要求有且仅有一个 default） |

## Non-Goals（v1 明确不做）

- **单元格内联编辑**（PUT field value / update person 从表格触发）→ v2。
- **透视 / 分组 / 看板 / 甘特** 等「多维」高级形态；v1 是可配置列的数据表。
- **用户私有 View**（Bogo 尚无 workspace 多成员模型）。
- **服务端分页 / 虚拟滚动后端协议**（见 §Data Loading；客户端处理百人级）。
- **导出 CSV / Excel**、**打印布局**。
- **列宽 / 冻结列 / 列内搜索** 的服务端存储（列宽可 localStorage，见 §UI）。
- **派生列**（reports count、tree depth、manager name 解析为独立列类型之外的计算列）。
  - 例外：内置 `managerId` / `dottedManagerId` 在 UI **展示为经理姓名**（resolve 自
    同 workspace 的 persons map），存储/筛选仍基于 person id。
- **改写现有 Custom Field 模型**（types / defaultValue / required 语义保持不变）。
- **Overview 上的表格入口或统计**（可后置）。

## Vocabulary

| 术语 | 含义 |
|------|------|
| **Table View**（`person_table_views`） | 一份命名配置：列、排序、筛选、是否 default |
| **Column key** | 稳定标识一列：`builtin:<name>` 或 `field:<uuid>` |
| **Builtin field** | Person 表上的一等字段（见 §Builtin Catalog） |
| **Grid** | 按当前 View 渲染的只读 HTML table / 等价网格 |
| **Resolved cell** | 展示值：有 stored value 用 stored；否则按规则 fallback（见 §Cell Resolution） |

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
  -- JSON: { "key": "builtin:name", "direction": "asc"|"desc" } or null encoded as SQL NULL
  sort_json TEXT,
  -- JSON array of filter objects (AND). Empty array = no filter.
  -- See §Filter Semantics for shape.
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
CREATE UNIQUE INDEX idx_ptv_workspace_default
  ON person_table_views(workspace_id)
  WHERE is_default = 1;
```

**Design notes:**

- **不单独建 join 表存列**：列集合是 View 的配置快照（JSON），不是 N:M 实体关系。
  自定义字段被删除后，View 里可能残留 stale key —— 见 §Stale Columns。
- `UNIQUE (workspace_id, name)`：同 workspace 内 View 名不重复（大小写敏感，与 tags 一致）。
- `is_default` 用 partial unique index 保证至多一个 default；创建 workspace 时 seed
  默认 View（见 §Seed Default View）。
- `sort_order` 控制 View 切换器中的展示顺序（与 tags / field defs 一致）。
- JSON 列在 Worker 层用 Zod 校验后再 `JSON.stringify` 写入；**禁止**把未校验 body
  直接塞进 D1。

### Why not materialize a “table rows” store?

People 数据已在 `persons` + `custom_field_values`。再复制一份会：

1. 与侧栏编辑双写不一致；
2. 放大 migration / CLI surface；
3. 违背「View 只是投影」的产品定义。

v1 网格 = **读 persons + field defs + bulk field values，在服务端或客户端按 View 投影**。

---

## Builtin Catalog

| Column key | Person 字段 | 单元格展示 | 可排序 | 可筛选 | 备注 |
|------------|-------------|------------|--------|--------|------|
| `builtin:name` | `name` | 文本 | ✅ | text | **每个 View 强制包含且不可移除**（可改顺序） |
| `builtin:title` | `title` | 文本 | ✅ | text | |
| `builtin:managerId` | `managerId` | 经理 **姓名**（lookup） | ✅（按 id 或按展示名，见下） | person-ref | root → em-dash |
| `builtin:dottedManagerId` | `dottedManagerId` | 虚线经理姓名 | ✅ | person-ref | null → em-dash |
| `builtin:avatarUrl` | `avatarUrl` | 小头像 / 占位 | ❌ | ❌ | 只读展示 |
| `builtin:isRoot` | `isRoot` | boolean badge | ✅ | boolean | |
| `builtin:tags` | embedded `tags` | TagBadge 列表 | ❌ | tag-ids | 复用 list persons 已 embed 的 tags |
| `builtin:createdAt` | `createdAt` | ISO date 本地格式化 | ✅ | date | |
| `builtin:updatedAt` | `updatedAt` | 同上 | ✅ | date | |

**不在 v1 catalog：**

- `sortOrder`（树内兄弟序，对表格用户噪音大）
- `id` / `workspaceId`（调试用，需要时可 v1.1 加 `builtin:id`）

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

Zod：

```ts
const builtinNameSchema = z.enum([
  "name", "title", "managerId", "dottedManagerId",
  "avatarUrl", "isRoot", "tags", "createdAt", "updatedAt",
]);
const columnKeySchema = z.union([
  z.templateLiteral(["builtin:", builtinNameSchema]), // or z.string().regex(/^builtin:(...)$/)
  z.string().regex(/^field:[0-9a-f-]{36}$/i),
]);
```

（实现时以项目现有 zod v4 惯用法为准；关键是 **闭集 builtin + field UUID**。）

---

## Cell Resolution

对每一格 `(person, column)`：

### Builtin

直接读 person 属性；`managerId` / `dottedManagerId` 用 `personsById.get(id)?.name ?? "—"`。

### Custom field

1. 若存在 `custom_field_values` 行 → 用 `value`（已是 string storage）。
2. 否则若 definition.`defaultValue` 非 null → 展示 defaultValue，UI 加
   `data-default="true"` / 次要样式（muted），与「显式写入」区分。
3. 否则 → em-dash `—`。

**类型渲染**（只读）：

| fieldType | 渲染 |
|-----------|------|
| text | plain text, truncate + title tooltip |
| number | 右对齐文本（不强制 locale 分组，避免 SSR/CSR 不一致） |
| date | `YYYY-MM-DD` 原样或 `toLocaleDateString`（与 Documents `event_date` 一致即可） |
| select | badge / plain（与 Settings fields 选项一致） |
| boolean | `Yes` / `No` 或 check icon（与 Person 字段面板一致） |

空字符串：与 null 一样视为「无值」，走 default / em-dash（与现有
`setFieldValue` 存空串的行为对齐 —— 若今天 API 允许 `""`，网格把 `""` 当无值）。

---

## Sort Semantics

```ts
type ViewSort = {
  key: ColumnKey;           // must be sortable
  direction: "asc" | "desc";
} | null;
```

- v1 **单列排序**（多列 sort keys → v2）。
- `null` = 默认序：`isRoot DESC`（root 置顶可选）然后 `name ASC` —— 实现固定写死在
  worker/UI 共用的 comparator 文档中，避免两端不一致。
  - **推荐默认序（拍板进实现）**：`name ASC`（简单可预期）；root 不特殊置顶。
- **不可排序列**（`avatarUrl`, `tags`）：API 若收到对其 sort → `400 INVALID_SORT`。
- **自定义字段排序**：按 `fieldType`：
  - number：parseFloat，非数字沉底
  - date：ISO 字符串字典序（存储已是可比较形式）
  - boolean：`false < true`（"false"/"true" 或 "0"/"1" —— **以现有 validateFieldValue 写入格式为准**，实现时对照 `fields.ts`）
  - text / select：`localeCompare` en 或简单 UTF-16
- **缺失值**（无 stored 且无 default）：排序时 **永远沉底**（asc/desc 皆沉底），避免
  null 在两端跳动。
- **defaultValue 参与排序**：是（与展示一致：resolved value）。

**排序执行位置（v1）**：客户端。理由：

- 已有 `GET persons` + `GET fields` + `GET fields/values` 三个 bulk 端点，百人级足够；
- 避免在 D1 对 JSON 配置做动态 SQL；
- View CRUD 与网格数据解耦。

Worker **仍校验** sort/filter JSON 合法性（写入 View 时），但不提供
`?viewId=` 服务端投影端点（v1）。若未来人数上千，再加
`GET /api/w/:wid/table-rows?viewId=`。

---

## Filter Semantics

```ts
type FilterOperator =
  | "eq" | "neq"
  | "contains" | "not_contains"  // text / select only
  | "gt" | "gte" | "lt" | "lte"  // number / date
  | "is_empty" | "is_not_empty"
  | "in";                        // select multi / tag-ids / person-ref multi

type ViewFilter = {
  key: ColumnKey;
  op: FilterOperator;
  // string | string[] | null — null only for is_empty / is_not_empty
  value?: string | string[] | null;
};

// View.filters: ViewFilter[]  — AND only in v1
```

### 按列类型允许的 op

| 列类型 | 允许 ops |
|--------|----------|
| text (builtin name/title, field text) | eq, neq, contains, not_contains, is_empty, is_not_empty |
| number | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty |
| date (createdAt/updatedAt, field date) | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty |
| boolean / isRoot | eq, neq, is_empty, is_not_empty |
| select | eq, neq, in, is_empty, is_not_empty |
| person-ref (manager*) | eq, neq, in, is_empty, is_not_empty（value = person id） |
| tags | `in`（value = tag id[]，**any** 命中）、is_empty, is_not_empty |
| avatarUrl | **不可筛选** |

- 过滤基于 **resolved value**（含 defaultValue）。
- `is_empty`：resolved 为「无值」（无 stored、无 default，或 stored `""`）。
- OR 组合、跨列 OR → v2。
- 非法 op / 类型不匹配 → 写 View 时 `400 VALIDATION_ERROR`；读网格时若历史数据
  因字段 type 变更变得非法 → 该 filter **跳过并 toast 警告**（不 500）。

**执行位置**：与 sort 相同，**客户端** AND 链。

---

## Stale Columns

当用户删除某个 `custom_field_definitions` 行时：

1. DB **不**级联改 `person_table_views.columns_json`（JSON 无 FK）。
2. 网格渲染时：
   - 识别 `field:<id>` 在 defs 中不存在 → 列头显示 `Missing field`，单元格全 `—`，
     列头带 warning icon；
   - View 编辑器打开时列出 stale keys，提供 **Remove stale columns** 一键清理。
3. **不在 DELETE field 时静默 rewrite 所有 views**（避免隐藏副作用；用户可见修复）。

可选后续（非 v1 必须）：DELETE field 后 `waitUntil` 扫 views 清理 —— 本 spec **不做**。

---

## Seed Default View

**触发**：`POST /api/workspaces` 成功创建 workspace（与 seed root person 同一事务或紧随
其后的 batch）时，插入一条 default view：

| 字段 | 值 |
|------|-----|
| name | `Default` |
| columns | `["builtin:name","builtin:title","builtin:managerId"]` |
| sort | `null`（UI 用 name ASC） |
| filters | `[]` |
| is_default | `1` |
| sort_order | `0` |

**已有 workspaces 迁移**：migration `0008` 末尾用 SQL 为每个尚无 view 的 workspace
插入同样的 Default（`INSERT … SELECT` from workspaces left join）。保证老数据打开
`/table` 不空白。

**删除 default**：

- `DELETE` 若目标 `is_default=1` 且 workspace 内还有其他 view → `400 CANNOT_DELETE_DEFAULT`
  （须先把 default 让给别人）；
- 若是唯一一个 view → 也禁止删除（workspace 始终至少保留 1 个 view）；
- 提供 `PUT …` 设 `isDefault: true`：事务内把旧 default 置 0、新 default 置 1。

---

## API

Hono sub-app 挂载：`/api/w/:wid/table-views`（名称避免与 HTML table 概念混淆；
URL 用 `table-views` 强调 View 资源）。

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | 列出 workspace 下所有 views（按 `sort_order`） |
| POST | `/` | 创建 view |
| GET | `/:id` | 单个 view |
| PUT | `/:id` | 更新 name / columns / sort / filters / isDefault / sortOrder |
| DELETE | `/:id` | 删除（受 §Seed 约束） |
| PUT | `/:id/default` | 显式设为 default（可选；也可并入 PUT body） |

**不新增** rows 投影 API（v1）。网格数据复用：

| 已有端点 | 用途 |
|----------|------|
| `GET /api/w/:wid/persons` | 行实体 + tags |
| `GET /api/w/:wid/fields` | 列元数据 |
| `GET /api/w/:wid/fields/values` | bulk 单元格值 |

### Request / Response shapes

```ts
// shared
interface PersonTableView {
  id: string;
  workspaceId: string;
  name: string;
  columns: ColumnKey[];      // parsed from columns_json
  sort: ViewSort;            // null → JSON null
  filters: ViewFilter[];
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// POST body
createPersonTableViewSchema = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(columnKeySchema).min(1).max(64),
  sort: viewSortSchema.nullable().optional(),
  filters: z.array(viewFilterSchema).max(32).optional().default([]),
  isDefault: z.boolean().optional().default(false),
});

// PUT body — all optional partial
updatePersonTableViewSchema = createPersonTableViewSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
```

**POST/PUT 校验规则**：

1. `columns` 必须包含 `builtin:name`。
2. `columns` 内 key **唯一**（禁止同一 field 两列）。
3. 每个 `field:<uuid>` 必须存在于该 workspace 的 definitions（创建/更新时严格校验；
   已删除字段不能 **新写入**，但 GET 仍返回历史 stale —— 见下条）。
4. GET 返回的 `columns` **原样**包含 stale keys（便于 UI 提示）；不在 GET 时静默过滤。
5. `sort.key` 若非 null，必须 ∈ columns 且列可排序。
6. 每个 filter：`key` 建议 ∈ columns（**v1 强制 ∈ columns**，避免「筛了看不见的列」困惑）。
7. `isDefault: true` 时 batch 清除其他 default。

### Error codes

| code | when |
|------|------|
| `VALIDATION_ERROR` | Zod / column rules |
| `NOT_FOUND` | view id |
| `DUPLICATE_NAME` | UNIQUE name |
| `CANNOT_DELETE_DEFAULT` | 删 default 或删最后一条 |
| `UNKNOWN_FIELD` | columns 引用不存在的 field def |
| `INVALID_SORT` | 不可排序列 |
| `INVALID_FILTER` | op/类型不匹配 |

### clip.yaml / CLI

- 在 `clip.yaml` 增加 `table-views-*` 命令（list/create/get/update/delete），与
  tags/fields 同级，走 `api.bogo.hexly.ai`。
- `gate:clip-yaml` 必须继续绿。
- CLI 不负责渲染网格；只管理 View 配置。

---

## UI

### Navigation

`AppSidebar` `WORKSPACE_ITEMS` 增加第三项：

```
Documents  → /documents
People     → /people
Table      → /table          // 文案：Table（或「表格」若日后 i18n）
```

Icon 建议：`Table2`（lucide）。Overview 快捷入口 **非必须**。

### Routes

| Path | Page |
|------|------|
| `/table` | `TablePage` — 当前 default view，或 `?view=<id>` |
| 无独立 `/table/:id/edit` | 配置用 page 内 Drawer / Dialog |

`App.tsx` 注册路由；`gate:pages` 覆盖新 page。

### TablePage 布局

```
┌─────────────────────────────────────────────────────────┐
│ [View switcher ▾]  [Configure]  [New view]   filter chips │
├─────────────────────────────────────────────────────────┤
│ name ▼ │ title │ manager │ Department │ Level │ …        │
├─────────────────────────────────────────────────────────┤
│ Alice  │ Eng   │ —       │ Platform   │ L5    │          │
│ Bob    │ PM    │ Alice   │ —          │ L4    │          │
│ …      │       │         │            │       │          │
└─────────────────────────────────────────────────────────┘
│ N people (M filtered)              empty / loading states │
```

**交互**：

1. **View switcher**：列出全部 views，default 带星标；切换写 URL `?view=`。
2. **Configure**：打开列选择器（checkbox 列表：builtin 分组 + custom 分组）+
   拖拽排序；保存 PUT view。
3. **列头点击**：切换该列 sort（asc → desc → clear）；不可排序列无 affordance。
4. **Filter bar**：Add filter → 选列 → 选 op → 值控件（按类型）；chips 可移除。
   变更可 **防抖 PUT** 持久化到当前 view（workspace 共享，符合拍板），或
   「Apply」按钮显式保存 —— **推荐显式 Save filters**，避免误触改共享配置。
   - 列/名/default：Configure 内 Save。
   - sort：列头点击后 **立即 PUT**（单字段，可预期）。
   - filters：编辑 draft → **Save filters** 按钮提交（防误改共享 view）。
5. **行点击**：`navigate` 到 `/people` 并选中该人，或打开只读 popover 链到 People。
   - **推荐**：行点击 → 打开与 People 相同的 `EditPersonPanel`（只读提示可后置），
     保持「编辑入口唯一在 panel」；不强制路由跳转。
6. **空状态**：无 people → CTA「Go to People」；无列（不应发生）→ 恢复 Default columns。

### MVVM 分层

```
packages/ui/src/
├── models/
│   └── table-view.model.ts       # React Query: list/create/update/delete
├── viewmodels/
│   └── table/
│       ├── use-table-views.ts    # view CRUD + selection
│       ├── use-table-grid.ts     # join persons + defs + values → rows
│       ├── resolve-cell.ts       # pure: cell resolution
│       ├── apply-sort-filter.ts  # pure: sort + AND filters
│       └── column-catalog.ts     # builtin metadata
├── components/
│   └── table/
│       ├── TableGrid.tsx
│       ├── TableViewSwitcher.tsx
│       ├── TableColumnConfig.tsx
│       ├── TableFilterBar.tsx
│       └── TableCell.tsx
└── pages/
    └── TablePage.tsx
```

规则与 `05-ui-mvvm-architecture.md` 一致：page 不直接 fetch；pure helpers 可单测。

### 列宽

v1：CSS `table-layout: auto` + min-width；用户拖拽列宽 **仅 localStorage**
（key：`bogo.table.colwidth.<viewId>`），不进 D1。

### 无障碍

- `<table>` + 正确 `<th scope="col">`；
- sort 按钮 `aria-sort`；
- filter 控件可键盘操作；
- 行点击同时提供可见「Open」按钮（不只靠整行 click）。

---

## Data Loading Strategy

```
parallel:
  personsQuery(wid)
  fieldDefsQuery(wid)
  fieldValuesQuery(wid)   // existing bulk GET /fields/values
  tableViewsQuery(wid)
→ useTableGrid(view, persons, defs, values)
    → resolve rows
    → apply filters (AND)
    → apply sort
    → return { rows, total, filteredCount }
```

**规模假设**：≤ 500 persons、≤ 64 columns、≤ 32 filters。超出时 UI 仍工作但
可显示性能提示；不在 v1 做 windowing 除非 L3 测到卡顿。

---

## Workspace Create Hook

修改 `packages/worker/src/routes/workspaces.ts`（或等价 create 路径）：

在插入 workspace + root person 的同一 `DB.batch` 中插入 Default `person_table_views`
行。失败则整批回滚，避免「有 workspace 无 default view」。

---

## Project Structure (New / Modified)

```
docs/features/
  05-people-table-views.md          # 本文档
  README.md                         # 索引

packages/shared/src/schemas/
  table-view.ts                     # NEW
  index.ts                          # export

packages/worker/
  migrations/0008_person_table_views.sql
  src/routes/table-views.ts         # NEW
  src/routes/table-views.test.ts
  src/routes/workspaces.ts          # seed default view
  src/index.ts                      # mount route
  test/e2e/…                        # L2 coverage

packages/ui/src/
  App.tsx, AppSidebar.tsx
  pages/TablePage.tsx
  models/table-view.model.ts
  viewmodels/table/*
  components/table/*

clip.yaml                           # table-views commands
scripts/check-route-coverage.ts     # 自动扫到新 route
scripts/check-page-coverage.ts      # 新 page
```

---

## Testing Strategy

| Layer | 覆盖 |
|-------|------|
| L1 shared | columnKey / create/update schemas；非法 key、缺 name 列 |
| L1 worker | CRUD、default 唯一、不能删最后 view、UNKNOWN_FIELD、seed on workspace create、migration backfill 逻辑（若用测试 DB） |
| L1 ui | `resolve-cell` default/muted；`apply-sort-filter` 各类型；stale column 标记 |
| L2 | table-views CRUD E2E；workspace create → 自带 default view |
| L3 | `/table` smoke：切换 view、列配置保存后刷新仍在 |
| G1 | typecheck + biome |
| clip | `gate:clip-yaml` 含新命令 |

### 6DQ（实施时勾选）

| 维 | 关注点 |
|----|--------|
| Correctness | default 唯一；强制 name 列；filter AND；resolved vs stored |
| Isolation | workspace 级 FK / wid guard |
| UX | 共享 view 误改（filters 显式 Save）；stale field 可见 |
| Perf | 四请求并行；无 N+1 |
| A11y | table semantics + aria-sort |
| Regression | workspace create batch、persons/fields 既有 E2E 不破 |

---

## Boundaries

### Always Do

- View 只存配置，不存单元格副本
- `builtin:name` 必在 columns
- JSON 经 Zod 再入库；`updated_at` 每次 UPDATE 显式刷新
- workspace 删除 CASCADE views
- 新 workspace 与 backfill 都保证 ≥1 default view

### Ask First

- 行点击是开 EditPersonPanel 还是跳转 `/people`（本 spec **推荐 panel**，review 可改）
- View 名是否允许 rename 成与已删除历史冲突（UNIQUE 现存名）
- filters 是否要「个人临时覆盖不写库」（会破坏 workspace 共享语义，**默认不**）

### Never Do

- v1 内联编辑单元格
- 无校验写入 columns_json
- 在 DELETE field 时静默改写全部 views
- 用 PATCH（与项目一致用 PUT）
- 把 table view 做成 localStorage-only（与拍板冲突）

---

## Implementation Order（原子提交友好）

每步对应 **1 个 git commit**（可再拆，不可更大杂烩）：

| Step | Commit message 方向 | 内容 |
|------|---------------------|------|
| 0 | `docs: add people table views feature spec` | 本文档 + features README 索引 |
| 1 | `feat(shared): add person table view schemas` | Zod + types |
| 2 | `feat(worker): migration person_table_views + backfill` | 0008 SQL |
| 3 | `feat(worker): table-views CRUD routes` | Hono + L1 tests |
| 4 | `feat(worker): seed default table view on workspace create` | workspaces.ts batch |
| 5 | `test(worker): L2 e2e table-views` | e2e |
| 6 | `feat(ui): table-view model + grid pure helpers` | model + resolve/sort/filter |
| 7 | `feat(ui): TablePage shell + sidebar nav` | route + 空壳 + 列表 |
| 8 | `feat(ui): column config + view switcher` | Configure / CRUD UI |
| 9 | `feat(ui): sort + filter bar` | 交互 + 持久化策略 |
| 10 | `feat(cli): clip.yaml table-views commands` | clip + gate |
| 11 | `test(ui): L3 smoke /table` | playwright |

Step 0 = 本文档 review 通过前的唯一提交；**代码步等文档 LGTM 后再开**。

---

## Key Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 资源形态 | 命名 View 配置表，非行数据表 | 单一数据源，避免双写 |
| 列引用 | `builtin:*` / `field:<uuid>` 字符串 | 可序列化、可校验、易 CLI |
| 强制 name 列 | 是 | 表格行必须可识别 |
| sort/filter 执行 | 客户端 | 复用 bulk API，D1 免动态 SQL |
| 共享编辑 | workspace 级 + filters 显式 Save | 符合拍板，降低误触 |
| 字段删除 | stale 可见，不静默 rewrite | 可预期、可恢复 |
| 默认 View | 创建 + backfill | `/table` 永远有可用配置 |
| 导航 | 侧栏平级 `/table` | 第三主功能信息架构 |
| 编辑 | 不进表格 | 控制 v1 范围，复用 EditPersonPanel |

---

## Open Questions（请 review 时拍板）

1. **侧栏文案**：`Table` vs `Grid` vs `People Table`？
2. **行点击**：本 spec 推荐打开 `EditPersonPanel`；是否改为跳转 `/people?person=`？
3. **default 视图名**：固定 `Default` 还是 `All people`？
4. **manager 列排序**：按 **resolved 姓名** 还是按 **person id**？推荐姓名。
5. **v1 是否在 clip 同步上线**：推荐是（与 API 同 PR 计划），若想先 UI 可把 Step 10 后置。

---

## Alternatives Considered

| 方案 | 弃因 |
|------|------|
| localStorage-only 列配置 | 不符 workspace 共享与第三主功能体量 |
| `GET /table-rows?viewId=` 服务端投影 | v1 人数不需要；增加 SQL 复杂度 |
| 每列一行 `person_table_view_columns` | 过度规范化；排序/筛选仍要 JSON 或更多表 |
| 内联编辑 v1 | 范围膨胀；与 People panel 双入口 |
| People 页 Tab 而非侧栏入口 | 与「第三主功能」拍板不符 |

---

## PR Plan

| PR | 标题 | 依赖 | 说明 |
|----|------|------|------|
| PR0 | docs: people table views spec | — | 本文档 review |
| PR1 | shared + migration + table-views API | PR0 | Steps 1–5 |
| PR2 | UI TablePage MVP（只读网格 + switcher + column config） | PR1 | Steps 6–8 |
| PR3 | sort/filter + L3 + clip.yaml | PR2 | Steps 9–11 |

每个 PR 保持可部署；PR1 单独 merge 时 UI 未入口也无害（仅 API）。

---

## References

- 实体与字段：`docs/architecture/01-entity-relationship.md`
- API 风格：`docs/architecture/03-system-architecture.md`
- MVVM：`docs/architecture/05-ui-mvvm-architecture.md`
- 标签规格（结构范本）：`docs/features/01-tag-system-spec.md`
- 现有 bulk values：`GET /api/w/:wid/fields/values`（`packages/worker/src/routes/fields.ts`）
- Org chart 字段展示：`showOnChart`（互补：chart 选「少数字段」，table 选「多列扫描」）
