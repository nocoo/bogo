# SPEC: Org Tree Advanced Interactions

## Objective

在 People 页面的组织架构图（`PersonTree`）上，交付两类高级交互：**折叠 / 展开子树**
与**画布导航（Minimap + 快捷键）**。实现方式限定：**充分利用 `@xyflow/react` v12 原生
能力**，不引入新组件库。

**Target users**: Workspace admins（一次管数十到数百人的经理），需要在同一画布上
既能看到全局架构，又能把无关的子树折叠掉、只聚焦当下关心的分支。

**Scope**: 纯前端 UI + 客户端持久化。零后端改动、零 DB 迁移、零 API 变更。

## Non-Goals

- 不改数据模型（`persons` 表、`managerId` / `dottedManagerId` / `sortOrder` 保持不变）。
- **不做通过拖拽 / handle 连线来修改 manager 关系**。改经理只走 `EditPersonPanel` 的下拉框
  （已存在），本 spec 里 `PersonTree` 的 drag 行为退回"纯视觉调整节点位置"，不触发
  任何 API。见 §Behavior/Drag。
- 不做 dotted-line 汇报关系的折叠语义（保持当前的虚线 edge 渲染 —— 见
  `packages/ui/src/viewmodels/person/person-tree-layout.ts` 中 `strokeDasharray: "5 5"` —— 与
  §Behavior/Collapse 的剪枝规则）。
- 不做服务端同步的折叠偏好（v1 只 localStorage，见 §Persistence）。
- 不改现有 `persons-move` API 契约（Person Move 依旧走 `PUT /api/w/:wid/persons/:id/move`，
  UI 触发点只有 EditPanel）。
- 不做键盘可访问的整棵树导航（Tab / Arrow keys 遍历节点）—— 6DQ Accessibility 项显式记为
  已知欠账，见 §6DQ。

## Feature Set (哥 2026-07-09 拍板)

| # | 能力 | 说明 |
|---|------|------|
| 1 | **折叠 / 展开子树** | 每个有下属的节点右下角一个 chevron chip；点击折叠该人整条下属子树；chip 上叠加隐藏子孙的 `Nₕ` 计数。基础项。 |
| 2 | **Minimap 与画布快捷键** | 右下角新增 `<MiniMap />`；`f` = fitView、`+` / `-` = zoom in/out、`0` = reset zoom 1.0。 |

优先级：**折叠 > Minimap/快捷键**（后者可独立 PR，不阻塞前者 ship）。

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

### Drag（仅视觉调整，不改数据）

现状：`PersonTree` 有 `nodesDraggable={true}` + `onNodeDragStop` 触发的"就近吸附改经理"逻辑，
本 spec **移除该数据变更行为**。

本 spec 完成后的 drag 行为：
1. `nodesDraggable={true}` 保留 —— 用户仍可以拖动节点，但仅调整**画布上的视觉位置**。
2. `onNodeDragStop` 不再调用 `vm.handleDrop`，也不再 wire 任何 mutation。默认不 wire 该 handler。
3. `vm.handleDrop`、`dropError`、`clearDropError`、`findDropTarget`、`wouldCreateCycle` 这套
   函数与状态一并**从当前 vm / layout 中移除**（保留在 git 历史里，本 spec 之后不再有代码
   依赖它们）。
4. 移经理的唯一 UI 路径 = `EditPersonPanel` 的 Manager `<select>` 下拉框（今天已经工作）。

**已知 trade-off**：Dagre 每次 `persons` 数据变化都会重算所有节点位置，用户手工挪动的位置
在下次 layout 触发时会被覆盖。这是 v1 接受的行为 —— 如果需要"记住手工位置"，属于 v2 议题
（Out of Scope），可能需要引入用户自定位置存储或切到 free-form 布局。

### Minimap 与画布快捷键

1. `<MiniMap pannable zoomable position="bottom-right" />`，节点色使用 `data.person.isRoot ?
   'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'`。
