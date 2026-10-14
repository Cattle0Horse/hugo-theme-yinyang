## 项目概述

YinYang 是一个极简 Hugo 博客主题，支持 Blog 长文、Notes 短记录与 Gallery 图库。主要能力包括：

- **内容组织**：Blog 标签、Notes 完整正文时间线（可选标题、按月分组、分页、来源与独立标签）、响应式 Gallery 图片网格，以及 Blog / Notes 独立 RSS。
- **外观与布局**：亮色 / 暗色 / 跟随浏览器、靛蓝 / 紫罗兰 / 石墨配色、偏好保存与无闪屏初始化、明暗切换圆形扩散动画、自适应页头导航、宽窄屏滚动容器切换与阅读位置保持、边缘淡出和可选渐进模糊。
- **导航与交互**：站内无刷新导航、正文切换动画与加载进度、前进后退恢复阅读和代码状态、自适应 TOC 与滚动监听、脚注双向跳转与高亮、菜单键盘导航、目录浮层焦点管理和复制结果播报。
- **正文阅读**：系统字体与 CJK 排版优化、宽表格和代码 / 公式局部横向滚动、构建期 KaTeX HTML / MathML 渲染、代码语法高亮与语言 / 复制 / 折叠工具栏、图片懒加载 / 异步解码 / 骨架屏 / 淡入 / 失败重试，以及正文和 Gallery 独立图片内描边。
- **发布与扩展**：Markdown 复制、GitHub 编辑 / Raw 与纠错入口、可配置 AI 创作标注、SEO 元信息与 JSON-LD、可选不蒜子访问统计、自定义 CSS / Head / Body / 文章首尾注入、静态资源 CDN 前缀、内容 archetype 与 Nushell 新建脚本。

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
| `notes/list.html` | 是（`{{ define "main" }}`） |
| `notes/single.html` | 是（`{{ define "main" }}`） |
| `note_tags/taxonomy.html` | 是（`{{ define "main" }}`） |
| `note_tags/term.html` | 是（`{{ define "main" }}`） |
| `_default/single.html` | **否** — 独立完整 HTML |
| `gallery/single.html` | **否** — 独立完整 HTML |
| `_default/terms.html` | **否** — 独立完整 HTML |
| `404.html` | **否** — 独立完整 HTML |

`single.html`、`gallery/single.html` 和 `terms.html`、`404.html` 各自包含完整的 `<html>`/`<head>`/`<body>`。这意味着对页面外壳做结构性修改时，需要同时更新 baseof 和这些独立模板。

baseof 定义的 block 包括：`"main"`、`"toc"`、`"runtime"`。Notes 列表、详情页与 `note_tags` 条目页通过 `runtime` block 加载图片增强和代码块交互；列表与标签时间线在代码块脚本之前加载复制 helper。

### 双模式滚动架构

页面在窄屏（< 84em）和宽屏（≥ 84em）下使用不同的滚动容器：

- **窄屏**：`body` 满屏固定（`overflow: hidden`），滚动发生在 `#appScroll` 元素内部。TOC 作为浮层滑出。
- **宽屏**：`body` 自身可滚动，`app-scroll` 退化为普通流（`overflow: visible`）。TOC 固定在内容区右侧（`left: calc(50% + 432px)`）。

`ui.html` 中的 `isWide()` 管理宽屏判断，供所有脚本共享。跨越 84em 断点时记录正文锚点及其视口偏移，并转移到新的滚动容器，保持阅读位置。

### CSS 处理流程

18 个 CSS 文件位于 `assets/css/`，由 `head.html` 通过 Hugo 资源管线处理：

1. **`bundle.css`**：通过 `resources.Concat` 合并 16 个文件再 `minify`，内联到 `<style>` 标签。按加载顺序：
   `variables` → `global` → `site-header` → `theme-toggle` → `posts-list` → `notes` → `post-page` → `taxonomy` → `gallery` → `footnotes` → `app-shell` → `code-blocks` → `actions` → `toc` → `image-loading` → `mobile`（最后装载以便覆盖）
