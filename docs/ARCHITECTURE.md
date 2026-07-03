# Architecture

## 目录说明

```text
public/assets/
```

存放不会被 Astro 编译处理的静态资源。当前头像在 `public/assets/avatar.jpeg`，页面中通过 `/assets/avatar.jpeg` 引用。来自 Canva/Figma 的最终上线素材可以整理到 `public/assets/design/`。

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

页面入口。当前首页是 `src/pages/index.astro`。

```text
src/layouts/
```

页面外壳。`BaseLayout.astro` 负责 HTML 基础结构、全局样式引入、客户端脚本引入和元信息。

```text
src/components/
```

可复用界面组件。当前包括站点头部、主题切换按钮、文字标题和头像弹窗。

```text
src/styles/
```

样式分层：

- `tokens.css`：颜色、阴影、主题变量
- `base.css`：页面基础样式和通用按钮样式
- `home.css`：当前首页的布局、动效和响应式样式

```text
src/scripts/
```

浏览器端交互脚本：

- `theme.js`：日夜主题切换
- `motion.js`：文字拆分、动效模式切换、鼠标光晕位置
- `avatar-modal.js`：头像弹窗打开、关闭和键盘退出

```text
docs/
```

项目说明文档，给用户和未来 Codex 阅读。

其中 `DESIGN_WORKFLOW.md` 专门说明 Canva/Figma、Codex、GitHub、Netlify 之间如何配合。

## 构建和部署流程

本地开发时：

```bash
pnpm dev
```

上线前检查：

```bash
pnpm build
```

Netlify 部署时执行：

```bash
pnpm build
```

生成的静态文件位于 `dist/`，由 Netlify 发布。

GitHub Pages 备用部署由 `.github/workflows/github-pages.yml` 负责。它同样构建 `dist/`，但会设置 `BASE_PATH=/starsail-netlify-site`，让静态资源和站内链接适配 GitHub Pages 的项目子路径。GitHub Pages 不能运行 Netlify Functions，因此需要依赖静态 JSON、GitHub Actions 定时数据或前端可直接访问的公开数据源。

`pnpm-workspace.yaml` 记录了 Astro 构建链中允许执行安装脚本的依赖，便于本地和 Netlify 构建环境保持一致。
