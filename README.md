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

Netlify 项目仍连接 GitHub 作为源码来源，但 Git 自动构建由 `netlify.toml` 的 `ignore` 规则停止。手动 draft 或 production deploy 使用：

```text
Build command: pnpm build
Publish directory: dist
```

`netlify.toml` 已经写好构建、发布目录和 Git build ignore 配置。

### GitHub Pages 静态备用部署

仓库内的 `.github/workflows/github-pages.yml` 可以把同一套 Astro 静态站发布到 GitHub Pages。这个部署不支持 Netlify Functions，但首页、世界杯页、maimai 静态快照页都可以正常构建和访问。

GitHub Pages 构建时会使用：

```text
SITE_URL=https://starsail2007.github.io/starsail-netlify-site
BASE_PATH=/starsail-netlify-site
```

其中 `BASE_PATH` 用来让 `/assets/...`、`/worldcup/`、`/maimai/` 这类站内路径在 GitHub Pages 子目录下也能正确解析。

启用方式：

1. 进入 GitHub 仓库 `Settings > Pages`
2. 在 `Build and deployment` 里把 Source 设为 `GitHub Actions`
3. 回到 `Actions`，手动运行 `Deploy static site to GitHub Pages`，或等待下一次推送 `main`

世界杯页面在 GitHub Pages 上优先读取 `worldcup-data` 分支的静态 JSON。赛事已结束后，`.github/workflows/worldcup-live-data.yml` 只保留手动刷新，不再定时运行。

数据源优先级：

```text
GitHub worldcup-data 分支
  -> 当前部署携带的静态快照
  -> 不可用错误；mock 仅限本地开发或显式演示模式
```

以后常规上线路径是：

```text
本地/Codex 修改 -> GitHub main -> GitHub Pages -> Netlify draft deploy -> 验证 draft -> 提升 Netlify production
```

GitHub 仍然是源码主线，先提交并推送 `main`；该推送会更新 GitHub Pages。Netlify 的 Git 自动构建由 `netlify.toml` 主动忽略，公网站点只使用同一提交在本地生成的 `dist/` 发布 draft，验证后再提升为 production。

### 公网发布一致性约定

所有正式代码发布都要保证 GitHub Pages 和 Netlify 两个公网入口来自同一个 `main` 提交：

```text
https://starsail2007.github.io/starsail-netlify-site/
https://starsail.netlify.app/
```

每次 Codex 完成一个明确改动、阶段任务或工程整理后，即使用户没有主动提到发布，也需要先向用户确认是否同步到公网。

用户确认发布后，应先推送 `main` 并检查 GitHub Pages，再把该提交的本地构建产物上传为 Netlify draft，确认后提升为 production。不要重新启用 Netlify Git 自动构建，否则一次发布可能重复产生 production deploy。

发布后不要只看 `git push` 或构建成功。必须分别检查 GitHub Pages 和 Netlify 主站的关键页面与关键静态数据，例如：

- `/`
- `/worldcup/`
- `/data/worldcup-live.json`

`/data/worldcup-live.json` 是随代码发布携带的离线快照，不要求与独立 `worldcup-data` 分支的手动刷新时间完全一致。页面运行时会优先读取数据分支。详细流程见 `docs/WORLDCUP_DEPLOYMENT.md`。

### Netlify 额度与省额度部署

本项目不依赖 Netlify AI 开发。常规开发流程是本地改代码、完整验证、推送 GitHub，再把同一提交的 `dist/` 作为 Netlify draft 上传并按需提升为 production。不要在 Netlify Dashboard 中使用 `Build with an AI agent` / `Run AI agent`，这些属于 Netlify Agent Runners，会消耗 AI inference credits。

如果 Netlify deploy 显示：

```text
Skipped due to account credit usage exceeded
```

说明团队 credits 已超额，部署会被跳过。这通常不是代码构建失败，也不是 GitHub 连接损坏；本地仍然可以继续开发并用 `pnpm build` 验证。

省额度建议：

- 在 Netlify `Team settings > AI enablement` 里关闭 AI features，或把 Agent Runner 成员额度设为 `0`
- 注意 Netlify Functions / Scheduled Functions 也会消耗普通 credits
- 保持 `netlify.toml` 的 Git build ignore；不要同时使用自动 production deploy 和手动 production deploy
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

`.github/workflows/worldcup-live-data.yml` 现在只允许在 GitHub Actions 中手动运行。刷新结果只写入 `worldcup-data` 分支，不再回写 `main`，因此不会触发 Netlify production deploy，也不会制造纯时间戳提交。

前端读取顺序是 GitHub `worldcup-data`、当前部署携带的静态快照；如果只能读到过期快照，页面会显示提示。生产环境不自动使用模拟数据，只有本地开发或显式 `?worldcupDemo=1` 演示模式会启用。

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