2. **`syntax.css`**：独立 minify 并内联（来自 Hugo 的 Chroma 语法高亮样式）。
3. **`katex.min.css`**：KaTeX 样式，不进入 bundle，由 `math.html` 按需单独内联（见「数学公式」节）。

`extraCSSFiles` 参数可通过 `<link>` 加载额外 CSS（用于自定义字体、背景等，不受 Hugo minify 处理）。

### 站内导航与页面生命周期

- `head.html` 内联 `assets/js/page-runtime.js`，并通过 Hugo 资源管线加载 `navigation.js`。普通同源 HTML 链接使用 Fetch + History API 无刷新跳转；新标签页、修饰键点击、下载、非 HTML 资源和 `data-no-pjax` 保留原生行为。
- 主题交互脚本标记 `data-page-runtime`，接收 `window.yinyangRuntime.page`。通过 `listen` / `unlisten`、定时器、动画帧、`guard`、`expose` 和 `addCleanup` 管理资源；离开页面时清理旧监听器、观察器、动画及异步回调，再按新页面脚本顺序初始化。
- `data-page-head` 标记需更新的标题、元信息、feed、JSON-LD 与样式；相同节点复用，KaTeX 样式按目标页面加载或移除。外观偏好保持在 documentElement 上。
- 前进后退恢复宽窄滚动容器、代码展开状态与内容横向滚动位置。脚注和 TOC 用 `runtime.pushHash` 记录锚点历史。含未托管正文脚本、运行时版本不一致或请求失败时回退正常导航。
- 页面切换仅对正文 article 使用 `page-preparing` / `page-entering`，完成滚动恢复后以 200ms opacity + 6px translateY 淡入，Header 不参与动画。原页面在请求完成前保持可见。
- 导航请求超过 120ms 后按需创建 `.navigation-loading`（主题色不定进度条 + `role="status"`），成功、取消及失败时统一清理。`yinyang:page-ready` 在新页面初始化、焦点和滚动恢复完成后触发。
- 自定义集成可监听 `yinyang:before-navigate` / `yinyang:page-ready`。代码块初始化处理所有含展开按钮的 body，以便恢复历史展开状态。

### 主题与配色系统

外观分为两个独立维度：`data-theme` 控制 `light` / `dark`，`data-palette` 控制 `indigo` / `violet` / `graphite`：

- `palette-state.html` 过滤站点配置，只允许主题内置配色，并计算默认值及是否显示选择器。
- `head.html` 顶部内联脚本在 HTML 解析前同步执行：明暗偏好读取 `localStorage.theme`（`light` / `dark`，缺省为跟随浏览器），通过 `prefers-color-scheme` 解析实际明暗模式并设置 `data-theme-mode`，配色读取 `localStorage.palette` 或站点默认值，设置外观 data 属性以避免 FOUC。
- `variables.css` 定义共用的亮暗中性色与靛蓝 / 紫罗兰 / 石墨强调色变量；`syntax.css` 只消费 `--syntax-*` 变量，不硬编码主题颜色。
- `theme-toggle.html` 同时管理明暗切换和按需创建销毁的色点调色盘；明暗按钮点击轮换亮色 / 暗色 / 跟随浏览器，跟随浏览器时监听 `prefers-color-scheme` 变化。主动切换实际明暗时，通过 View Transitions API 从点击或触摸坐标圆形扩散到最远视口角落；键盘触发回退按钮中心。不支持该 API、实际明暗未变化或浏览器自动变更时直接切换。两种外观切换都短暂添加 `theme-changing` class 禁用 CSS transition。
- 明暗按钮与配色按钮嵌入在 `header.html` 的 `.appearance-controls` 中；未启用用户选择时不渲染配色按钮。
- `header-nav.html` 在 Header 解析后测量整排导航所需的真实宽度；空间不足时将全部 `socials` 链接折叠进图标菜单，空间恢复后展开。隐藏链接通过零尺寸不可见容器保留 `scrollWidth` 测量，避免临时显隐改变监听目标；`ResizeObserver` 只响应宽度变化，折叠状态仅在变化时写入。监听字体加载，保持导航行不换行；菜单保留链接顺序和打开方式，支持方向键、Home/End、Esc 与 Tab 退出，展开/折叠时恢复对应焦点。

### 跨功能通用约定

