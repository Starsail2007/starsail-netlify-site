# Architecture

## 目录说明

```text
public/assets/
```

存放不会被 Astro 编译处理的静态资源。当前头像在 `public/assets/avatar.jpeg`，页面中通过 `/assets/avatar.jpeg` 引用。来自 Canva/Figma 的最终上线素材可以整理到 `public/assets/design/`。

`public/data/` 存放前端可直接读取的静态 JSON 兜底数据，例如世界杯 live 数据。GitHub Pages 不能运行 Netlify Functions，因此静态 JSON 是备用部署的重要数据入口。

```text
design/
```

设计协作区，不直接参与网站构建：

- `design/references/`：放设计参考、截图、说明、链接记录
- `design/exports/`：放 Canva/Figma 导出的图片、SVG、PDF 或临时素材

Codex 可以读取这里的材料，再把设计落到 `src/` 的代码中。

```text
src/content/
```

结构化内容源。`src/content/site-text.md` 是网页静态文字的统一编辑入口，页面标题、meta description、按钮、面板标题、空状态和提示语都从这里读取。B50、Rating、世界杯赛程/比分等实时内容仍由数据文件、接口和脚本生成，来源说明也写在这个文件的 `dynamicTextSources` 字段里。

```text
src/pages/
```

页面入口。当前主要页面包括：

- `src/pages/index.astro`：首页入口。
- `src/pages/maimai.astro`：maimai 静态成绩页。
- `src/pages/worldcup.astro`：世界杯实时展示页。
- `src/pages/worldcup/moments.astro`：世界杯关键瞬间独立页。
- `src/pages/lab/`、`src/pages/intro-demo.astro`：设计和交互实验页。

```text
src/layouts/
```

页面外壳。`BaseLayout.astro` 负责 HTML 基础结构、全局样式引入、客户端脚本引入和元信息。

```text
src/components/
```

可复用界面组件。当前包括站点头部、主题切换按钮、头像弹窗、首页原型组件，以及 maimai 局部组件。世界杯主界面组件位于 `src/worldcup/components/`，让世界杯功能系统和通用站点组件分开。

```text
src/worldcup/
```

世界杯功能系统。`components/` 放 Astro 界面壳，`lib/` 放数据归一化、刷新策略、进球检测、国旗和队名工具，`data/` 放名单、球员中文名映射和覆盖表。

```text
src/styles/
```

样式分层：

- `tokens.css`：颜色、阴影、主题变量
- `base.css`：页面基础样式和通用按钮样式
- `home.css`：当前首页的布局、动效和响应式样式
- `maimai.css`：maimai 页面样式
- `worldcup.css`：世界杯页面样式
- `entry-redesign.css`、`intro-loader.css` 等：实验入口和 loader 样式

```text
src/scripts/
```

浏览器端交互脚本：

- `theme.js`：日夜主题切换
- `motion.js`：文字拆分、动效模式切换、鼠标光晕位置
- `avatar-modal.js`：头像弹窗打开、关闭和键盘退出
- `maimai-dashboard.js`：maimai 前端渲染与静态数据展示
- `worldcup-dashboard.js`：世界杯页面交互、渲染和 UI 状态
- `worldcup/`：世界杯浏览器端小模块，例如数据客户端

```text
docs/
```

项目说明文档，给用户和未来 Codex 阅读。

其中 `DESIGN_WORKFLOW.md` 专门说明 Canva/Figma、Codex、GitHub、Netlify 之间如何配合。

`docs/optimization-prompts/` 保存可投喂给后续 Codex 对话的优化任务提示词，便于把复杂治理拆成独立工作流。

```text
tests/
```

轻量测试目录。当前优先覆盖纯函数和数据策略逻辑，避免一开始就引入重型浏览器测试框架。

## 构建和部署流程

本地开发时：

```bash
pnpm dev
```

上线前检查：

```bash
pnpm deploy:check
```

Netlify 部署时执行：

```bash
pnpm build
```

生成的静态文件位于 `dist/`，由 Netlify 发布。

GitHub Pages 备用部署由 `.github/workflows/github-pages.yml` 负责。它同样构建 `dist/`，但会设置 `BASE_PATH=/starsail-netlify-site`，让静态资源和站内链接适配 GitHub Pages 的项目子路径。GitHub Pages 不能运行 Netlify Functions，因此需要依赖静态 JSON、GitHub Actions 定时数据或前端可直接访问的公开数据源。

世界杯数据主链路是：GitHub `worldcup-data` 分支静态 JSON -> 站内静态 JSON -> Netlify Function 兜底。GitHub Actions 是唯一的数据更新入口；Netlify 只负责构建与发布，不承担数据生成。GitHub Pages 只使用静态/公开入口，不依赖 Netlify Function。

maimai 页面默认使用打包进项目的静态快照。远端刷新和 Supabase 历史是可选能力，需要环境变量显式开启。

`pnpm-workspace.yaml` 记录了 Astro 构建链中允许执行安装脚本的依赖，便于本地和 Netlify 构建环境保持一致。
