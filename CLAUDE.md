# CLAUDE.md

## 项目概述

YinYang 是一个极简 Hugo 博客主题，fork 自 `joway/hugo-theme-yinyang`。功能特性包括：系统字体栈、MathJax 3 数学公式支持、图片懒加载、SEO JSON-LD 结构化数据、Gallery 内容类型以及 CJK 排版优化。

## 开发命令

```bash
# 使用示例站点本地预览
hugo server -s exampleSite --themesDir ../.. --theme $(basename $(pwd))

# 构建示例站点
hugo -s exampleSite --themesDir ../.. --theme $(basename $(pwd))
```

没有构建/测试/代码检查工具链——主题直接由 Hugo 使用。

## 架构

### 无 baseof.html

每个布局模板（`index.html`、`_default/single.html`、`_default/list.html`、`gallery/single.html`、`404.html`）都是一个**独立的完整 HTML 文档**，包含各自的 `<html>`、`<head>` 和 `<body>` 标签，没有共享的基模板。新增标记时需要注意是否需要在多个模板中重复添加。

### CSS 处理流程

两段 CSS 由 `layouts/partials/head.html` 内联到 `<style>` 标签中：

- `assets/css/index.css` — 主样式表（约 316 行）
- `assets/css/flexboxgrid-6.3.1.min.css` — 第三方 flexbox 网格系统

两者均通过 Hugo 资源管线 `resources.Get | minify` 处理。使用了 Hugo Pipes 转换，因此需要挂载资源目录（`--themesDir` 参数负责处理）。

额外的 CSS 文件可以通过 `params.extraCSSFiles`（路径数组）加载，以 `<link>` 标签形式注入到 `</head>` 之前。

### 与布局相关的 CSS 细节

- `.Chinese` CSS 类通过 `single.html` 和 `gallery/single.html` 中将 `.Site.Language.Locale` 追加到 `<article>` 的 class 属性上，触发 `index.css` 中的 CJK 行高（200%）和字间距样式规则。
- `html` 上的 `scrollbar-gutter: stable` 用于防止滚动条显隐导致的布局偏移——这是一次有意的修复（commit `ef9eb14`）。

### Partial 及其职责

| Partial | 被哪些模板加载 |
|---|---|
| `head.html` | 所有布局模板直接加载 |
| `header.html` | `index.html`、`_default/list.html`、`_default/single.html`、`gallery/single.html` |
| `seo.html` | `head.html` |
| `math.html` | `head.html`（按需条件加载） |
| `scripts.html` | 所有布局模板直接加载，位于 `</body>` 之前 |

**不存在** footer partial、基模板、分页 partial、目录（TOC）partial 以及 `i18n/` 国际化目录。

### MathJax 数学公式检测

`layouts/partials/math.html` 扫描页面原始内容（`.RawContent`）中的数学公式分隔符（`$$`、`$...$`、`\[`、`\(`），仅在检测到公式时才从 CDN 加载 MathJax 3 的 `tex-chtml.js`，避免在无公式页面加载额外脚本。

### 脚注高亮与滚动

`layouts/partials/scripts.html` 包含内联 JavaScript（commit `02ddced`），截获脚注链接（`#fn*`、`#fnref:*` hash）的点击事件，应用平滑滚动和黄色背景脉冲动画效果。对应的 CSS keyframes 定义在 `index.css` 中。

### Gallery 内容类型

`layouts/gallery/single.html` 渲染 `Params.gallery`（`{url, name}` 对象数组），以两列 flexbox 网格展示图片。使用 `range` 直接遍历 params 数组，而非基于分类法（taxonomy）或页面集合。

### 配置参数（全部位于 `[params]` 下）

模板中使用的主要参数：

- `headTitle` — 页头显示的网站标题（回退到 `author.name`）
- `description` — 元描述（meta description）和页头副标题
- `mainSections` — 首页展示的 content sections
- `author.name` / `author.homepage` — 用于 SEO JSON-LD 和元标签
- `socials` — 页头渲染的社交链接数组，每项包含 `{name, link}`
- `favicon` — 网站图标路径
- `extraHead` — 注入到 `</head>` 之前的原始 HTML
- `extraCSSFiles` — 额外 CSS 文件路径数组
- `extraBody` — 注入到 `</body>` 之前的原始 HTML
- `postHeaderContent` / `postFooterContent` — 文章页中注入到正文前后的 HTML
- `lazyImage` — 布尔值，启用 vanilla-lazyload 图片懒加载（首页不启用）
- `staticPrefix` — CDN 前缀，用于加载静态资源（同时生成 `dns-prefetch` 链接）
- `album` — 单页级别的 Open Graph 图片覆盖（字符串数组）