以下约定由 TOC / 脚注 / 图片加载 / 代码块等功能的实现中提炼，**新增任何浮层、模态或动态 UI 时应遵循**：

- **颜色必须走 CSS 变量**：任何可见颜色不得硬编码，先在 `variables.css` 的亮/暗两套 `:root` 中定义变量（如 `--color-xxx`），再在样式中引用。这样主题切换时颜色自动跟随（`data-theme` 属性驱动）。
- **主题切换表现**：切换瞬间 `theme-changing` class 会以 `transition: none !important` 禁用全局过渡，属预期机制——避免颜色渐变闪烁。新增 UI 无需为此特判，但应确保其颜色由 CSS 变量驱动而非硬编码。
- **动画生命周期**：所有动画使用统一流程。打开/关闭类动画，销毁 DOM 前须等动画结束（`transitionend` + `setTimeout` 兜底）。
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
| `header-nav.html` | `header.html` 末尾 | 配置了 `socials`（按实际可用宽度折叠/展开导航，运行时创建菜单） |
| `seo.html` | `head.html` 内 | 始终 |
| `math.html` | `head.html` 内 | `partialCached`，仅在内容含 `$$`/`$...$` 时内联 KaTeX CSS |
| `theme-toggle.html` | 所有独立模板 + baseof（`</body>` 前） | 始终 |
| `palette-state.html` | `head.html`、`header.html`、`theme-toggle.html` | 始终（过滤内置配色、计算默认值和选择器 gate） |
| `footnotes.html` | 所有独立模板 + baseof（`</body>` 前） | 首页跳过 |
| `ui.html` | 所有独立模板 + baseof（`</body>` 末尾） | 始终（tooltip DOM + 滚动位置/tooltip 脚本） |
| `toc.html` | `single.html`、baseof（`"toc"` block） | `tableOfContents` 启用且文章 `toc` 不为 `false` |
| `toc-script.html` | `toc.html` 内 | 同上 |
| `markdown-actions.html` | `single.html`、`gallery/single.html`、`notes/single.html`（标题元信息区） | `$s.hasAny`（由 `actions-state.html` 计算） |
| `actions-state.html` | `markdown-actions.html`、`edit-page.html`、各 single 模板 | 始终（计算 `hasGitHub`/`hasMarkdown`/`hasAny` 谓词，供文章操作区 gate 共用） |
| `ai-label.html` | `single.html`（`post-header` 内 meta 行之后） | 文章 `ai` 为 `assisted`/`generated` 且 `aiLabel.enabled` 非 `false` |
| `page-title.html` | `head.html`、`seo.html`、`_default/rss.xml` | 始终（Notes 提供无标题回退） |
| `note-source.html` | `notes-list.html`、`notes/single.html` | Note 设置 `source` 列表 |
| `note-tags.html` | `notes-list.html` | Note 列表使用 `note_tags` 的 `#tag` 展示 |
| `notes-list.html` | `notes/list.html`、`note_tags/term.html` | 渲染 Notes 时间线、按月分组与分页 |
| `note-detail-tags.html` | `notes/single.html` | Note 详情使用 `note_tags`，保留 `.post-tag` 展示样式 |
| `post-tags.html` | `_default/single.html` | Blog 使用 `tags` 的标签展示 |
| `copy-button.html` | `single.html`、`gallery/single.html`、Notes 列表/详情、`note_tags/term.html` | 始终（在操作按钮前定义 `bindCopyButton`） |
| `code-toolbar.html` | `single.html`、`gallery/single.html`、Notes 列表/详情、`note_tags/term.html`（`</body>` 前） | 始终（运行时：绑定复制、折叠交互、缩进块包装） |
| `image-loading.html` | `_default/single.html`、`gallery/single.html`、Notes 列表/详情、`note_tags/term.html` | `image.enabled` + `image.loading` 启用且非首页 |
| `image-tag.html` | `_markup/render-image.html`、`gallery/single.html` | 始终（共享 `<img>` 尺寸解析与骨架屏渲染） |
| `edit-page.html` | `single.html`、`gallery/single.html`、`notes/single.html`（内容底部） | `actions.enabled` + `actions.editPage.enabled` 且 `.File` 存在 |
| `edit-urls.html` | `edit-page.html`、`markdown-actions.html` | `actions.editPage` 配置且 `.File` 存在 |
| `icon.html` | 各模板（图标处） | 始终（内联 SVG 图标 partial，源在 `assets/icons/*.svg`） |

