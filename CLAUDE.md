# CLAUDE.md

## 项目概述

YinYang 是一个极简 Hugo 博客主题，fork 自 `joway/hugo-theme-yinyang`。功能包括：暗色/亮色主题切换、MathJax 3 数学公式、图片懒加载与骨架屏、代码块工具栏（语言标签/复制/折叠）、TOC 目录滚动监听、脚注高亮跳转、SEO JSON-LD、Gallery 内容类型、CJK 排版优化。

## 开发命令

```bash
# 使用示例站点本地预览
hugo server -s exampleSite --themesDir ../.. --theme $(basename $(pwd))

# 构建示例站点
hugo -s exampleSite --themesDir ../.. --theme $(basename $(pwd))
```

没有构建/测试/代码检查工具链——主题直接由 Hugo 使用。

## 架构

### baseof.html 与模板继承

`_default/baseof.html` 定义应用外壳骨架，但并非所有模板都继承它：

| 模板 | 是否继承 baseof |
|---|---|
| `index.html` | 是（`{{ define "main" }}`） |
| `_default/list.html` | 是（`{{ define "main" }}`） |
| `_default/single.html` | **否** — 独立完整 HTML |
| `gallery/single.html` | **否** — 独立完整 HTML |
| `_default/terms.html` | **否** — 独立完整 HTML |
| `404.html` | **否** — 独立完整 HTML |

`single.html`、`gallery/single.html` 和 `terms.html`、`404.html` 各自包含完整的 `<html>`/`<head>`/`<body>`。这意味着对页面外壳做结构性修改时，需要同时更新 baseof 和这些独立模板。

baseof 定义的 block 包括：`"main"`、`"toc"`、`"runtime"`。`runtime` block 目前未被任何子模板覆盖。

### 双模式滚动架构

页面在窄屏（< 84em）和宽屏（≥ 84em）下使用不同的滚动容器：

- **窄屏**：`body` 满屏固定（`overflow: hidden`），滚动发生在 `#appScroll` 元素内部。TOC 作为浮层滑出。
- **宽屏**：`body` 自身可滚动，`app-scroll` 退化为普通流（`overflow: visible`）。TOC 固定在内容区右侧（`left: calc(50% + 432px)`）。Edge blur 从 CSS mask 切换为 `position: fixed` 渐变叠加。

`ui.html` 中的 `toggleScrollFade()` 和 `isWide()` 分别管理边缘模糊检测和宽屏判断，供所有脚本共享。

### CSS 处理流程

16 个 CSS 文件位于 `assets/css/`，由 `head.html` 通过 Hugo 资源管线处理：

1. **`bundle.css`**：通过 `resources.Concat` 合并 14 个文件再 `minify`，内联到 `<style>` 标签。按加载顺序：
   `variables` → `global` → `site-header` → `theme-toggle` → `posts-list` → `post-page` → `taxonomy` → `gallery` → `footnotes` → `app-shell` → `code-blocks` → `actions` → `toc` → `image-loading` → `mobile`（最后装载以便覆盖）
2. **`syntax.css`**：独立 minify 并内联（来自 Hugo 的 Chroma 语法高亮样式）。

`extraCSSFiles` 参数可通过 `<link>` 加载额外 CSS（用于自定义字体、背景等，不受 Hugo minify 处理）。

### 主题系统

暗色/亮色切换通过 `data-theme` 属性配合 CSS 变量实现：

- `head.html` 顶部内联脚本在 HTML 解析前同步执行，从 `localStorage` 或 `prefers-color-scheme` 读取主题，设置 `document.documentElement.setAttribute("data-theme", ...)`，避免 FOUC。
- `variables.css` 定义 `:root`（亮色）和 `:root[data-theme="dark"]`（暗色）两套 CSS 自定义属性。
- `theme-toggle.html` 提供切换按钮交互，切换时短暂添加 `theme-changing` class 禁用 CSS transition（避免颜色渐变闪烁）。
- 主题按钮嵌入在 `header.html` 中。

### 跨功能通用约定

以下约定由 TOC / 脚注 / 图片加载 / 代码块等功能的实现中提炼，**新增任何浮层、模态或动态 UI 时应遵循**：

