## 项目概述

YinYang 是极简 Hugo 博客主题，支持 Blog 长文、Notes 完整正文时间线与 Gallery 图库。提供独立标签与 RSS、明暗和配色切换、无刷新导航、响应式目录、脚注跳转、代码复制折叠、图片加载增强、构建期数学公式、SEO 与可选访问统计。

## 开发与验证

在仓库根目录执行，PowerShell / Nushell 均可使用：

```shell
hugo server -s exampleSite --themesDir ../.. --theme hugo-theme-yinyang
hugo -s exampleSite --themesDir ../.. --theme hugo-theme-yinyang
node --expose-gc --test
```

主题由 Hugo 直接构建，回归测试使用 Node 内置测试运行器；没有 npm 构建或代码检查工具链。测试命令使用自动发现，避免 Windows 下 shell 不展开通配符的问题。独立 fixture 与生命周期测试保护渲染结果和公开协议；交互、布局与焦点仍需真实浏览器验证。

## 架构与边界

### 页面与构建层

所有 HTML 页面继承 `layouts/_default/baseof.html`，包括首页、列表、Blog / Notes / Gallery 详情、taxonomy / term 和 404。页面模板只定义 `main` 和可选 `toc` block；公共 Head、Header、应用外壳与 Body 扩展入口统一在 baseof 装配，不再逐页复制。

- `head.html`：调用 `runtime-head.html`，装配页面元信息、feed、CSS、数学样式与 `extraHead`。`page-metadata.html` 共用标题、描述、分享图片和 JSON-LD 页面类型；`page-title.html` 提供 Notes 无标题回退；`site-url.html` 处理站点子目录 URL。
- `runtime-head.html`：内联页面生命周期内核，通过 Hugo 合并、压缩、指纹化并 defer 加载主题 JS；同步解析明暗和配色偏好，避免首次加载外观闪烁。
- `runtime-body.html`：输出 `#yinyang-page-config` JSON（palette、imageLoading、footnotes、copyIcons）和 tooltip 容器；随后 baseof 注入 `extraBody`。
- 内容 partial 保留构建期职责：文章列表与标签、Notes 来源 / 标签、操作区与编辑 URL、图片结构、代码工具栏与公式 HTML。功能脚本位于 `assets/js/`，不再通过逐页脚本 partial 装配。

CSS 由 `head.html` 将 16 个文件按 variables → global → site-header → theme-toggle → posts-list → notes → post-page → taxonomy → gallery → footnotes → app-shell → code-blocks → actions → toc → image-loading → mobile 合并、压缩后内联。`syntax.css` 独立压缩内联，KaTeX CSS 按实际渲染内容加载；`extraCSSFiles` 生成独立样式链接。

### 页面生命周期与功能层

`assets/js/page-runtime.js` 建立 `window.yinyangRuntime`。一次加载的主题 bundle 按显式顺序注册功能初始化函数；`mount()` 读取当前页面配置、创建 `page.scroll` 服务，然后初始化功能。首次初始化由 defer bundle 执行，发生在 HTML 解析完成后；正文末尾的普通同步脚本执行时，主题功能和兼容 helper 尚未初始化。

`window.yinyangRuntime.page` 保留扩展协议：`listen` / `unlisten`、`setTimeout` / `clearTimeout`、`requestAnimationFrame` / `cancelAnimationFrame`、`guard`、`addCleanup`、`expose`、`pushHash`。离开页面时 dispose 清理这些托管资源；观察器和自定义资源须主动注册 cleanup，guard 只阻止页面失效后的回调。单个 cleanup 抛错不会阻止其余 cleanup。

功能内部使用当前 page 服务，避免依赖全局 helper：

| 层 | 文件与职责 |
|---|---|
| 滚动 | `scroll.js` 统一容器、视口坐标、目标定位、阅读快照与滚动 / 模式订阅 |
| 通用交互 | `ui-helpers.js`、`tooltip.js`、`copy.js` 提供标签更新、浮层定位、动画结束清理与复制反馈 |
| 阅读增强 | `tables.js`、`scrollbar.js`、`code-toolbar.js`、`image-loading.js` 管理局部滚动、代码和图片状态 |
| 页面功能 | `header-nav.js`、`appearance.js`、`toc.js`、`footnotes.js`、`markdown-actions.js` 按 DOM / 配置初始化 |
| 导航 | `navigation.js` 管理获取、校验、提交、脚本重放与历史恢复 |

