# Figma and Canva Connector Setup

这个项目支持把 Figma / Canva 作为视觉开发入口，但最终上线仍以本仓库的 Astro 代码、静态资源和 GitHub / Netlify 部署为准。

## Current Codex Setup

- Figma 插件已在本线程安装成功。后续给出 Figma 节点链接后，Codex 可以读取设计上下文、截图、节点结构和可用素材，再转成项目代码。
- Canva 插件已在本线程可用。Codex 可以搜索/创建 Canva 文件夹，读取设计信息，生成设计候选，导入公开 URL，使用 Magic Layers 把图片转成可编辑设计，并在用户确认后编辑和提交 Canva 设计。
- Canva 专用项目文件夹：[`Starsail Visual Workflow`](https://www.canva.com/folder/FAHO4G_onjg)，folder ID: `FAHO4G_onjg`。本地记录见 `design/canva-workspace.json`。
- 当前没有可见的 Canva Brand Kit。需要品牌色、字体、Logo 时，先用本项目的 `src/styles/tokens.css` 和 `public/assets/` 作为来源，或等用户在 Canva 建好 Brand Kit 后再读取。

## Best Input From Figma

给 Codex 的 Figma 链接最好是节点级链接，而不是只到文件首页：

```text
https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456
```

节点链接里必须有 `node-id`。Codex 会把它解析成：

```text
fileKey: <fileKey>
nodeId: 123:456
```

之后优先读取：

- 设计上下文：布局、文字、颜色、资源引用和近似代码
- 节点截图：用于视觉核对
- 组件/变量/样式：如果 Figma 文件里有可复用设计系统

## Best Input From Canva

Canva 更适合作为视觉素材和氛围草图入口。推荐提供：

- Canva 设计链接
- 导出的 PNG / SVG / PDF
- 哪些素材允许公开上线
- 哪些只是视觉参考，不能放进 `public/`

Canva 导出文件先放在：

```text
design/exports/<topic>/
```

只有确定要被网页引用的素材才移动到：

```text
public/assets/design/<topic>/
```

如果给的是 Canva 设计链接，Codex 会先提取 design ID：

```text
https://www.canva.com/design/<designId>/...
```

如果给的是 `https://canva.link/...` 短链，先解析短链，再读取设计。

## Canva Operation Route

Canva 的工具链按用途分成五类：

- 目录整理：搜索文件夹、创建 `Starsail Visual Workflow` 文件夹、把设计或素材移动进去。
- 读取检查：根据 design ID 获取设计信息、页面缩略图、文本内容和演示备注。
- 视觉生成：用 Canva 生成海报、社交图、报告、文档等候选；用户选定候选后再创建成正式设计。
- 导入转换：公开 HTTPS 文件可导入为 Canva 设计；扁平 PNG / JPEG / WEBP 可通过 Magic Layers 转成可编辑设计。
- 编辑事务：需要改 Canva 设计时，必须先开始 editing transaction，执行临时编辑，展示预览；只有用户明确确认保存后，才提交 transaction。

Canva 里的探索产物默认只作为视觉参考或素材草图。要上线到网站，仍要转成 Astro 代码和 `public/assets/design/` 静态资源。

## Intake Command

开始一次新的设计接入时，先创建记录目录：

```bash
pnpm design:intake -- --name "Homepage visual refresh" \
  --figma "https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456" \
  --pages "src/pages/index.astro" \
  --components "src/components" \
  --styles "src/styles/home.css,src/styles/tokens.css" \
  --notes "保持夜间默认、克制留白，只优化视觉层次和动效节奏"
```

这会生成：

```text
design/references/<slug>/README.md
design/references/<slug>/intake.json
design/references/<slug>/images/
```

`intake.json` 只是设计交接清单，不保存 token、cookie 或私密授权信息。

## Codex Implementation Route

一次完整的视觉落地通常按这个顺序：

1. 读取 `docs/DESIGN_WORKFLOW.md`、本文件和对应 `design/references/<topic>/README.md`
2. 用 Figma 插件读取节点上下文，或读取 Canva / Figma 导出素材
3. 把颜色、字体、阴影、动效时长等抽成 `src/styles/tokens.css` 或页面专用 CSS
4. 把结构落到 `src/pages/`、`src/components/` 和必要的 `src/scripts/`
5. 把最终素材放入 `public/assets/design/<topic>/`
6. 运行 `pnpm build`，必要时启动 `pnpm dev` 做视觉核对

## Prompt Examples

```text
读取 design/references/homepage-visual-refresh/，用里面的 Figma 节点改首页视觉。保持 Astro 项目结构和当前部署方式不变。
```

```text
这个 Figma 节点是新版 maimai 卡片设计，请读取节点上下文，把它转成当前 maimai 页面里的组件和 CSS。
```

```text
Canva 导出素材在 design/exports/homepage-mood/，请只把可上线素材整理到 public/assets/design/homepage-mood/，其余作为参考。
```

```text
在 Canva 的 Starsail Visual Workflow 文件夹里生成一组首页视觉方向候选。保持夜间默认、克制留白、流畅动效，只做视觉探索，不直接上线。
```

```text
读取这个 Canva 设计链接，把能落地的视觉决策整理到 design/references/<topic>/，再实现到 Astro 代码里。
```

## Safety Rules

- 不把 Figma / Canva 发布页当作正式公网来源。
- 不提交 Figma token、Canva token、cookie、临时下载链接或授权截图。
- 不把整页设计直接贴成一张图片上线，除非用户明确要求。
- 不在未展示预览、未获得用户明确确认的情况下提交 Canva editing transaction。
- 不默认引入新前端框架；优先保持 Astro + HTML / CSS / JavaScript。
- 视觉素材的公开使用范围需要用户确认，尤其是第三方 IP、角色图和品牌图。