- **颜色必须走 CSS 变量**：任何可见颜色不得硬编码，先在 `variables.css` 的亮/暗两套 `:root` 中定义变量（如 `--color-xxx`），再在样式中引用。这样主题切换时颜色自动跟随（`data-theme` 属性驱动）。
- **主题切换表现**：切换瞬间 `theme-changing` class 会以 `transition: none !important` 禁用全局过渡，属预期机制——避免颜色渐变闪烁。新增 UI 无需为此特判，但应确保其颜色由 CSS 变量驱动而非硬编码。
- **动画与 reduced-motion**：所有动画必须尊重 `prefers-reduced-motion: reduce`（无动画降级，参考 `image-loading.css`）。打开/关闭类动画，销毁 DOM 前须等动画结束（`transitionend` + `setTimeout` 兜底，reduced-motion 下直接销毁）。
- **模态键盘可达性**：`role="dialog"` + `aria-modal="true"` 的模态须支持：打开时焦点移入容器（`tabindex="-1"`）、Esc 关闭、关闭时焦点归还触发元素（参考 TOC 浮层）。模态内有可聚焦控件时用 Tab 焦点陷阱循环；无控件时拦截 Tab、焦点保持在其容器。
- **双模式滚动锁定**：任何需要锁背景滚动的模态，必须同时处理宽屏 `html/body` 与窄屏 `#appScroll` 两个滚动容器；用 `html.xxx-open` class + CSS 规则实现（非内联样式），并记录/还原各自滚动位置。
- **事件委托**：交互统一用 `document` 级委托 + 打开态 guard（如 `document.querySelector('.xxx')` 已存在则 return），避免重复触发；多个监听器对同一事件按注册顺序执行，先注册先处理。
- **按需创建销毁 DOM**：模态按需 `createElement` + append 到 body，关闭后 `remove()`，不预置空 DOM；动态插入的文本一律用 `textContent`（防 XSS），不用 `innerHTML`。
- **z-index 分层**：TOC backdrop `998` / 面板 `1000` / 浮层按钮 `1001`；全屏模态（如灯箱）`2000`（最顶层）。新增浮层参照此表选层级。
- **tooltip 边界**：`data-tooltip` 用于 hover/focus 提示（由 `ui.html` 统一处理）；模态内的控件用 `aria-label` 标注，不挂 `data-tooltip`，避免模态中出现多余浮层。

### Partial 及其职责与加载位置

| Partial | 加载位置 | 条件 |
|---|---|---|
| `head.html` | 所有独立模板 + baseof | 始终 |
| `header.html` | 所有独立模板 + baseof | 始终 |
| `seo.html` | `head.html` 内 | 始终 |
| `math.html` | `head.html` 内 | `partialCached`，仅在内容含 `$$`/`$...$` 时加载 MathJax CDN |
| `theme-toggle.html` | 所有独立模板 + baseof（`</body>` 前） | 始终 |
| `footnotes.html` | 所有独立模板 + baseof（`</body>` 前） | 首页跳过 |
| `ui.html` | 所有独立模板 + baseof（`</body>` 末尾） | 始终（tooltip DOM + 滚动/边缘模糊/tooltip 脚本） |
| `edge-blur.html` | 所有模板，在 header 后和内容末尾各一次 | 始终 |
| `toc.html` | `single.html`、baseof（`"toc"` block） | `tableOfContents` 启用且文章 `toc` 不为 `false` |
| `toc-script.html` | `toc.html` 内 | 同上 |
| `markdown-actions.html` | `single.html`、`gallery/single.html`（文章标题下方） | `markdownActions` 或 `editPageRepo` 启用 |
| `ai-label.html` | `single.html`（`post-header` 内 meta 行之后） | 文章 `ai` 为 `assisted`/`generated` 且 `aiLabel.enabled` 非 `false` |
| `copy-button.html` | `single.html`、`gallery/single.html`（`<body>` 最顶部） | 始终（定义 `bindCopyButton` 全局函数） |
| `code-toolbar.html` | `single.html`、`gallery/single.html`（`</body>` 前） | 始终（自动为所有 `.highlight` 和 `pre` 包装工具栏） |
| `image-loading.html` | `single.html`、`gallery/single.html`（`</body>` 前） | `imageLoading` 启用且非首页 |
| `image-tag.html` | `_markup/render-image.html`、`gallery/single.html` | 始终（共享 `<img>` 尺寸解析与骨架屏渲染） |
| `edit-page.html` | `single.html`、`gallery/single.html`（文章底部） | `editPageRepo` 且 `.File` 存在 |
| `edit-urls.html` | `edit-page.html`、`markdown-actions.html` | `editPageRepo` 且 `.File` 存在 |

### 代码块工具栏

`code-toolbar.html`（约 130 行 JS）在客户端自动增强所有代码块：

1. 为 `.highlight` 块包装 `.code-block-wrapper`，添加语言标签和复制按钮。
2. 行数超过 `codeMaxLines`（默认 15）时折叠，底部显示展开按钮。折叠通过 `max-height: 360px` + `is-folded` class 实现；若渲染高度不超过 360px 则自动移除折叠。
3. 无语言标签的 `<pre>` 块包装为 `.plain-code-wrapper`，添加浮动复制按钮。
4. 复制功能由 `copy-button.html` 提供的 `bindCopyButton()` 实现，优先级 `navigator.clipboard.writeText` → `document.execCommand('copy')` 降级。

### 图片增强

`image-tag.html` 统一处理三种场景：

