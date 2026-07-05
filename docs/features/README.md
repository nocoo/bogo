# Features

按功能拆分的实施规格。每篇含设计细节、文件引用、原子化提交计划、6DQ 实施计划。

## 编号文档

| 编号 | 文档 | 状态 | 一句话概要 |
|------|------|------|----------|
| 01 | [tag-system-spec.md](./01-tag-system-spec.md) | 规格 | 标签系统：Tag 实体、N:M 关联、UI 与 API |
| 02 | [cli.md](./02-cli.md) | 规格 | Bogo CLI：从仓库根 `clip.yaml` 用 [clip](../../../clip) `clip generate` 出完整 CRUD CLI；worker 端配套 bearer token 鉴权（`api_tokens` 表 + `/api/auth/cli` 端点 + CF Access bypass）；含自证 e2e 测试 |
| 03 | [self-hosting.md](./03-self-hosting.md) | 操作 | 自部署指南：worker 部署 + CF Access 配置 + 两条 CLI 路径（`CLIP_BASE_URL` 重定向已发布的 `@nocoo/bogo`，或 fork 重 generate 自有品牌 CLI） |
| 04 | [org-tree-advanced.md](./04-org-tree-advanced.md) | 规格 | People 组织架构图高级交互：折叠/展开子树（chevron chip + localStorage 持久化）、handle-connect 拖拽改挂经理、Minimap + 画布快捷键；沿用 `@xyflow/react` 原生能力，零后端改动 |

## 维护约定

- 完成后保留文档作为决策档案，不删除
- 已过时或被取代的规格移到 `../archive/`
- 新功能从 spec 开始，先 review 再实施
