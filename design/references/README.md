# Design References

这里保存 Figma / Canva / 截图 / 文字说明等设计参考材料。每个主题建议一个独立目录：

```text
design/references/<topic>/
```

推荐用命令创建：

```bash
pnpm design:intake -- --name "Homepage visual refresh" --figma "https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456"
```

目录里通常包含：

- `README.md`：给人读的设计意图、链接和落地目标
- `intake.json`：给 Codex 读的结构化链接和目标文件
- `images/`：Figma 截图、局部标注或参考图

不要在这里保存 token、cookie、私密授权截图或只能临时访问的下载链接。
