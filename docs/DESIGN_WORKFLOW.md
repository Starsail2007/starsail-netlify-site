# Design Workflow

这个项目把“设计探索”和“可上线代码”分开管理。

## 推荐关系

```text
Canva / Figma
  -> 设计草图、视觉参考、素材导出
Codex
  -> 读取设计意图，把它实现到 Astro 代码里
GitHub
  -> 保存正式源码版本
Netlify
  -> 自动构建并同步到公网
```

最终公网版本以 GitHub 仓库中的代码为准。Canva/Figma 可以用来做设计，但不建议把它们的发布链接当作这个项目的正式网站来源。

## 连接器和接入准备

Figma / Canva 的具体接入约定见 [`DESIGN_CONNECTORS.md`](DESIGN_CONNECTORS.md)。

Canva 侧已经建立项目文件夹：[`Starsail Visual Workflow`](https://www.canva.com/folder/FAHO4G_onjg)。新的 Canva 草图、生成候选和可编辑设计优先放在这里，避免散落在账号根目录。

新的设计方向开始前，建议先创建一次 intake 记录：

```bash
pnpm design:intake -- --name "Homepage visual refresh" --figma "https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456"
```

Figma 优先提供带 `node-id` 的节点链接；Canva 优先提供设计链接和导出素材。Codex 会把这些材料整理到 `design/references/<topic>/`，再把确定上线的部分转成 `src/` 代码和 `public/assets/design/` 静态资源。

## 文件放置方式

```text
design/references/
```

放设计参考材料，例如截图、说明文档、Figma 链接记录、Canva 链接记录。

```text
design/exports/
```

放从 Canva/Figma 导出的临时素材，例如 PNG、SVG、PDF。这里的文件不一定直接上线。

```text
public/assets/design/
```

放已经确定会被网页引用的设计素材。这里的文件可以通过 `/assets/design/...` 在页面里访问。

## 交给 Codex 的推荐说法

如果你已经在 Figma 或 Canva 里做了设计，可以说：

```text
参考 design/references/ 里的截图和说明，把首页视觉改成这个方向，并保持现有部署方式不变。
```

或者：

```text
读取这个 Figma/Canva 设计稿，把适合上线的部分转成 Astro 组件、CSS 变量和静态资源。
```

## 同步到公网

上线同步仍走这个路径：

```text
修改代码 -> commit -> push 到 GitHub -> Netlify 自动部署
```

如果只是 Canva/Figma 内部改了设计，但没有把变化落回代码，`https://starsail.netlify.app/` 不会自动变化。
