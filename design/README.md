# Design Workspace

这个目录用于放 Canva/Figma 相关材料，帮助 Codex 把设计稿转成可上线的网站代码。

- `references/`：设计参考、截图、链接记录、文字说明
- `exports/`：从 Canva/Figma 导出的临时素材

最终要被网站直接引用的素材，请整理到 `public/assets/design/`。

Canva 侧项目文件夹：

```text
Starsail Visual Workflow
https://www.canva.com/folder/FAHO4G_onjg
```

新的设计接入建议先用命令创建记录：

```bash
pnpm design:intake -- --name "Homepage visual refresh" --figma "https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456"
```

更多约定见 `docs/DESIGN_CONNECTORS.md`、`docs/DESIGN_WORKFLOW.md` 和 `docs/VISUAL_WORKFLOW_STATUS.md`。
