# Starsail Netlify Site

这是星帆 Starsail 的个人静态网站项目，当前公网地址是 `https://starsail.netlify.app/`。

这个仓库已经从单页 HTML 演示整理成轻量 Astro 项目：页面、组件、样式、脚本、资源和说明文档分开存放，方便之后继续设计、扩展、重构或交给新的 Codex 线程接着做。

## 快速开始

```bash
pnpm install
pnpm dev
```

本地开发服务器默认打开 `http://127.0.0.1:4321/`。构建检查使用：

```bash
pnpm build
```

也可以使用更直观的上线检查命令：

```bash
pnpm deploy:check
```

## 项目结构

```text
.
├── AGENTS.md
├── design/
│   ├── exports/
│   └── references/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN_WORKFLOW.md
│   ├── EDITING_GUIDE.md
│   └── PROJECT_BRIEF.md
├── public/
│   └── assets/avatar.jpeg
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   └── styles/
├── astro.config.mjs
├── netlify.toml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

## 部署

Netlify 连接 GitHub 仓库后使用：

```text
Build command: pnpm build
Publish directory: dist
```

`netlify.toml` 已经写好这些配置。

以后常规上线路径是：

```text
本地/Codex 修改 -> GitHub -> Netlify 自动构建 -> 公网更新
```

如果从 Canva 或 Figma 做设计，建议先把设计链接、截图或导出素材放进 `design/`，再让 Codex 把它们转成 `src/` 里的页面、组件和样式。最终上线仍以这个代码项目为准。

## 和 Codex 协作

新的 Codex 线程进入项目后，先读 `AGENTS.md`、`docs/PROJECT_BRIEF.md` 和 `docs/ARCHITECTURE.md`。如果只是改文案，可以看 `docs/EDITING_GUIDE.md`。
