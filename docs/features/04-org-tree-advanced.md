# SPEC: Org Tree Advanced Interactions

## Objective

在 People 页面的组织架构图（`PersonTree`）上，把 **拖拽**、**折叠 / 展开子树**、**画布导航**
三类高级交互做到"跟主流 OrgChart 工具（Miro、Notion、Linear team tree）对齐"的水准。
实现方式限定：**充分利用 `@xyflow/react` v12 原生能力**，不引入新组件库。

**Target users**: Workspace admins（一次管数十到数百人的经理），需要在同一画布上
既能看到全局架构，又能钻进某个子树、把某个成员挂到新经理下。

**Scope**: 纯前端 UI + 客户端持久化。零后端改动、零 DB 迁移、零 API 变更。

## Non-Goals

- 不改数据模型（`persons` 表、`managerId` / `dottedManagerId` / `sortOrder` 保持不变）。
- 不做 dotted-line 汇报关系的折叠语义（保持当前的实线渲染，见 §Behavior/Collapse）。
- 不做服务端同步的折叠偏好（v1 只 localStorage，见 §Persistence）。
- 不改现有 `persons-move` API 契约（Person Move 依旧走 `PUT /api/w/:wid/persons/:id/move`）。
- 不做键盘可访问的整棵树导航（Tab / Arrow keys 遍历节点）—— 6DQ Accessibility 项显式记为
  已知欠账，见 §6DQ。

## Feature Set (哥 2026-07-04 拍板)

| # | 能力 | 说明 |
|---|------|------|
| 1 | **折叠 / 展开子树** | 每个有下属的节点右下角一个 chevron chip；点击折叠该人整条下属子树；chip 上叠加隐藏子孙的 `Nₕ` 计数。基础项。 |
| 2 | **拖拽体验强化** | 从节点底部 `source` handle 拉线 → 拖到目标节点顶部 `target` handle → 松手 = 把源挂到目标下（等价 `persons-move`）。保留现有的"整个节点拖到附近就吸附"作为备用交互。 |
| 3 | **Minimap 与画布快捷键** | 右下角新增 `<MiniMap />`；`f` = fitView、`+` / `-` = zoom in/out、`0` = reset zoom 1.0。 |

优先级：**折叠 > 拖拽强化 > Minimap/快捷键**（后两项可分独立 PR，不阻塞前一项 ship）。

## Behavior

### Collapse / Expand

**术语**：
- `descendants(pid)` = 通过 solid `managerId` 链能到达的所有子孙 person id 集合（含直接与间接）。
- `hiddenCount(pid)` = 若 `pid` 处于折叠态，则等于 `descendants(pid).size`；否则 = 0。
- `visibleSet` = 全体 persons 中，"不存在任一祖先处于折叠态"的那些人。

**规则**：
1. `hasReports(pid) = descendants(pid).size > 0`。只有 `hasReports` 为真时，节点右下角才显示
   chevron chip；否则完全不渲染，避免视觉噪音。
2. Chip 内部：折叠态显示 `▶ N`，展开态显示 `▼`（不显示数字，因为已经全部展开可数）。
3. 点击 chip 只切换本人折叠状态，**不冒泡**到卡片的 `onClick`（避免同时触发 select）。
4. Layout 仅对 `visibleSet` 跑 Dagre，被折叠掉的子孙**不参与位置计算**，画布不会留空白。
5. Dotted-line：`dottedManagerId` 汇报关系**不参与折叠计算**（不视为 reports）；如果 dotted 源
   或目标恰好落在被折叠子树内被剪掉，那条 edge 一并不渲染。**边不会悬空**。
6. 当被 select 的 person 因折叠而进入不可见集合时，自动清空 selection（`selectPerson(null)`），
   同时关闭右侧 EditPanel、时间线面板，避免"孤儿面板"。