正文宽表格由 `ui.html` 包装为局部横向滚动区域，仅溢出时提供键盘焦点和滑动提示。代码块、宽表格及块级公式限制横向 overscroll，避免手势越过内容边界。全局链接 hover 保持字重稳定。

### 图标系统

- **源**：所有图标为独立 SVG 文件，位于 `assets/icons/*.svg`（含 `xmlns`，可被图像软件独立查看/预览）。
- **渲染**：`partials/icon.html` 在构建期 `resources.Get` 读取图标文件并内联进 HTML。内联时**去除 `xmlns`**（HTML 中 svg 无需命名空间）并按参数注入 `class`。
- **用法**：
  - `{{ partial "icon.html" (dict "name" "copy") }}` → 裸 svg
  - `{{ partial "icon.html" (dict "name" "copy" "wrap" "action-icon" "wrapClass" "state-icon state-icon-default") }}` → `<span class="action-icon..."><svg>...</svg></span>`
- **着色**：`.action-icon svg { stroke: currentColor }`（actions.css），图标不硬编码颜色，跟随主题 CSS 变量。
- **运行时 JS**：`code-toolbar.html` 缩进块运行时包装用的图标保留单处 `COPY_ICONS` 常量（构建期 partial 无法进入 JS 字符串）。

### 代码块工具栏

- `_markup/render-codeblock.html`：**构建期**复刻 Chroma 输出（`transform.HighlightCodeBlock`，保留 fence 的 `.Options`/`.Attributes` 并尊重站点 `[markup.highlight]`），并预构建工具栏结构：`.code-block-wrapper` + 语言标签（`LANG_MAP` 映射，构建期生成）+ 复制按钮（`data-copy-block`）。行数超过 `codeMaxLines`（默认 15）时预置 `is-folded` + 展开按钮（`data-lines`）。
- `code-toolbar.html`（运行时，约 50 行 JS）只做交互部分：
  1. 给构建期 `[data-copy-block]` 按钮绑定复制（取同 wrapper 的 `code` 文本）。
  2. 折叠交互：toggle `is-folded`；**高度校验**——实际渲染高度 ≤ `--code-fold-max`（CSS 变量，variables.css，默认 360px）时移除折叠（构建期按行数预判，运行时按真实高度校正），展开动画用 `--code-height`。
  3. 缩进式代码块（裸 `<pre>`，`render-codeblock` 不接管）运行时包装 `.plain-code-wrapper` + 浮动复制按钮。
  4. 复制由 `copy-button.html` 的 `bindCopyButton()` 实现（`navigator.clipboard` → `execCommand` 降级）；复制结果在按钮附近显示短提示，并通过 `role="status"` 播报。长代码收起前将代码块入口恢复到当前视口，宽窄两种滚动容器均处理。

### 图片增强

`image-tag.html` 统一处理四种场景：

1. **页面资源解析**：尝试以 `Resources.GetMatch` 解析图片尺寸（跳过 SVG）。
2. **懒加载**：`image.lazy` 启用时添加原生 `loading="lazy"`。
3. **骨架屏与失败重试**：`image.loading` 启用时（且 `image.enabled`、非首页、非 SVG），包装 `.loading-image-frame`（构建期预置 `is-loading` 初始态），内嵌 shimmer 骨架和失败占位。加载失败后点击重试（URL 追加 `?retry=` 参数破缓存）。`image-loading.html` 运行时仅处理浏览器缓存图（`img.complete` 检查）与 load/error/retry 事件。
4. **柔和内描边**：`image.border` 为正文图片添加 `.image-bordered`，Gallery 使用独立的 `image.galleryBorder`，均默认关闭且跳过 SVG。通过负偏移 `outline` 在图片内部绘制 1.5px 半透明边线，颜色由亮暗主题变量控制，不增加布局尺寸或 DOM，且不依赖加载增强。

