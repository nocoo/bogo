# Architecture

奠基性设计与规范——实体模型、数据库、系统架构、UI 分层与测试策略。

## 编号文档

| 编号 | 文档 | 一句话概要 |
|------|------|----------|
| 01 | [entity-relationship.md](./01-entity-relationship.md) | Workspace / Person / Document / Field 实体、关系、CRUD、不变量 |
| 02 | [database-schema.md](./02-database-schema.md) | D1 表结构、复合 FK 隔离、树完整性、版本不变量、迁移策略 |
| 03 | [system-architecture.md](./03-system-architecture.md) | Worker + SPA 单体、CF Access 鉴权流、API 端点表、构建部署 |
| 04 | [ui-design.md](./04-ui-design.md) | UI 视觉、布局与核心交互 |
| 05 | [ui-mvvm-architecture.md](./05-ui-mvvm-architecture.md) | 前端 MVVM 分层与状态管理 |
| 06 | [ui-component-decisions.md](./06-ui-component-decisions.md) | 组件库与第三方依赖取舍 |
| 07 | [ui-page-interactions.md](./07-ui-page-interactions.md) | 页面级交互细节与边界场景 |
| 08 | [ui-test-strategy.md](./08-ui-test-strategy.md) | 6 层测试 + 6DQ 质量门 |
| 09 | [css-conventions.md](./09-css-conventions.md) | Tailwind 用法、组件类、命名规范 |

## 维护约定

- 改动应同步更新这里的一句话概要
- 文档需引用具体代码路径，与实现保持一致
- 已废弃的设计文档移到 `../archive/`
