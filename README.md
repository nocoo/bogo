<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="Bogo logo" />
</p>

<h1 align="center">Bogo</h1>

<p align="center">围绕人物整理组织关系、文档和版本记录的知识库。</p>

<p align="center">
  <a href="https://bogo.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Bogo 把人物、汇报关系和相关文档放在同一个工作空间中。你可以从组织图找到一个人，查看与其关联的 1:1、会议或评估记录，也可以用人员表格和标签整理资料。网页和 CLI 使用同一套 API，业务数据保存在 Cloudflare D1。

它适合个人或一组可信使用者维护共同的知识库。当前登录负责控制进入系统；通过认证的用户可以访问同一份 workspace 数据，没有按账号隔离工作空间或配置成员权限。

## 功能

- **人物与组织图**：维护姓名、职位、头像 URL、直接与虚线汇报关系；拖动节点调整直接汇报对象，查看人物关联的文档时间线。
- **人员表格**：保存不同的列组合、排序、筛选条件和默认视图，列可以来自人物属性或自定义字段。
- **文档与历史**：编辑 Markdown、预览正文和 YAML frontmatter，将文档关联到多个人物；保存时记录标题和正文快照，可查看相邻版本的差异。
- **分类与字段**：分别给人物和文档打标签，定义文档类型，为人物添加文本、数字、日期、选项和布尔字段；指定字段可显示在组织图上。
- **网页与命令行**：网页通过 Cloudflare Access 登录；由 [clip](https://github.com/nocoo/clip) 生成的 CLI 提供人物、文档、字段、标签和表格视图等命令。

版本历史记录标题和正文，标签与人物关联不包含在这些快照中。

## 使用

打开 [bogo.hexly.ai](https://bogo.hexly.ai)，使用已获 Cloudflare Access 授权的账号登录。创建或选择 workspace 后，在 People 中维护人物，在 Documents 中编辑资料，在 Table 中保存人员视图。

安装 CLI 并登录：

```bash
npm install -g @nocoo/bogo
bogo --help
bogo login
bogo me
bogo workspaces-list
```

`bogo login` 会打开浏览器授权页，确认后把凭据保存到 CLI 的本地目录。重新登录会撤销同一账号之前的 CLI 登录 token；新 token 默认长期有效。服务端保存 token 摘要，本机 CLI 需要保存可使用的凭据。

npm 包的发布进度可能落后于仓库。使用新增命令前先看 `bogo --help`；需要当前 [clip.yaml](clip.yaml) 的完整命令集时，可按开发章节构建 CLI。

自托管需要分别配置浏览器登录地址和 CLI API 地址；`CLIP_BASE_URL` 只改变 API 地址，不改变登录地址。部署、Access 配置和 token 撤销方法见[自托管说明](docs/features/03-self-hosting.md)与 [CLI 文档](docs/features/02-cli.md)。

## 开发

使用 Bun 和 Node.js 24 LTS。仓库的包管理器声明见 [package.json](package.json)，依赖使用 Bun 安装。

```bash
git clone https://github.com/nocoo/bogo.git
cd bogo
bun install --frozen-lockfile
bun run build
bun run seed:local
bun run dev
```

打开 `http://localhost:7036`。Vite 把 `/api` 转发到本地 Worker 的 `127.0.0.1:37036`；本地开发使用 `dev@localhost` 身份，无需线上 Access 登录。首次 `build` 同时生成 shared 包和前端静态资源，后者写入 `packages/worker/static`。

`seed:local` 在当前 checkout 的本地 D1 中加载 Northwind Labs 示例。重跑会替换这个示例 workspace 及其资料；重新加载前先停止使用同一数据库的开发进程。详见[本地示例数据](docs/features/06-local-dev-seed.md)。

```bash
bun run typecheck
bun run lint
bun run build
```

CLI 的源码由 schema 生成。先按 [clip 的安装说明](https://github.com/nocoo/clip#readme)准备 `clip` 命令，再构建：

```bash
bun run --filter @nocoo/bogo build
node packages/cli/dist/index.js --help
```

主要目录：

| 目录 | 内容 |
| --- | --- |
| `packages/shared` | 共享类型、校验规则与 ID 工具 |
| `packages/worker` | Hono API、D1 migrations、本地示例数据 |
| `packages/ui` | React 页面、组件与 viewmodels |
| `packages/cli` | 根据 clip.yaml 生成并打包 CLI |

## 测试

先完成依赖安装和 `bun run build`。在仓库根目录运行：

| 层次 | 命令 |
| --- | --- |
| 共享代码、Worker 和 UI 单元测试 | `bun run test` |
| 本地 Worker API 集成测试 | `bun turbo test:e2e --filter=@bogo/worker` |
| Chromium 浏览器测试 | `bunx playwright install chromium`，然后 `bun run test:e2e:pw` |
| 生成 CLI 的登录、CRUD 与撤销流程 | `bun run test:cli-e2e`，需要 `clip` |

API 测试使用本地 Wrangler 与独立 D1 目录，端口为 `17036`，并拒绝携带 Cloudflare 部署凭据的环境。浏览器与 CLI 测试共用 `27036`，应逐项运行，确保该端口没有其他服务；CLI 测试使用临时凭据和本地授权流程。

## 技术栈

| 部分 | 技术与用途 |
| --- | --- |
| 工作区 | TypeScript、Bun、Turborepo |
| API | Cloudflare Workers、Hono；Access JWT 与 CLI bearer 认证 |
| 数据 | Cloudflare D1，保存人物、文档、版本、字段与视图 |
| 网页 | React、Vite、Tailwind CSS |
| 数据与导航 | React Query、React Router |
| 组织图 | React Flow、Dagre |
| 文档展示 | marked、js-yaml、@pierre/diffs |
| CLI 与测试 | clip 代码生成；Vitest、Playwright |

## 文档

- [文档索引](docs/README.md)
- [组织图与人物交互](docs/features/04-org-tree-advanced.md)
- [人员表格视图](docs/features/05-people-table-views.md)
- [CLI 与认证](docs/features/02-cli.md)
- [自托管](docs/features/03-self-hosting.md)
- [本地示例数据](docs/features/06-local-dev-seed.md)

## 许可证

[MIT](LICENSE)。CLI 包也采用 [MIT](packages/cli/LICENSE)。