### TOC 系统

`toc.html` + `toc-script.html` 实现自适应目录：

- **宽屏（≥84em）**：侧边栏固定在页面右侧 `left: calc(50% + 432px)`，始终可见。
- **窄屏**：浮动按钮 `#tocFloatBtn` + 全屏遮罩 `#tocBackdrop`，点击展开滑出面板；打开时移入焦点、以 `inert` 隔离背景并锁定滚动，提供面板关闭按钮、Esc 关闭、Tab 焦点锁定，关闭后恢复背景与焦点。
- **Scroll-spy**：解析 TOC 链接对应的 heading，计算当前视口内可见的 heading，以柔和主题色高亮对应链接并移动 `.toc-indicator` 指示条位置；hover 仅过渡文字颜色，不使用背景块或下划线。主动跳转后短暂标记目标标题。滚动自动跟随（`scrollBy`，平滑由 CSS `scroll-behavior: smooth` 驱动）。

### 脚注系统

`footnotes.html` 拦截所有 `#fn:*` / `#fnref:*` 链接点击：

- **tooltip**：自动为脚注链接添加 `data-tooltip`（"查看脚注 N" / "返回引用处"）。
- **滚动与高亮**：点击后居中目标并触发当前配色的脉冲动画（`footnote-highlight` / `ref-highlight` CSS class）。
- **双模式滚动**：宽屏使用 `scrollIntoView`，窄屏手动计算 `app-scroll` 内的滚动偏移。

### 数学公式

- `_markup/render-passthrough.html`：配合 Goldmark passthrough 扩展，在构建期调用 Hugo 内置 `transform.ToMath`（内嵌 KaTeX 引擎）将 `$...$` / `$$...$$` 服务端渲染为 KaTeX HTML（`output: htmlAndMathml`，`displayMode` 按 `.Type`，`throwOnError: false`）。`hugo server` 与生产构建均零 JS、零跳变。
- `math.html`：正则扫描 `.RawContent` 中的 `$$` / `$...$`，仅在检测到公式时内联 `assets/css/katex.min.css`（`partialCached` 按 `RelPermalink` 缓存检测结果），并把 CSS 内字体 URL 改写为绝对路径 `/fonts/katex/...`。字体 vendored 于 `static/fonts/katex/`（KaTeX 0.17.0，须与 Hugo 内置版本保持一致；0.18 起 class 有 breaking change）。
- 书写注意：裸 `<`/`>` 请用 `\lt`/`\gt`，对齐 `&` 用 `\&`；换行用 `\\`（双反斜杠）；**块级公式内 `=`/`-` 等标记不能单独成行**（会被 markdown 解析为 setext 标题，打断 `$$` 块导致公式失效，如 `\begin{pmatrix} x \\ y \end{pmatrix}\n=`）；非法 LaTeX 使用当前配色的 `--color-error` 渲染为内联标注而非阻断构建。`copyMarkdown` 复制的仍是原始 `$...$` markdown，不受影响。

### Gallery 内容类型

`gallery/single.html` 渲染 `Params.gallery`（`{url, name}` 对象数组），使用 `image-tag.html` 渲染每张图片，宽屏两列、手机单列网格布局。与 `single.html` 共享 markdown-actions、edit-page、图片加载、代码工具栏 partial。

### Notes 内容类型

