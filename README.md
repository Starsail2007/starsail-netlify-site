# Starsail Netlify Site

这是星帆 Starsail 的个人静态网站项目，当前 Netlify 公网地址是 `https://starsail.netlify.app/`。

如果 Netlify 因额度或部署权限暂时不可用，可以启用 GitHub Pages 静态备用地址：

```text
https://starsail2007.github.io/starsail-netlify-site/
```

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

### GitHub Pages 静态备用部署

仓库内的 `.github/workflows/github-pages.yml` 可以把同一套 Astro 静态站发布到 GitHub Pages。这个部署不支持 Netlify Functions，但首页、世界杯页、maimai 静态快照页都可以正常构建和访问。

GitHub Pages 构建时会使用：

```text
SITE_URL=https://starsail2007.github.io/starsail-netlify-site
BASE_PATH=/starsail-netlify-site
PUBLIC_MAIMAI_REMOTE_REFRESH=false
```

其中 `BASE_PATH` 用来让 `/assets/...`、`/worldcup/`、`/maimai/` 这类站内路径在 GitHub Pages 子目录下也能正确解析。

启用方式：

1. 进入 GitHub 仓库 `Settings > Pages`
2. 在 `Build and deployment` 里把 Source 设为 `GitHub Actions`
3. 回到 `Actions`，手动运行 `Deploy static site to GitHub Pages`，或等待下一次推送 `main`

世界杯实时赛事大屏在 GitHub Pages 上优先读取 `worldcup-data` 分支的静态 JSON，因此仍可配合 `.github/workflows/worldcup-live-data.yml` 自动更新数据。

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

### Netlify 额度与省额度部署

本项目不依赖 Netlify AI 开发。常规开发流程是本地改代码、运行 `pnpm build` 验证、推送 GitHub，再由 Netlify 普通自动部署。不要在 Netlify Dashboard 中使用 `Build with an AI agent` / `Run AI agent`，这些属于 Netlify Agent Runners，会消耗 AI inference credits。

如果 Netlify deploy 显示：

```text
Skipped due to account credit usage exceeded
```

说明团队 credits 已超额，部署会被跳过。这通常不是代码构建失败，也不是 GitHub 连接损坏；本地仍然可以继续开发并用 `pnpm build` 验证。

省额度建议：

- 在 Netlify `Team settings > AI enablement` 里关闭 AI features，或把 Agent Runner 成员额度设为 `0`
- 不配置 `OPENAI_API_KEY`，除非明确需要 AI fallback
- 注意 Netlify Functions / Scheduled Functions 也会消耗普通 credits
- GitHub 仓库是源码主线，Netlify 只是公网部署出口

应急时可以先发布 draft deploy：

```bash
pnpm build
pnpm --package=netlify-cli dlx netlify deploy --dir=dist
```

确认 draft URL 正常后，再将该 deploy 发布为 production。这个应急流程不应替代长期额度治理。

### 世界杯数据刷新

世界杯页面优先读取 GitHub `worldcup-data` 分支上的静态 JSON：

```text
public/data/worldcup-live.json
```

`.github/workflows/worldcup-live-data.yml` 每 5 分钟唤醒一次，但脚本会根据完整 104 场赛程决定是否真正抓取数据：

- 距离下一场超过 24 小时：约 6 小时更新一次
- 距离下一场 24 小时内：约 1 小时更新一次
- 赛前 30 分钟到开球后 150 分钟：约 5 分钟更新一次

数据更新写入 `worldcup-data` 分支，不推送 `main`，因此不会反复触发 Netlify 自动构建。前端读取顺序是 GitHub 静态 JSON、本地静态 JSON、Netlify Function 兜底。

本地手动刷新：

```bash
pnpm worldcup:update
pnpm worldcup:update:force
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
