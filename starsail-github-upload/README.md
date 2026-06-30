# 星帆测试站

这是 `https://starsail.netlify.app/` 的静态网站源码。

## 项目结构

```text
.
├── index.html
├── avatar.jpeg
├── netlify.toml
└── README.md
```

## 本地预览

在项目目录运行：

```bash
python3 -m http.server 8765
```

然后打开：

```text
http://127.0.0.1:8765/
```

## 部署

这个项目适合用 Netlify 部署。

如果已经连接 GitHub 仓库，Netlify 设置为：

```text
Build command: 留空
Publish directory: .
```

## 修改文字

主要文案都在 `index.html` 里。主标题需要改 `data-text`：

```html
<span class="line" data-text="先把空间"></span>
<span class="line" data-text="留出来"></span>
```

## 当前功能

- 夜间风格默认开启
- 图形按钮切换白天/夜间风格
- 文字动效模式：Calm / Float / Shine / Focus
- 圆形头像和署名