`isWide`、`bindCopyButton`、`updateActionTooltip`、`hideActionTooltip` 保留为当前页面的全局兼容出口，页面销毁时移除、mount 时重新提供。新增功能使用 page 接口；滚动订阅返回的取消函数应交给 `addCleanup`。

### 双模式滚动与导航

窄屏（< 84em）在 `#appScroll` 内滚动，body 固定；宽屏（≥ 84em）由窗口滚动，app-scroll 回归普通流。`page.scroll` 提供 `isWide`、`element`、`viewport`、`position`、`capture`、`restore`、`target`、`scrollToElement`、`onChange` 和 `onModeChange`。跨断点保存正文锚点及视口偏移，再转移到新容器；普通锚点默认预留 64px，脚注居中，代码收起预留 24px。

普通同源 HTML 链接使用 Fetch + History API。新标签页、修饰键点击、下载、资源链接、外链及 `data-no-pjax` 保留原生行为。目标缺少主题结构、运行时版本变化、当前或目标正文含未托管的可执行脚本或内联 module，或请求 / 脚本加载失败时回退完整导航。

提交前发出 `yinyang:before-navigate`，销毁旧 page，更新 `data-page-head` 节点并替换 body；外观属性保留在 documentElement。新页面 mount 后顺序重放 `data-page-runtime` 正文脚本，等待外部经典脚本和外部 module 的 load，再恢复焦点与阅读状态。内联 module 不进入无刷新导航，避免依赖不存在的 load 完成事件或改写模块导入语义。已插入脚本不能回滚，初始化期间的锚点操作显示正文并保留最新目标，再次跨页使用完整导航。恢复代次防止旧异步定位覆盖新操作。首次加载、普通 fragment 和脚注入口由导航统一路由。`yinyang:page-ready` 在初始化和滚动恢复后由 document 发出，包含 `detail.url`；它不等待所有图片、字体或第三方统计完成。

历史恢复保存正文锚点及其视口偏移、代码展开状态，以及代码、表格、块级公式和缩进代码的横向位置。状态保存在当前文档内存中，不承诺刷新后恢复。页面进入动画仅作用于 article（200ms opacity + 6px translateY），Header 不参与；超过 120ms 的请求显示进度与状态提示。

### 自定义脚本

`extraHead` 适合只加载一次的全局集成。`extraBody` / 正文中需随导航重新执行的脚本标记 `data-page-runtime`，使用当前 page 管理资源。首次加载的 footer 脚本如需主题 helper，应监听 `yinyang:page-ready`；该脚本在后续导航重放时，主题功能已经 mount，不能假定首次加载也有相同时序。主题不会重放自定义 Head 脚本。

事件是通知，不是可取消导航钩子。初始化时机、事件资源清理和自定义脚本依赖应由集成自身明确处理，不将全局监听重复注册到每个页面。

## 内容渲染

### 代码、图片与目录

`_markup/render-codeblock.html` 使用 `transform.HighlightCodeBlock` 保留 fence Options / Attributes 与站点高亮配置，构建语言标签、复制按钮和按 `codeMaxLines`（默认 15）预判的折叠结构。`code-toolbar.js` 绑定交互、按真实高度校正折叠，并包装缩进代码块。复制使用 Clipboard API → execCommand 降级，反馈带状态播报与关闭动画。

`image-tag.html` 解析页面资源尺寸（跳过 SVG），输出原生懒加载、可选骨架与失败占位；`image-loading.js` 管理缓存图、解码、淡入与破缓存重试。`image.border` / `galleryBorder` 独立控制正文 / Gallery 内描边，默认关闭、不影响布局且跳过 SVG。