2. 快捷键**不得使用** `@xyflow/react` 的 `useKeyPress`。原因：
   - v12 的实现（`node_modules/@xyflow/react/dist/esm/index.mjs`，`function useKeyPress`）
     其 effect 依赖为 `[keyCode, setKeyPressed]`，`options.target` **不在依赖里**；首次
     render 时 `wrapperRef.current === null` → `target` 回退成 `document`；ref 后来指到
     DOM 也不会重新绑定。结果就是全局监听 `document`。
   - `preventDefault()` 发生在 handler 顶部（matcher 判断之后立即调用），在 handler 里
     再做 `document.activeElement` containment guard 已经太晚，键仍会被吞。
3. 实现约束（选下面 A 或 B 其一，实施 PR 里必须显式选一个）：
   - **A（推荐）**：`use-canvas-shortcuts.ts` 内 `useEffect` 里直接对 wrapper element 绑
     原生 `keydown`（无需 `keyup` —— 这些快捷键都是 fire-and-forget）。wrapper 元素
     由 `PersonTree` 通过 `ref` 拿到并作为参数传入；effect 依赖含 `[wrapperEl, handlers…]`，
     `wrapperEl` 为 `null` 时**不绑**、也**不回退到 document**。wrapper 必须 `tabIndex={0}`
     以便可 focus。
   - **B**：把快捷键逻辑拆到独立子组件 `<CanvasShortcuts wrapper={wrapperEl} />`，只有当
     `wrapperEl` 非空才 mount 该子组件，把稳定的 `HTMLElement` 传进去；子组件内部同样
     `useEffect` + 原生 `addEventListener` 绑到该元素。
4. 键位：
   - `f` → `fitView({ padding: 0.15, duration: 300 })`
   - `+` / `=` → `zoomIn({ duration: 200 })`
   - `-` → `zoomOut({ duration: 200 })`
   - `0` → `zoomTo(1, { duration: 200 })`（reset zoom 到 1，pan 保留当前值）
5. 输入元素豁免：handler 内以 `event.target` 判定，如是 `<input>` / `<textarea>` /
   `contenteditable` 直接 `return`（不 `preventDefault`）。这一步和 §3 的 wrapper 绑定
   互补 —— 即使有人把输入框放进 wrapper 内，也不会被吞键。

## State Model (client-side)

新增一个客户端状态，住在 `usePersonTree` 里：

```ts
interface CollapseState {
  collapsedIds: ReadonlySet<string>;  // person ids that are collapsed; readonly view (see §Code Style)
  toggleCollapse: (id: string) => void;
  collapseAll: () => void;            // adds every hasReports pid
  expandAll: () => void;              // clears the set
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
  ↳ 移除 findDropTarget、wouldCreateCycle（不再有调用者）
packages/ui/src/viewmodels/person/use-person-tree.ts
  ↳ 组合 use-collapse-state、descendants-map；导出 collapse API
  ↳ 移除 handleDrop、dropError、clearDropError（拖拽不再改经理）
packages/ui/src/components/person/PersonNode.tsx
  ↳ 右下角 chevron chip（有 reports 时）
  ↳ 移除 GripVertical 图标（曾提示可拖动改经理，现无此语义）
packages/ui/src/components/person/PersonTree.tsx
  ↳ 移除 onNodeDragStop wire、getNodeCenter helper、dropError UI
  ↳ 保留 nodesDraggable={true}（纯视觉位置调整，不 wire handler）
  ↳ <MiniMap /> + useCanvasShortcuts
  ↳ 顶部左侧 <PersonTreeToolbar />（替换现在的 Add 按钮）
  ↳ selected person 若跌出 visibleSet，effect 里 selectPerson(null)
```

### 不改

- `packages/shared/**`（无 schema 变化）
- `packages/worker/**`（API 契约不变）
- `packages/cli/**`（生成配置不动）
- `packages/ui/src/lib/api/persons.ts`（无新增端点）
- `packages/ui/src/components/person/EditPersonPanel.tsx`（Manager `<select>` 已是改经理的
  正规路径，不动）

## Code Style

- 遵循 `docs/architecture/09-css-conventions.md`：Tailwind + `hsl(var(--…))` token；不写自定义
  CSS 文件。
- Chevron chip 尺寸固定 `h-5 min-w-[20px] px-1`，用 `lucide-react` 的 `ChevronDown` / `ChevronRight`，
  颜色 `text-muted-foreground`。
- Collapse state 用 `Set<string>` 作为 source of truth；对外暴露 API 时不返回可变引用（返回
  `readonly` 视图或用 selector 读）。
