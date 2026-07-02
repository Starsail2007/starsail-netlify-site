# Starsail Netlify Site

这是星帆 Starsail 的个人静态网站项目，当前公网地址是 `https://starsail.netlify.app/`。

这个仓库已经从单页 HTML 演示整理成轻量 Astro 项目：页面、组件、样式、脚本、资源和说明文档分开存放，方便之后继续设计、扩展、重构或交给新的 Codex 线程接着做。

## 快速开始

本项目使用 Node.js `24.14.0` 和 pnpm `11.7.0`。如果本机使用 nvm，可以先执行：

```bash
nvm use
corepack enable
```

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

世界杯实时赛事大屏使用 Netlify Function 读取服务端环境变量。上线前在 Netlify 项目里配置：

```text
FOOTBALL_API_KEY=你的 API-Football key
FOOTBALL_LEAGUE_ID=1
FOOTBALL_SEASON=2026
OPENAI_API_KEY=你的 OpenAI API key，可选
OPENAI_SCHEDULE_MODEL=gpt-5.5
```

`FOOTBALL_LEAGUE_ID` 和 `FOOTBALL_SEASON` 可以按 API-Football 后台实际赛事数据调整。`OPENAI_API_KEY` 只在 API-Football 无法访问 2026 赛程时作为公开赛程检索 fallback 使用。

数据源优先级：

```text
API-Football
  -> openfootball/worldcup.json 免费公开赛程
  -> OpenAI Web Search 可选兜底
  -> mock 展示数据
```

以后常规上线路径是：

```text
本地/Codex 修改 -> GitHub -> Netlify 自动构建 -> 公网更新
```

如果从 Canva 或 Figma 做设计，建议先把设计链接、截图或导出素材放进 `design/`，再让 Codex 把它们转成 `src/` 里的页面、组件和样式。最终上线仍以这个代码项目为准。

## 修改网页文字

静态网页文字统一在这里改：

```text
src/content/site-text.md
```

改引号里的文字即可；标签页名称、首页文案、maimai/worldcup 页面壳层文案和提示语都会从这里读取。B50、Rating、世界杯赛程和比分属于自动数据，来源说明写在同一个文件的 `dynamicTextSources` 里。

检查是否又有网页文案散落回代码里：

```bash
pnpm text:check
```

上线前建议使用：

```bash
pnpm deploy:check
```

它会先检查文案集中程度，再执行 Astro 构建。

Netlify 使用的 `pnpm build` 也会执行同样的检查。

## 和 Codex 协作

新的 Codex 线程进入项目后，先读 `AGENTS.md`、`docs/PROJECT_BRIEF.md` 和 `docs/ARCHITECTURE.md`。如果只是改文案，可以看 `docs/EDITING_GUIDE.md`。
