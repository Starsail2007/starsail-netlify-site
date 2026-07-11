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

后续 Codex 只要在本地完成了网页相关改动，就要主动给出可访问的本地链接；默认使用 `http://127.0.0.1:4321/`，如果端口被占用或实际地址不同，以当次启动的 dev/preview 地址为准，不要等用户再追问。

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
  -> 不可用错误；mock 仅限本地开发或显式演示模式
```

以后常规上线路径是：

```text
本地/Codex 修改 -> GitHub -> Netlify draft deploy -> 验证 draft -> 提升 Netlify production
```

GitHub 仍然是源码主线，先提交并推送 `main`；Netlify 公网站点优先用本地构建产物发布 draft deploy，验证后再提升为 production，不把等待 Netlify 自动部署作为首选路径。

### 公网发布一致性约定

所有需要发布到公网的改动，都要保证 GitHub Pages 和 Netlify 两个公网入口内容一致：

```text
https://starsail2007.github.io/starsail-netlify-site/
https://starsail.netlify.app/
```

每次 Codex 完成一个明确改动、阶段任务或工程整理后，即使用户没有主动提到发布，也需要先向用户确认是否同步到公网。

用户确认发布后，应把同一份源码/构建结果同步到 GitHub Pages 和 Netlify，并检查两个公网地址是否都已更新到同一版本。Netlify 侧首选使用本地构建产物发布 draft deploy，确认后再将该 deploy 发布或恢复为 production；Netlify 自动部署只作为附带状态观察，不作为主要等待路径。

发布后不要只看 `git push` 或构建成功。必须分别检查 GitHub Pages 和 Netlify 主站的关键页面与关键静态数据，例如：

- `/`
- `/worldcup/`
- `/data/worldcup-live.json`

世界杯数据尤其要核对 `/data/worldcup-live.json` 的 `lastUpdated`。本地 `pnpm deploy:check` 通过后，用 `dist/` 创建 Netlify draft deploy，验证 draft URL 正常后再恢复/发布为 production。详细流程见 `docs/WORLDCUP_DEPLOYMENT.md`。

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

Netlify 发布优先使用 draft deploy：

```bash
pnpm deploy:check
pnpm --package=netlify-cli dlx netlify deploy --dir=dist
```

确认 draft URL 正常后，再将该 deploy 发布为 production。这个流程不替代长期额度治理，但作为本项目的 Netlify 首选发布方式，可以避免自动部署被 skipped 或队列延迟时两个公网入口不一致。

### 世界杯数据刷新

世界杯页面优先读取 GitHub `worldcup-data` 分支上的静态 JSON：

```text
public/data/worldcup-live.json
```

`.github/workflows/worldcup-live-data.yml` 每 5 分钟唤醒一次，但脚本会根据完整 104 场赛程决定是否真正抓取数据：

- 距离下一场超过 24 小时：约 6 小时更新一次
- 距离下一场 24 小时内：约 1 小时更新一次
- 赛前 30 分钟到开球后 150 分钟：约 5 分钟更新一次

数据更新先写入 `worldcup-data` 分支，再把同一份 `public/data/worldcup-live.json` 同步回 `main`，让 Netlify 和 GitHub Pages 随构建携带的静态快照也保持新鲜。前端读取顺序是 GitHub `worldcup-data`、当前部署的静态快照、Netlify Function 兜底；如果只能读到过期静态快照，页面会显示提示。生产环境不自动使用模拟数据，只有本地开发或显式 `?worldcupDemo=1` 演示模式会启用。

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