- `use-collapse-state` 只做状态 + 持久化；descendants 计算独立文件、纯函数、可单测。
- 遵循 MVVM（`docs/architecture/05-ui-mvvm-architecture.md`）：所有业务判定（`hasReports`、
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
  - 删除原来关于 `findDropTarget`、`wouldCreateCycle` 的用例（函数已被移除）
- `use-canvas-shortcuts.test.ts`：
  - `f/+/-/0` 分别触发对应 ReactFlow API（mock instance）
  - focus 在 `<input>` / `<textarea>` / `contenteditable` 上时不触发
  - **首次 render 时 wrapper ref 为 `null`**：不得对 `document` 绑 keydown 监听
    （用 `document.addEventListener` spy 断言 `expect(spy).not.toHaveBeenCalledWith('keydown', ...)`）。
    这是禁用 `useKeyPress` 之后的核心回归点。
  - **focus 在画布容器之外**（sidebar、空白页面区域、body 上无节点时）**不触发** ——
    直接 dispatch `KeyboardEvent` 到 `document.body`（而非 wrapper），断言 ReactFlow API 未被调用。
- `PersonNode.test.tsx`（补充）：
  - `hiddenCount > 0` 时 chip 显示数字与 `▶`
  - `hiddenCount === 0 && hasReports` 时显示 `▼`
  - 无 reports 时无 chip
  - 点击 chip 触发 `onToggleCollapse`，且不冒泡到 card
- `PersonTree.test.tsx`（补充 / 调整）：
  - selected person 被折叠隐藏后 selection 清空（用 rendered EditPanel 存在与否断言）
  - 删除原来对 `handleDrop` / dropError UI 的断言

### L3 Playwright（新增）

`packages/ui/tests-e2e/people-tree-advanced.spec.ts`：

1. 页面加载 → 点击某个经理的 chevron chip → 期望其子孙 DOM 节点不再出现，chip 显示 `▶ N`。
2. Collapse all → Expand all round-trip → 节点数恢复。
3. 折叠状态刷新页面后保留（走 localStorage）。
4. 按 `f` 键 → 视图 zoom & pan 到 fit（用 viewport transform DOM assertion）。

不涵盖：拖拽轨迹（本 spec 已明确 drag 不改数据）、动画中间态。

### 通过门 (Gate)

- L1 覆盖率 ≥ 现有阈值（脚本 `scripts/check-coverage.sh` 兜底）。
- L3 全绿。
- G1 typecheck + biome 全过。

## Boundaries

### Always Do

- 折叠状态当 `userEmail` 与 `workspaceId` 都可用时**必须持久化**到
  `bogo:orgTree:collapsed:${userEmail}:${workspaceId}`；任一为空时回退到内存 `Set`
  （见 §Persistence）。
- `computeTreeLayout` 的老签名（只传 `persons`）保持工作，不 break 现有调用与单测。
- 所有键盘快捷键必须在 focused-in-input 时被跳过（现在的 Edit panel 有一堆 input）。

### Ask First (哥点头再动)

- 服务端持久化折叠偏好（新增表 / 用户偏好 API）。
- 折叠状态出现在 URL query string 中（分享链接场景）。
- 恢复"拖拽改经理"或引入 handle-connect 改经理（本 spec 明确排除）。
- 引入 D&D 库、手势库、动画库、canvas 渲染。
- 修改 `persons` schema / API 契约。
- 把 dotted-line 纳入 descendants 计算。
- 持久化用户手工挪动的节点位置（v1 明确接受 Dagre 重算覆盖手工位置）。

### Never Do

- 直接 mutate `collapsedIds` Set 而不走 `toggleCollapse`。
- 在组件层实现业务判定（`hasReports` / `visibleSet` 必须在 vm）。
- 用节点内 `<button>` 触发折叠时忘了 `stopPropagation` 导致 select 同时触发。
- 引入除 React Flow / Dagre / lucide-react 外的第三方 UI 依赖。
- 用 `any` 或 `@ts-ignore` 绕类型（`Node<PersonNodeData>` 是既定契约）。
- 让 `PersonTree` 的 drag 手势触发任何后端 mutation（本 spec 的核心约束）。
- 用 `@xyflow/react` 的 `useKeyPress` 挂本 spec 的画布快捷键 —— 见 §Behavior/Minimap
  §3；其 target 不在 effect 依赖里，首 render ref 为 null 时会静默回退到 document
  监听，且 `preventDefault` 在 handler 顶部执行，任何在 handler 里做的守卫都来不及。

