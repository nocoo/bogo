# Bogo Docs

Bogo 的设计与规范文档。按主题分两个二级目录，每个目录内独立编号。

## 目录

### [architecture/](./architecture/) — 系统架构与规范

奠基性的设计与约定，决定整个项目的形态。

| 编号 | 文档 | 主题 |
|------|------|------|
| 01 | [entity-relationship](./architecture/01-entity-relationship.md) | 实体与关系模型（Workspace / Person / Document / Field） |
| 02 | [database-schema](./architecture/02-database-schema.md) | D1 表结构、隔离/树/版本不变量、迁移策略 |
| 03 | [system-architecture](./architecture/03-system-architecture.md) | Worker + SPA 架构、CF Access 鉴权流、API 端点表 |
| 04 | [ui-design](./architecture/04-ui-design.md) | UI 视觉与交互设计 |
| 05 | [ui-mvvm-architecture](./architecture/05-ui-mvvm-architecture.md) | 前端 MVVM 分层 |
| 06 | [ui-component-decisions](./architecture/06-ui-component-decisions.md) | 组件取舍 |
| 07 | [ui-page-interactions](./architecture/07-ui-page-interactions.md) | 页面交互细节 |
| 08 | [ui-test-strategy](./architecture/08-ui-test-strategy.md) | 测试策略（6 层 + 6DQ） |
| 09 | [css-conventions](./architecture/09-css-conventions.md) | CSS 与样式规范 |

### [features/](./features/) — 功能迭代规格

按功能拆分的实施规格，含设计细节、文件引用、原子化提交计划、6DQ 计划。

| 编号 | 文档 | 主题 |
|------|------|------|
| 01 | [tag-system-spec](./features/01-tag-system-spec.md) | 标签系统规格 |
| 04 | [org-tree-advanced](./features/04-org-tree-advanced.md) | People 组织架构图高级交互（折叠/拖拽/Minimap） |

## 约定

- 文件命名：`NN-kebab-case.md`，编号用于排序
- 每个二级目录维护自己的 `README.md` 索引
- 已过时文档移到 `archive/`（按需创建）
- 详细规范见 nmem 记忆「开发流程：编号文档」