**Batch 操作**（v1 就纳入，因为只多两行 handler）：
- Toolbar 上一个 `Collapse all` 按钮：折叠所有 `hasReports` 节点。
- Toolbar 上一个 `Expand all` 按钮：清空 `collapsedIds`。

### Drag 强化

现状：`onNodeDragStop` 用 `findDropTarget` 就近吸附，容易误触（拖着走到中途松手会意外落到最近
的人下面）。**方案 A**（本次采用）：

1. 保留 `nodesDraggable={true}` 用于纯粹的位置微调（松手时如果落点在 threshold 外，不触发 move）。
2. 打开 `nodesConnectable={true}`，从节点 bottom `source` handle 拉出连线到目标 top `target`
   handle 时，触发 `onConnect(source, target)` → 调 `vm.move(target, source)`（source 是新 manager，
   target 是被 move 的人）。
   - 拉线过程中 ReactFlow 原生会画预览线，用户视觉反馈明确。
   - `isValidConnection` 过滤掉：连到自己、连成环、连到当前已有的 manager（no-op）。
   - Handle 只在 hover / drag 中的节点上高亮（`className="!bg-primary !w-3 !h-3"`
     + CSS `.react-flow__handle` opacity transition），空闲时半透明，不干扰阅读。
3. 保留 `handleNodeDragStop` 的就近吸附作为**兼容路径**，但 threshold 收紧到 60px（当前 100px），
   降低误触。

**Root 保护**：`onConnect` 与 `handleNodeDragStop` 共用 `vm.canMove(id)` 判定：`person.isRoot`
或会成环时拒绝并 `setDropError`。

### Minimap 与画布快捷键

1. `<MiniMap pannable zoomable position="bottom-right" />`，节点色使用 `data.person.isRoot ?
   'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'`。
2. 快捷键在 `PersonTree` 内挂 `useKeyPress`（React Flow v12 hook），仅在画布 focused 时生效
   （避免和输入框冲突）：
   - `f` → `fitView({ padding: 0.15, duration: 300 })`
   - `+` / `=` → `zoomIn({ duration: 200 })`
   - `-` → `zoomOut({ duration: 200 })`
   - `0` → `setViewport({ x, y, zoom: 1 }, { duration: 200 })`

## State Model (client-side)

新增两个客户端状态，都住在 `usePersonTree` 里：

```ts
interface CollapseState {
  collapsedIds: Set<string>;        // person ids that are collapsed
  toggleCollapse: (id: string) => void;
  collapseAll: () => void;          // adds every hasReports pid
  expandAll: () => void;            // clears the set
}
```

派生量（`useMemo`）：

```ts
descendantsMap: Map<string, Set<string>>    // 一次 DFS 构好
visibleSet: Set<string>                     // 剪掉所有『祖先在 collapsedIds』的人
hiddenCountOf: (id) => number               // O(1)，来自 descendantsMap
hasReports:   (id) => boolean               // O(1)
```

**Layout 契约**：`computeTreeLayout` 签名扩展为：

```ts
computeTreeLayout(
  persons: Person[],
  opts?: { visibleSet?: Set<string>; hiddenCountOf?: (id: string) => number }
): { nodes: PersonNode[]; edges: PersonEdge[] }
```

- 若 `visibleSet` 传入，只对该集合建图；`hiddenCountOf` 把 count 塞进 `node.data.hiddenCount`，
  `PersonNode` 据此渲染 chip 上的数字。
- 未传时行为与今天完全一致（向后兼容 —— 老的测试无需改）。

## Persistence

**Key 格式**：`bogo:orgTree:collapsed:${userEmail}:${workspaceId}` — JSON `string[]`。