## Implementation Order (原子化提交计划)

每个 commit 都要能通过 pre-commit hook（L1 + G1），先清旧路径、再上折叠、最后打磨画布导航。

| # | Commit (`fix/feat/refactor: ...`) | 内容 |
|---|-----------------------------------|------|
| 1 | `refactor(ui): remove drag-to-move-manager wiring from person tree` | 删掉 `handleDrop` / `dropError` / `getNodeCenter` / `findDropTarget` / `wouldCreateCycle`；`onNodeDragStop` 不再 wire；同步删掉 PersonTree.tsx 里的 dropError UI 与相关测试。 |
| 2 | `refactor(ui): extract descendants map from person list` | 新增 `descendants-map.ts` + 单测。老代码路径不变。 |
| 3 | `feat(ui): computeTreeLayout supports visibleSet + hiddenCount` | 扩签名向后兼容 + 补测。老单测不动。 |
| 4 | `feat(ui): collapse state hook with localStorage persistence` | `use-collapse-state.ts` + 单测（含 mock localStorage、无 email 内存回退）。 |
| 5 | `feat(ui): person node shows collapse chevron chip` | 修 `PersonNode` + 单测；`PersonTree` 尚未接线，仅 props 层准备好；顺手移除 GripVertical。 |
| 6 | `feat(ui): person tree wires collapse toggle` | `usePersonTree` 组合 collapse state；点击 chip 生效；selected person 被隐藏后自动清 selection。 |
| 7 | `feat(ui): tree toolbar with collapse all / expand all / fit` | 新增 `PersonTreeToolbar` 替换现在的 Add 按钮。 |
| 8 | `feat(ui): person tree minimap + canvas shortcuts` | `<MiniMap />` + `use-canvas-shortcuts`。 |
| 9 | `test(ui): playwright e2e for collapse (persistence + roundtrip)` | 新增 `people-tree-advanced.spec.ts` L3 用例。 |
| 10 | `docs(features): mark 04-org-tree-advanced.md complete` | 更新本 spec 状态、README 索引状态列。 |

## 6DQ Quality Plan

| 维度 | 是否达标 | 备注 |
|------|---------|------|
| Functional | ✅ | 折叠 / 快捷键 L1 + L3 覆盖 |
| Reliability | ✅ | localStorage 读失败降级到内存；collapsedIds 引用不存在 pid 时自动跳过 |
| Performance | ✅ | descendants DFS 一次；Layout 只对 visibleSet 跑；chip 均 memoized |
| Security | ✅ | 无新数据面变化；localStorage key 命名带 `userEmail`，避免多用户串数据 |
| Maintainability | ✅ | vm/组件分层清晰；layout 老签名兼容；新增文件均带单测；旧的 drag-to-move 死路径彻底清除 |
| Accessibility | ⚠️ 部分 | chevron chip 加 `aria-expanded`、`aria-label="Collapse subtree of {name}"`。整棵树的键盘遍历（Tab/Arrow）**未做**，显式记为 v2 欠账。 |

## Out of Scope (v2 候选)

- 服务端同步折叠偏好（跨设备）。
- URL 中携带 `collapsed=` query 用于分享指定视图。
- 拖拽改经理（本 spec 明确排除，如未来恢复需另起 spec）。
- 拖拽多选 / 批量 move。
- 持久化用户手工挪动的节点位置（覆盖 Dagre 自动布局）。
- 树节点按 `sortOrder` 手动重排（今天 `sortOrder` 存在但 UI 未用）。
- 键盘完全可达：Tab 焦点顺序、Arrow keys 上下左右移动焦点、Space 触发折叠。
- 折叠状态动画（今天硬切换；动画留给 6DQ Delight 迭代）。

## Decisions（时间线）