1. **页面资源解析**：尝试以 `Resources.GetMatch` 解析图片尺寸（跳过 SVG）。
2. **懒加载**：`lazyImage` 启用时添加原生 `loading="lazy"`。
3. **骨架屏与失败重试**：`imageLoading` 启用时（非首页、非 SVG），包装 `.loading-image-frame`，内嵌 shimmer 骨架和失败占位。加载失败后点击重试（URL 追加 `?retry=` 参数破缓存）。

### TOC 系统

`toc.html` + `toc-script.html` 实现自适应目录：

- **宽屏（≥84em）**：侧边栏固定在页面右侧 `left: calc(50% + 432px)`，始终可见。
- **窄屏**：浮动按钮 `#tocFloatBtn` + 全屏遮罩 `#tocBackdrop`，点击展开滑出面板。Esc 关闭、Tab 焦点锁定、点击外部关闭。
- **Scroll-spy**：解析 TOC 链接对应的 heading，计算当前视口内可见的 heading，高亮对应链接并移动 `.toc-indicator` 指示条位置。滚动自动跟随（`scrollBy` + `smooth`）。
- **边缘模糊**：TOC 滚动区复用 `edge-blur.html` 并绑定 `toggleScrollFade`。

### 脚注系统

`footnotes.html` 拦截所有 `#fn:*` / `#fnref:*` 链接点击：

- **tooltip**：自动为脚注链接添加 `data-tooltip`（"查看脚注 N" / "返回引用处"）。
- **滚动与高亮**：点击后居中目标并触发黄色脉冲动画（`footnote-highlight` / `ref-highlight` CSS class）。
- **双模式滚动**：宽屏使用 `scrollIntoView`，窄屏手动计算 `app-scroll` 内的滚动偏移。

### 数学公式

- `_markup/render-passthrough.html`：配合 Goldmark passthrough 扩展，将 `$...$` / `$$...$$` 原样输出。
- `math.html`：通过正则扫描 `.RawContent` 中的 `$$` / `$...$`，仅在检测到公式时才加载 MathJax 3 CDN（`partialCached` 按 `RelPermalink` 缓存检测结果）。MathJax 配置使用 `ui/safe` 扩展以防御 XSS。

### Gallery 内容类型

`gallery/single.html` 渲染 `Params.gallery`（`{url, name}` 对象数组），使用 `image-tag.html` 渲染每张图片，两列网格布局。与 `single.html` 共享 markdown-actions、edit-page、图片加载、代码工具栏 partial。

## 配置参数（全部位于 `[params]` 下）

- `headTitle` — 页头展示标题（回退到 `author.name`）
- `description` — meta description 和页头副标题
- `mainSections` — 首页和列表页展示的 content sections
- `author.name` / `author.homepage` — SEO JSON-LD 使用
- `socials` — 页头链接数组，`{name, link}`
- `favicon` — 网站图标路径
- `extraHead` — 注入 `</head>` 前的原始 HTML
- `extraBody` — 注入 `</body>` 前的原始 HTML
- `postHeaderContent` / `postFooterContent` — 文章正文前后的注入 HTML
- `extraCSSFiles` — 额外 CSS 路径数组，以 `<link>` 加载
- `staticPrefix` — CDN 前缀，同时生成 `dns-prefetch`
- `lazyImage` — 布尔值，为 `<img>` 添加 `loading="lazy"`
- `imageLoading` — 布尔值，启用骨架屏 + 加载失败重试（首页不生效）
- `markdownActions` — 布尔值，启用"复制 Markdown"按钮（默认关闭）
- `editPageRepo` — GitHub 仓库 URL，启用"编辑原文"/"查看 Raw"按钮和底部纠错链接
- `editPageBranch` — 仓库分支名，默认 `main`
- `editPageText` — 纠错链接文字
- `tableOfContents` — 布尔值，启用 TOC 侧边栏
- `codeMaxLines` — 代码块折叠阈值，默认 15
- `album` — 单页 Open Graph 图片覆盖（字符串数组）
- `toc` — 文章 front matter（布尔值），单篇禁用 TOC；也兼容旧字段 `notoc`
- `ai` — 文章 front matter（字符串），标注 AI 创作方式：`none`（纯人，缺省等同）/ `assisted`（AI 辅助创作）/ `generated`（AI 生成·经人工编辑）。`assisted`/`generated` 时由 `ai-label.html` partial（`single.html` 的 `post-header` 内 meta 行之后调用）渲染 `.ai-label` 标注行（复用 `.action-icon` 图标约定 + 弱色小字，CSS 在 `post-page.css`）；`none`、缺省或未知值不渲染。仅覆盖 `single`，gallery 不进
- `aiLabel` — 站点配置（映射），AI 标注总开关与文案：`enabled`（布尔值，缺省视为开启，`false` 关闭所有标注渲染）、`assisted` / `generated`（字符串，自定义文案，缺省回退默认 `AI 辅助创作` / `AI 生成 · 经人工编辑`）