- `userEmail` 来自 `useUserInfo()`，未登录时不持久化（用内存 Set）。
- `workspaceId` 来自 `useWorkspaceContext()`；切换 workspace 时读取对应 key。
- 写入时机：`toggleCollapse` / `collapseAll` / `expandAll` 后 debounced 300ms。
- 读取时机：`workspaceId` 或 `userEmail` 变更时同步读一次。
- 迁移策略：无。key 变动只会导致老状态丢失（回落到全展开），无破坏性。
- 陈旧数据：不做主动清理（IDs 引用不存在的 person 时 `visibleSet` 计算自动无视）。

## Project Structure

### 新增

```
packages/ui/src/viewmodels/person/
  use-collapse-state.ts               (+ .test.ts)   → collapse state + persistence
  descendants-map.ts                  (+ .test.ts)   → 纯函数：Person[] → descendantsMap
packages/ui/src/hooks/
  use-canvas-shortcuts.ts             (+ .test.ts)   → f / + / - / 0 快捷键
packages/ui/src/components/person/
  PersonTreeToolbar.tsx               (+ .test.tsx)  → Add / Collapse all / Expand all / Fit
```

### 修改

```
packages/ui/src/viewmodels/person/person-tree-layout.ts
  ↳ computeTreeLayout 支持 visibleSet + hiddenCountOf；旧签名向后兼容
  ↳ findDropTarget threshold 100 → 60；nodes 参数由外部限定为 visibleSet
packages/ui/src/viewmodels/person/use-person-tree.ts
  ↳ 组合 use-collapse-state、descendants-map；导出 collapse API + canMove()
packages/ui/src/components/person/PersonNode.tsx
  ↳ 右下角 chevron chip（有 reports 时）；handle hover 高亮 CSS
packages/ui/src/components/person/PersonTree.tsx
  ↳ nodesConnectable={true} + onConnect + isValidConnection
  ↳ <MiniMap /> + useCanvasShortcuts
  ↳ 顶部左侧 <PersonTreeToolbar />（替换现在的 Add 按钮）
  ↳ selected person 若跌出 visibleSet，effect 里 selectPerson(null)
```

### 不改

- `packages/shared/**`（无 schema 变化）
- `packages/worker/**`（API 契约不变）
- `packages/cli/**`（生成配置不动）
- `packages/ui/src/lib/api/persons.ts`（无新增端点）

## Code Style

- 遵循 `docs/architecture/09-css-conventions.md`：Tailwind + `hsl(var(--…))` token；不写自定义
  CSS 文件（handle hover 用 utility 组合 + `data-*` selector）。
- Chevron chip 尺寸固定 `h-5 min-w-[20px] px-1`，用 `lucide-react` 的 `ChevronDown` / `ChevronRight`，
  颜色 `text-muted-foreground`。
- Collapse state 用 `Set<string>` 作为 source of truth；对外暴露 API 时不返回可变引用（返回
  `readonly` 视图或用 selector 读）。
- `use-collapse-state` 只做状态 + 持久化；descendants 计算独立文件、纯函数、可单测。
- 遵循 MVVM（`docs/architecture/05-ui-mvvm-architecture.md`）：所有业务判定（`hasReports`、`canMove`、
  `visibleSet`）住 viewmodel，组件只读 props。
- TS：`Set<string>` 用 `ReadonlySet<string>` 从 vm 传出，避免消费方误 mutate。

## Testing Strategy

对齐 `docs/architecture/08-ui-test-strategy.md` 的 L1（Vitest 单测）+ L3（Playwright E2E）。

### L1 单测（新增）

- `descendants-map.test.ts`：
  - 空数组 → 空 map
  - 线性链（A→B→C）：`descendants(A) = {B,C}` / `descendants(B) = {C}`
  - 多分支：正确聚合
  - `dottedManagerId` **不** 计入 descendants（关键回归点）
- `use-collapse-state.test.ts`：
  - toggle 幂等：连点两次回到初始
  - collapseAll 只加 `hasReports` 的 pid（叶子节点不进 set）
  - persistence：mock localStorage，read/write/roundtrip；无 userEmail 时不写
  - workspace 切换时读对应 key