`toc.html` 仅渲染目录结构，`toc.js` 管理宽屏侧栏、窄屏浮层、焦点与滚动监听；`toc: false` 或旧 `notoc: true` 均禁用目录。`footnotes.js` 按脚注链接语义识别跳转，兼容 Hugo 和 Notes 添加的 ID 前缀。

### 数学公式

`_markup/render-passthrough.html` 配合 Goldmark passthrough，在构建期调用 Hugo `transform.ToMath`，输出 HTML + MathML；非法 LaTeX 使用错误颜色标注，不阻断构建。`math.html` 检查实际渲染 HTML 中的 KaTeX 标记；Notes 时间线通过共用 `notes-paginator.html` 检查当前分页内容，包含标签时间线。字体 URL 使用站点相对路径，支持 baseURL 子目录。

KaTeX 样式和 `static/fonts/katex/` vendored 字体须与 Hugo 内置版本匹配（当前 0.17.0；0.18 起 class 有 breaking change）。裸 `<` / `>` 使用 `\lt` / `\gt`，对齐 `&` 使用 `\&`，换行用双反斜杠。块级公式内 `=` / `-` 等标记不能单独成行，否则 Markdown 可能将其解析为 setext 标题，打断公式块。Markdown 复制保留原始公式源码。

### Notes、Blog 与 Gallery

- Notes 位于 `content/notes/YYYY-MM/NNN.md`，每月三位递增序号；标题、来源和 `note_tags` 可选。列表每页 30 条，倒序按月分组展示完整正文。
- `note-content.html` 为聚合时间线中每条 Note 的 ID、命名锚点和本地 fragment 添加稳定前缀，同时更新 label / ARIA 等 ID 引用；引用本 Note 之外目标的链接保持原样。详情页保留原始正文 ID。
- `note_tags` 与 Blog `tags` 隔离，总览 `/notes/tags/`，条目 `/notes/tags/<tag>/`；URL 使用 Hugo taxonomy / term 页面链接。
- `page-title.html` 为无标题 Note 使用正文前 60 字，空正文回退日期时间；浏览器元信息、JSON-LD 与 RSS 共用。`note-source.html` 支持 `[标题](URL)`、裸 URL 域名与普通文字，不抓取远端标题。
- Notes 详情复用文章操作和纠错入口，不包含 TOC、AI 标注或文章首尾注入。Blog 详情支持这些功能；Gallery 使用 `Params.gallery` 的 `{url, name}` 数组，宽屏两列、手机单列，共用图片和文章操作。
- Blog RSS 只包含 `mainSections`，Notes section RSS 只包含 Notes；首页 outputs 与定向 `/notes` 的 cascade 分别控制。taxonomy / term 仅输出 HTML。
- `exampleSite/note.nu` / `blog.nu` 无参数创建内容并通过 VS Code 打开；Blog 使用时间戳 Page Bundle 且默认草稿。脚本不负责发布。

## 跨功能约定

- 可见颜色使用 `variables.css` 的亮 / 暗 CSS 变量。明暗与配色独立，`theme-changing` 短暂禁用全局过渡；主动明暗切换在支持的浏览器使用圆形 View Transition。
- 图标源位于 `assets/icons/*.svg`，`icon.html` 构建期内联并移除 xmlns，通过 currentColor 着色；运行时复制图标由页面 JSON 配置提供。
- 动画结束监听使用生命周期工具，并带计时器兜底；销毁 DOM 前等待关闭动画，页面 dispose 时直接清理。
- 模态使用 dialog / aria-modal，打开移入焦点、Esc 关闭、Tab 陷阱、关闭归还焦点；锁定背景须同时覆盖宽屏 html/body 与窄屏 appScroll，保存并恢复位置。
- 动态交互采用页面生命周期管理的 document 委托和打开态 guard；浮层按需创建、关闭后销毁，动态文本使用 textContent。
- TOC backdrop / 面板 / 按钮层级为 998 / 1000 / 1001，全屏模态使用 2000；模态控件用 aria-label，不挂 data-tooltip。
- 宽表格仅溢出时提供焦点和滑动提示；代码、表格与块级公式限制横向 overscroll。全局链接 hover 保持字重稳定。

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
