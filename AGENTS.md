# Codex Project Notes

这个项目是星帆 Starsail 的个人静态网站。当前状态是一个夜间默认、带轻量文字动效和头像展示的门户页；未来方向保持开放，不要替用户预设要放入什么具体内容。

## 工作原则

- 先阅读 `README.md`、`docs/PROJECT_BRIEF.md` 和 `docs/ARCHITECTURE.md`，再决定修改位置。
- 用户提出新设想时，优先把设想落到现有 `src/pages/`、`src/components/`、`src/styles/`、`src/scripts/` 结构里。
- 如果用户从 Canva 或 Figma 提供设计稿、截图、链接或导出素材，先阅读 `docs/DESIGN_WORKFLOW.md`，再把设计变化转成代码。
- 公网同步以 GitHub + Netlify 为主线；不要把 Canva/Figma 的发布页当作本项目的最终公网来源，除非用户明确要求。
- 用户确认上线后，仍先提交并推送 GitHub 作为源码主线；Netlify 发布优先使用本地 `dist/` 创建 draft deploy、验证 draft URL，再用 `restoreSiteDeploy` 提升到 production。不要把等待 Netlify 自动部署作为首选路径。
- 不主动替用户规划未来内容，只整理实现路径、项目结构和必要的技术选择。
- 保持当前网站的气质：克制、留白、流畅、夜间默认，可在用户要求下继续改变。
- 大改前先说明会影响哪些文件；小改可以直接完成并验证。

## 技术栈

- Astro 静态站点
- 普通 HTML/CSS/JavaScript 组件
- GitHub 管理源码
- Netlify 部署公网
- Canva/Figma 可作为设计探索、视觉参考和素材来源

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

Netlify 构建配置见 `netlify.toml`：

```text
Build command: pnpm build
Publish directory: dist
```