- `content/notes/YYYY-MM/NNN.md`：目录决定内容类型，文件名是当月三位递增序号；默认 URL 与内容路径一致。
- `notes/list.html`：对 Notes 分页后调用 `notes-list.html`；每页固定 30 条，倒序后按月分组，直接展开完整正文。
- `notes/single.html`：渲染日期、可选标题、来源、正文和独立 `note_tags`，并复用 Markdown 复制、GitHub 编辑/Raw 与底部纠错入口；不加载 TOC、AI 标注或文章首尾注入。
- `note_tags` taxonomy：与 Blog 的 `tags` 完全隔离；总览位于 `/notes/tags/`，条目页位于 `/notes/tags/<tag>/`，并通过 `note_tags/term.html` 复用 Notes 时间线样式。
- `page-title.html`：Notes 无显式标题时使用纯文本正文前 60 个字符，空正文回退日期时间；head、JSON-LD 和 Notes RSS 共享此结果。
- `note-source.html`：遍历 `source` 列表；`[标题](URL)` 显示指定标题，裸 URL 显示来源域名，普通文字直接显示，不抓取远端标题。
- `_default/rss.xml`：基于 Hugo v0.165 内置模板，首页 Blog feed 仅包含 `mainSections`，Notes section feed 仅包含 Notes。`[outputs].home` 和定向 `/notes` 的 `cascade.outputs` 分别控制两者；taxonomy/term 仅输出 HTML。
- `exampleSite/note.nu`：无参数创建脚本，计算当月下一序号后调用 `hugo new content` 并以 VS Code 打开；发布流程不在脚本内。
- `exampleSite/blog.nu`：无参数长文创建脚本，以时间戳创建 `posts` Page Bundle，套用 `archetypes/posts/index.md` 后以 VS Code 打开；默认草稿且不负责发布。

## 配置参数（全部位于 `[params]` 下）

- `headTitle` — 页头展示标题（回退到 `author.name`）
- `description` — meta description 和页头副标题
- `mainSections` — 首页和列表页展示的 content sections
- `author.name` / `author.homepage` — SEO JSON-LD 使用
- `socials` — 页头链接数组，`{name, link}`
- `favicon` — 网站图标路径
- `extraHead` — 注入 `</head>` 前的原始 HTML
- `extraBody` — 注入 `</body>` 前的原始 HTML
- `postContent` — 站点配置（映射），文章首尾注入：`enabled`（布尔值，总闸）、`header` / `footer`（文章正文前后的注入 HTML，`safeHTML`）
- `extraCSSFiles` — 额外 CSS 路径数组，以 `<link>` 加载
- `colorScheme` — 站点配置（映射），配色方案：`default`（默认 `indigo`）、`available`（允许 `indigo` / `violet` / `graphite`）、`allowUserChoice`（多于一套有效配色时显示选择器）
- `staticPrefix` — CDN 前缀，同时生成 `dns-prefetch`
- `image` — 站点配置（映射），图片增强：`enabled`（布尔值，总闸）、`lazy`（布尔值，为 `<img>` 添加 `loading="lazy"`）、`loading`（布尔值，启用骨架屏 + 加载失败重试，首页不生效）、`border` / `galleryBorder`（布尔值，分别启用正文 / Gallery 图片的柔和内描边，默认关闭，跳过 SVG）
- `actions` — 站点配置（映射），文章操作区总开关与子功能：`enabled`（布尔值，总闸，`false` 或未配时编辑/复制按钮全部不渲染）、`copyMarkdown`（布尔值，启用"复制 Markdown"按钮）、嵌套 `editPage`（`enabled` 布尔值 + `repo` GitHub 仓库 URL + `branch` 分支名默认 `main` + `text` 纠错链接文字）。编辑按钮需 `actions.enabled` + `editPage.enabled` + `editPage.repo` 同时满足
- `tableOfContents` — 布尔值，启用 TOC 侧边栏
- `codeMaxLines` — 代码块折叠阈值，默认 15
- `album` — 单页 Open Graph 图片覆盖（字符串数组）
- `toc` — 文章 front matter（布尔值），单篇禁用 TOC；也兼容旧字段 `notoc`
- `ai` — 文章 front matter（字符串），标注 AI 创作方式：`none`（纯人，缺省等同）/ `assisted`（AI 辅助创作）/ `generated`（AI 生成·经人工编辑）。`assisted`/`generated` 时由 `ai-label.html` partial（`single.html` 的 `post-header` 内 meta 行之后调用）渲染 `.ai-label` 标注行（复用 `.action-icon` 图标约定 + 弱色小字，CSS 在 `post-page.css`）；`none`、缺省或未知值不渲染。仅覆盖 `single`，gallery 不进
- `aiLabel` — 站点配置（映射），AI 标注总开关与文案：`enabled`（布尔值，缺省视为开启，`false` 关闭所有标注渲染）、`assisted` / `generated`（字符串，自定义文案，缺省回退默认 `AI 辅助创作` / `AI 生成 · 经人工编辑`）
