# Features

按功能拆分的实施规格。每篇含设计细节、文件引用、原子化提交计划、6DQ 实施计划。

## 编号文档

| 编号 | 文档 | 状态 | 一句话概要 |
|------|------|------|----------|
| 01 | [tag-system-spec.md](./01-tag-system-spec.md) | 规格 | 标签系统：Tag 实体、N:M 关联、UI 与 API |
| 02 | [cli.md](./02-cli.md) | 规格 | Bogo CLI：`clip generate`；`bogo.hexly.ai` Access + `api.bogo.hexly.ai` bearer；含自证 e2e |
| 03 | [self-hosting.md](./03-self-hosting.md) | 操作 | 自部署：worker + Access 双域名；CLI 需 fork 后重 generate（`CLIP_BASE_URL` 不能改 loginUrl） |
| 04 | [org-tree-advanced.md](./04-org-tree-advanced.md) | 规格 | People 组织架构图高级交互：折叠/展开子树（chevron chip + localStorage 持久化）+ Minimap + 画布快捷键；拖拽仅调整视觉位置、不改经理（经理改动只走 EditPanel 下拉框）；沿用 `@xyflow/react` 原生能力，零后端改动 |
| 05 | [people-table-views.md](./05-people-table-views.md) | 已实现 | People 多维表格：workspace 级命名 View（列配置 + 排序/筛选），侧栏 Table `/table`，只读网格 + EditPersonPanel，CLI CSV/JSON bridge |
| 06 | [local-dev-seed.md](./06-local-dev-seed.md) | 操作 | 本地 D1 fixture：`bun run seed:local` 灌 Northwind Labs；只写 `.wrangler/`，不提交库文件 |

## 维护约定

- 完成后保留文档作为决策档案，不删除
- 已过时或被取代的规格移到 `../archive/`
- 新功能从 spec 开始，先 review 再实施