- `person-tree-layout.test.ts`（补充用例）：
  - 传入 `visibleSet` 时，只对子集出 nodes，且 edge 被剪时不出悬空 edge
  - `hiddenCountOf` 塞进 `node.data.hiddenCount`
  - 老签名（不传 opts）行为与迁移前一致
- `use-canvas-shortcuts.test.ts`：
  - `f/+/-/0` 分别触发对应 ReactFlow API（mock instance）
  - focus 在 input 时不触发
- `PersonNode.test.tsx`（补充）：
  - `hiddenCount > 0` 时 chip 显示数字与 `▶`
  - `hiddenCount === 0 && hasReports` 时显示 `▼`
  - 无 reports 时无 chip
  - 点击 chip 触发 `onToggleCollapse`，且不冒泡到 card
- `PersonTree.test.tsx`（补充）：
  - selected person 被折叠隐藏后 selection 清空（用 rendered EditPanel 存在与否断言）
  - `onConnect` 会成环 → 拒绝 + setDropError
  - `onConnect` 目标 = 当前 manager → no-op

### L3 Playwright（新增）

`packages/ui/tests-e2e/people-tree-advanced.spec.ts`：

1. 页面加载 → 点击某个经理的 chevron chip → 期望其子孙 DOM 节点不再出现，chip 显示 `▶ N`。
2. Collapse all → Expand all round-trip → 节点数恢复。
3. 拖 handle 从 A 到 B → 期望 `persons-move` 网络请求被打出，且面板反映新 manager。
4. 按 `f` 键 → 视图 zoom & pan 到 fit（用 viewport transform DOM assertion）。

不涵盖：动画中间态、拖拽鼠标轨迹细节（浏览器实现差异大）。

### 通过门 (Gate)

- L1 覆盖率 ≥ 现有阈值（脚本 `scripts/check-coverage.sh` 兜底）。
- L3 全绿。
- G1 typecheck + biome 全过。

## Boundaries

### Always Do

- 折叠状态一律持久化到 `bogo:orgTree:collapsed:${userEmail}:${workspaceId}`。
- `computeTreeLayout` 的老签名（只传 `persons`）保持工作，不 break 现有调用与单测。
- `onConnect` / `onNodeDragStop` 触发 move 前必须过 `wouldCreateCycle` 与 root 保护。
- 所有键盘快捷键必须在 focused-in-input 时被跳过（现在的 Edit panel 有一堆 input）。

### Ask First (哥点头再动)

- 服务端持久化折叠偏好（新增表 / 用户偏好 API）。
- 折叠状态出现在 URL query string 中（分享链接场景）。
- 用 D&D 库（`@dnd-kit`、`react-dnd`）替换 ReactFlow handle 拖拽。
- 引入手势库、动画库、canvas 渲染。
- 修改 `persons` schema / API 契约。
- 把 dotted-line 纳入 descendants 计算。

### Never Do

- 直接 mutate `collapsedIds` Set 而不走 `toggleCollapse`。
- 在组件层实现业务判定（`hasReports` / `visibleSet` / `canMove` 必须在 vm）。
- 用节点内 `<button>` 触发折叠时忘了 `stopPropagation` 导致 select 同时触发。
- 引入除 React Flow / Dagre / lucide-react 外的第三方 UI 依赖。
- 用 `any` 或 `@ts-ignore` 绕类型（`Node<PersonNodeData>` 是既定契约）。

## Implementation Order (原子化提交计划)

每个 commit 都要能通过 pre-commit hook（L1 + G1），先 ship UI 骨架、再补交互，最后打磨。

