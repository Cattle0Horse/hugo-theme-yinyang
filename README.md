# YinYang

> 布局参考 [joway/hugo-theme-yinyang](https://github.com/joway/hugo-theme-yinyang)
> 
> 在其基础上增加了额外功能，如 Markdown Action（快捷复制文章）、大纲、脚注跳转及高亮显示等
> 
> 动效参考了 [detail.design](https://detail.design/) 的提示

站点示例：<https://cattle0horse.github.io/>

## 安装

在站点根目录执行：

```shell
git submodule add https://github.com/Cattle0Horse/hugo-theme-yinyang.git themes/yinyang
```

修改 `config.toml`：

```toml
theme = "yinyang"
```

## 本地预览

在仓库根目录启动示例站点：

```shell
hugo server -s exampleSite --themesDir ../.. --theme $(basename $(pwd))
```

浏览器打开 `http://localhost:1313` 即可预览主题效果。

## 配置

### 标题

```toml
[params]
headTitle = "CattleHorse"
```

如果不设置 `headTitle`，则使用 `.Site.Params.author.name`。

### 主要内容分区

```toml
[params]
mainSections = ["posts"]
```

### 字体

本主题使用**系统字体栈**——无需 CDN、无需下载、无 FOFT。浏览器自动为每个平台选择最佳字体：

| 用途 | 字体栈 |
|---|---|
| 正文 | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", ...` |
| 代码 | `"SF Mono", "Fira Code", Menlo, Monaco, "Courier New", ...` |

如需使用自定义字体，通过 `extraHead` 注入 CDN 并覆盖优先级。以下以霞鹜文楷（正文）+
Fira Code（代码）为例：

```toml
[params]
extraHead = '''
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@callmebill/lxgw-wenkai-web@latest/lxgwwenkai-regular/result.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/fira_code.min.css" />
  <style>
    body { font-family: "LXGW WenKai", sans-serif; }
    pre, code { font-family: "Fira Code", "SF Mono", Menlo, monospace; }
  </style>
'''
```

或者使用 `extraCSSFiles` 加载自己的样式表：

```toml
[params]
extraCSSFiles = ["css/fonts.css"]
```

### 页脚链接

```toml
[[params.socials]]
name = "About Me"
link = "https://cattle0horse.github.io"
[[params.socials]]
name = "Github"
link = "https://github.com/cattle0horse"
```

### 自定义 Head

```toml
[params]
extraHead = '<script src="xxxx.js"></script>'
```

### 自定义 CSS

```toml
[params]
extraCSSFiles = ["css/foo.css", "css/bar.css"]
```

### 文章首尾插入内容

```toml
[params]
postHeaderContent = ""
postFooterContent = ""
```

### 图片、文章操作与目录

`lazyImage` 为文章图片启用原生懒加载；`imageLoading` 额外启用加载占位和失败重试。`markdownActions` 启用原始 Markdown 复制按钮，`tableOfContents` 启用文章目录。文章 front matter 使用 `toc: false` 可单篇禁用目录，旧配置中的 `notoc: true` 也保持兼容。

`editPageRepo` 启用纠错链接和原始文件操作，`editPageBranch` 默认值为 `main`，`editPageText` 可覆盖链接文案；`codeMaxLines`（默认 15）控制长代码块的折叠阈值。

`extraHead`、`extraBody` 和 `postHeaderContent`、`postFooterContent` 会按原样通过 `safeHTML` 注入，仅应填入可信内容。`extraCSSFiles` 则按路径生成样式链接。

### Gallery 图库

`gallery` 是一个专门渲染图片网格的内容类型。在 `content/gallery/` 目录下创建文章，front matter 声明 `gallery` 数组即可，无需正文：

```toml
---
title: "相册示例"
date: 2026-08-04
gallery:
  - url: "/images/little-bear-light.png"
    name: "白日小熊"
  - url: "https://example.com/photo.jpg"
    name: "远程图片"
---
```

每张图片由共享的 `image-tag.html` 渲染，自动获得与正文图片一致的懒加载、骨架屏和失败重试能力（受 `lazyImage` / `imageLoading` 控制），并以两列网格布局展示，`name` 显示为图片下方的说明文字。

> 注意：`gallery` 不属于 `mainSections`（默认 `["posts"]`），因此不会出现在首页或 `/gallery/` 列表页，需通过文章 URL 直接访问。可参考 `exampleSite/content/gallery/sample.md`。

## 示例

```toml
# ---------- 站点 ----------
baseURL = "https://cattle0horse.github.io"
locale = "zh-cn"
theme = "yinyang"
title = "CattleHorse's Blog"

# ---------- URL ----------
[permalinks]
posts = "/blog/:title/"

# ---------- Markdown / 代码高亮 ----------
[markup]
[markup.goldmark]
[markup.goldmark.renderer]
unsafe = true
[markup.highlight]
guessSyntax = true
noClasses = false
style = "tango"
tabWidth = 2

# ---------- 主题参数 ----------
[params]
description = "By accumulating small steps, one can reach a thousand miles."
extraHead = ''
favicon = "/logo.png"
headTitle = "CattleHorse's Blog"
mainSections = ["posts"]
postFooterContent = ''
postHeaderContent = ''
staticPrefix = "https://cdn.jsdelivr.net/gh/cattle0horse/blog"
lazyImage = true

# ---------- 作者 ----------
[params.author]
homepage = "https://github.com/cattle0horse"
name = "CattleHorse"

# ---------- 社交链接 ----------
[[params.socials]]
name = "RSS"
link = "/index.xml"
[[params.socials]]
name = "Github"
link = "https://github.com/cattle0horse"
```
