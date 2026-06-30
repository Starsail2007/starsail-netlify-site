# Editing Guide

## 修改首页文字

首页内容主要在 `src/pages/index.astro`。

常见可改位置：

- 主标题：`<MotionHeadline text="待探索的空间" />`
- 小字介绍：`<p class="subcopy">...</p>`
- 页脚诗句：`<div class="hint">...</div>`
- 状态文字：`<div class="status">...</div>`

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

## 本地查看

```bash
pnpm install
pnpm dev
```

然后打开开发服务器给出的本地地址。

## 交给 Codex 时怎么说

可以直接描述目标，例如：

```text
基于当前项目，把首页标题区改得更安静一些，保留夜间默认和头像弹窗。
```

或：

```text
先不要改代码，帮我看看如果要加入一个新区域，应该放在哪些文件里。
```
