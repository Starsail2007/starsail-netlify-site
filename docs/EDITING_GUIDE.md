# Editing Guide

## 修改网页文字

网页静态文字的主要入口是：

```text
src/content/site-text.md
```

这个文件是 Markdown，但真正驱动网页的是文件顶部 `---` 之间的结构化 frontmatter。一般只改引号里的文字，不改字段名、冒号和缩进。

改完后，本地开发服务器会自动刷新；上线时走：

```bash
pnpm deploy:check
```

然后提交到 GitHub，由 Netlify 自动重新构建公网版本。

## 检查文字有没有漏出文档

手动检查：

```bash
pnpm text:check
```

上线前检查：

```bash
pnpm deploy:check
```

`pnpm deploy:check` 会先执行 `pnpm text:check`，再执行 Astro 构建。

`pnpm build` 也会执行同样的检查，所以 Netlify 公网构建同样会拦截漏出的静态文案。

这个检查会扫描这些位置：

- `src/layouts/`
- `src/pages/`
- `src/components/`
- `src/scripts/`
- `src/worldcup/components/`

它不会扫描 `src/content/site-text.md`，也不会扫描 maimai 成绩数据、世界杯数据源、Netlify Function 或第三方服务错误消息。

如果检查失败，终端会显示类似：

```text
src/pages/index.astro:18:12 Static text node
```

处理方法：

1. 把这段文字移到 `src/content/site-text.md`。
2. 在页面、组件或脚本里通过 `siteText` 读取这个字段。
3. 再跑一次 `pnpm text:check`。

## 字段怎么找

- 标签页名称和搜索描述：`home.meta`、`maimai.meta`、`worldcup.meta`、`introDemo.meta`
- 首页标题、说明、状态、按钮、页脚：`home.hero`、`home.footer`
- 右上角品牌、头像说明、弹窗文字：`home.header`、`home.avatarModal`
- 主题按钮文字和无障碍标签：`shared.theme`
- maimai 仪表盘壳层文案：`maimai.hero`、`maimai.sections`、`maimai.b50`
- 世界杯大屏壳层文案：`worldcup.hero`、`worldcup.statusRow`、`worldcup.panels`
- 世界杯运行时提示：`worldcup.runtime`
- intro demo 原型页文案：`introDemo`

## 可以手动改的

适合在 `src/content/site-text.md` 里直接改：

- 页面标题、标签页名称、meta description
- 首页主标题、说明、状态、链接文字、页脚诗句
- 头像弹窗文字
- 主题切换按钮的“夜间 / 日间”
- maimai / 世界杯页面的面板标题、空状态、提示语
- 世界杯刷新提示、暂无数据提示、状态标签的中文映射

## 不建议手动改的

这些内容会随数据源更新，已经在 `dynamicTextSources` 里标明：

- maimai：玩家昵称、Rating、B35/B15、曲名、曲师、难度、达成率、同步时间
- 世界杯：赛程、比分、球队、球场、比赛阶段、实时状态、进球球员、刷新时间
- 系统/接口错误：Netlify Function、第三方 API、Supabase、Diving-Fish/Lxns 的错误消息，主要用于排查问题，不作为日常网页文案维护入口

如果要改这些自动内容，通常应该改数据源、同步脚本或接口逻辑，而不是改文案文件。

## 修改头像

替换这个文件即可：

```text
public/assets/avatar.jpeg
```

文件名不变时，页面代码不需要改。

## 修改颜色和主题

颜色变量在：

```text
src/styles/tokens.css
```

夜间主题写在 `:root`，日间主题写在 `html[data-theme="light"]`。

## 修改布局和动效

首页布局和视觉动效主要在：

```text
src/styles/home.css
```

交互脚本主要在：

```text
src/scripts/
```

如果只是改文案，一般不需要碰脚本。