**2026-07-04（初稿）**
1. 高级功能范围原拟 = 折叠 + 拖拽强化 + Minimap/快捷键（三选三）。
2. 折叠按钮位置 = 节点右下角 chevron chip（不是 hover 侧边浮动、也不是整卡点击）。
3. Dotted line **不** 参与 descendants 计算 —— 折叠只作用于实线汇报。
4. 折叠状态持久化到 localStorage，key 按 `(userEmail, workspaceId)` 隔离。

**2026-07-09（本次修订）**
5. **移除"拖拽改经理"目标**。`PersonTree` 的 drag 只保留视觉位置调整，不触发 mutation；
   改经理的唯一 UI = EditPanel 的 Manager 下拉框（已存在）。理由：拖拽改经理误触率高、
   与 Dagre 自动布局语义冲突、且 EditPanel 路径已经能覆盖所有 move 场景。
6. 相应删除 `findDropTarget` / `wouldCreateCycle` / `handleDrop` 等一整套代码路径与测试
   （不做 deprecate 保留，一次删干净）。
7. 高级功能范围收窄为 **折叠 + Minimap/快捷键**（二选二），本 spec 只交付这两块。

**2026-07-09（review 修订）** — 内部一致性与技术正确性修正：
8. **快捷键作用域收紧（v1）**：初次意图是用 `useKeyPress` 传入 `target: ref.current`
   + `document.activeElement` containment 守卫。**在 v2 修订中被推翻**（见第 13 条）。
   Testing Strategy 保留"焦点在画布之外不触发"的回归测试。
9. **Reset zoom 快捷键改为 `zoomTo(1, ...)`**：原写法 `setViewport({ x, y, zoom: 1 })`
   里的 `x/y` 无出处，照抄编译不过；`zoomTo(1, ...)` 语义明确（只改 zoom、保留当前 pan）。
10. **Dotted-line 描述修正**：原写"保持当前实线渲染"与代码不符（`strokeDasharray: "5 5"`
    就是虚线）。改为"保持当前虚线 edge 渲染"。
11. **CollapseState 示例类型对齐 Code Style**：`collapsedIds` 直接标注为 `ReadonlySet<string>`，
    避免示例与"对外不返回可变引用"的规则前后矛盾。
12. **Persistence 语义澄清**：Always Do 从"折叠状态一律持久化"改为"`userEmail` 与
    `workspaceId` 都可用时必须持久化，否则内存回退"，与 §Persistence 的"未登录不持久化"
    保持一致。

**2026-07-09（review 修订 v2 — 快捷键实现策略）** — 推翻第 8 条：
13. `@xyflow/react` v12 的 `useKeyPress` 不能承担"仅在画布 focused 时生效"的合同。
    读源码（`index.mjs:376–473`）确认：
    - effect 依赖是 `[keyCode, setKeyPressed]`，`options.target` 不在依赖里；首次
      render 时 `ref.current === null` → `target` 回退到 `document` 并直接绑定；ref
      后来变成 DOM 也不会重新绑，全站监听已经生效。
    - `preventDefault()` 在 handler 顶部（match 判定后立即调用），在 handler 内做
      containment guard 已经太晚，按键会被静默吞掉。
14. **禁用 `useKeyPress` 挂本 spec 的快捷键**（写入 Never Do）。改用两种硬约束之一：
    - A（推荐）：`use-canvas-shortcuts.ts` 在 `useEffect` 里直接对 wrapper element
      绑原生 `keydown`，wrapper `tabIndex={0}`；wrapperEl 为 null 时不绑、不回退 document。
    - B：把快捷键逻辑放在只有 wrapper 存在时才 mount 的子组件里，传入稳定 `HTMLElement`。
15. Testing Strategy 新增硬性回归："首次 render wrapper ref 为 null 时，不得对 `document`
    绑 keydown 监听"（`document.addEventListener` spy 断言）。

## References

- `docs/architecture/05-ui-mvvm-architecture.md` — MVVM 分层原则
- `docs/architecture/06-ui-component-decisions.md` — 组件取舍原则
- `docs/architecture/08-ui-test-strategy.md` — 6 层测试架构 + 6DQ
- `docs/architecture/09-css-conventions.md` — Tailwind + token 规范
- `docs/features/01-tag-system-spec.md` — Person tags（已被本页面渲染消费）
- [@xyflow/react v12 docs](https://reactflow.dev/api-reference) — `MiniMap` / `useKeyPress` / `fitView`