| # | Commit (`fix/feat/refactor: ...`) | 内容 |
|---|-----------------------------------|------|
| 1 | `refactor(ui): extract descendants map from person list` | 新增 `descendants-map.ts` + 单测。老代码路径不变。 |
| 2 | `feat(ui): computeTreeLayout supports visibleSet + hiddenCount` | 扩签名向后兼容 + 补测。老单测不动。 |
| 3 | `feat(ui): collapse state hook with localStorage persistence` | `use-collapse-state.ts` + 单测（含 mock localStorage、无 email 内存回退）。 |
| 4 | `feat(ui): person node shows collapse chevron chip` | 修 `PersonNode` + 单测；`PersonTree` 尚未接线，仅 props 层准备好。 |
| 5 | `feat(ui): person tree wires collapse toggle` | `usePersonTree` 组合 collapse state；点击 chip 生效；selected person 被隐藏后自动清 selection。 |
| 6 | `feat(ui): tree toolbar with collapse all / expand all / fit` | 新增 `PersonTreeToolbar` 替换现在的 Add 按钮。 |
| 7 | `feat(ui): connect-handle move flow` | 打开 `nodesConnectable`、`onConnect`、`isValidConnection`；drop threshold 收紧到 60px。 |
| 8 | `feat(ui): person tree minimap + canvas shortcuts` | `<MiniMap />` + `use-canvas-shortcuts`。 |
| 9 | `test(ui): playwright e2e for collapse & connect move` | 新增 `people-tree-advanced.spec.ts` L3 用例。 |
| 10 | `docs(features): mark 04-org-tree-advanced.md complete` | 更新本 spec 状态、README 索引状态列。 |

## 6DQ Quality Plan

| 维度 | 是否达标 | 备注 |
|------|---------|------|
| Functional | ✅ | 折叠 / 拖拽 / 快捷键 L1 + L3 覆盖 |
| Reliability | ✅ | localStorage 读失败降级到内存；folder 引用不存在 pid 时自动跳过 |
| Performance | ✅ | descendants DFS 一次；Layout 只对 visibleSet 跑；chip / handle 均 memoized |
| Security | ✅ | 无新数据面变化；localStorage key 命名带 `userEmail`，避免多用户串数据 |
| Maintainability | ✅ | vm/组件分层清晰；layout 老签名兼容；新增文件均带单测 |
| Accessibility | ⚠️ 部分 | chevron chip 加 `aria-expanded`、`aria-label="Collapse subtree of {name}"`。整棵树的键盘遍历（Tab/Arrow）**未做**，显式记为 v2 欠账。 |

## Out of Scope (v2 候选)

- 服务端同步折叠偏好（跨设备）。
- URL 中携带 `collapsed=` query 用于分享指定视图。
- 拖拽多选 / 批量 move。
- 树节点按 `sortOrder` 手动重排（今天 `sortOrder` 存在但 UI 未用）。
- 键盘完全可达：Tab 焦点顺序、Arrow keys 上下左右移动焦点、Space 触发折叠。
- 折叠状态动画（今天硬切换；动画留给 6DQ Delight 迭代）。

## Decisions（2026-07-04 哥拍板）

1. 高级功能范围 = 折叠 + 拖拽强化 + Minimap/快捷键（三选三）。
2. 折叠按钮位置 = 节点右下角 chevron chip（不是 hover 侧边浮动、也不是整卡点击）。
3. Dotted line **不** 参与 descendants 计算 —— 折叠只作用于实线汇报。
4. 折叠状态持久化到 localStorage，key 按 `(userEmail, workspaceId)` 隔离。

## References

- `docs/architecture/05-ui-mvvm-architecture.md` — MVVM 分层原则
- `docs/architecture/06-ui-component-decisions.md` — 组件取舍原则
- `docs/architecture/08-ui-test-strategy.md` — 6 层测试架构 + 6DQ
- `docs/architecture/09-css-conventions.md` — Tailwind + token 规范
- `docs/features/01-tag-system-spec.md` — Person tags（已被本页面渲染消费）
- [@xyflow/react v12 docs](https://reactflow.dev/api-reference) — `onConnect` / `isValidConnection` / `MiniMap` / `useKeyPress`
