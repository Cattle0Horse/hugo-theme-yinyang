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
- `runtime-head.html`：内联页面生命周期内核，通过 Hugo 合并、压缩、指纹化并 defer 加载公共主题 JS；同步解析明暗和配色偏好，避免首次加载外观闪烁。
- `runtime-body.html`：输出 `#yinyang-page-config` JSON（palette、imageLoading、footnotes、copyIcons）和 tooltip 容器；随后 baseof 注入 `extraBody`。
- 内容 partial 保留构建期职责：文章列表与标签、Notes 来源 / 标签、操作区与编辑 URL、图片结构、代码工具栏与公式 HTML。功能脚本位于 `assets/js/`，不再通过逐页脚本 partial 装配。

CSS 由 `head.html` 将 15 个文件按 variables → global → site-header → theme-toggle → posts-list → notes → post-page → taxonomy → gallery → footnotes → app-shell → code-blocks → actions → toc → image-loading 合并、压缩后内联。`fonts.css` 独立压缩、指纹化并以样式链接加载，`syntax.css` 独立压缩内联，KaTeX CSS 按实际渲染内容加载；`extraCSSFiles` 生成独立样式链接。

### 页面生命周期与功能层

`assets/js/page-runtime.js` 建立 `window.yinyangRuntime`。一次加载的主题 bundle 按显式顺序注册功能初始化函数；`mount()` 读取当前页面配置、创建 `page.scroll` 服务，然后初始化功能。首次初始化由 defer bundle 执行，发生在 HTML 解析完成后；正文末尾的普通同步脚本执行时，当前 page 的功能服务尚未初始化。

`window.yinyangRuntime.page` 保留扩展协议：`listen` / `unlisten`、`setTimeout` / `clearTimeout`、`requestAnimationFrame` / `cancelAnimationFrame`、`guard`、`addCleanup`、`expose`、`pushHash`。离开页面时 dispose 清理这些托管资源；观察器和自定义资源须主动注册 cleanup，guard 只阻止页面失效后的回调。单个 cleanup 抛错不会阻止其余 cleanup。

功能通过当前 page 服务协作：

| 层 | 文件与职责 |
|---|---|
| 滚动 | `scroll.js` 统一容器、视口坐标、目标定位、阅读快照与滚动 / 模式订阅 |
| 通用交互 | `ui-helpers.js`、`tooltip.js`、`copy.js` 提供标签更新、浮层定位、动画结束清理与复制反馈 |
| 阅读增强 | `tables.js`、`scrollbar.js`、`code-toolbar.js`、`image-loading.js` 管理局部滚动、代码和图片状态 |
| 页面功能 | `header-nav.js`、`appearance.js`、`toc.js`、`footnotes.js`、`markdown-actions.js` 按 DOM / 配置初始化 |
| 缺页互动 | `not-found.js` 按设备选择场景，`not-found-resources.js` 管理资源请求与脚本缓存；`not-found-scene.js` 提供托管的指针 / 动画工具，随选中的 `js/not-found/*.js` 一起加载 |
| 导航 | `navigation.js` 管理获取、校验、提交、脚本重放与历史恢复 |

自定义脚本通过当前 `window.yinyangRuntime.page` 使用 `scroll.isWide()`、`bindCopyButton()`、`tooltip.update()` 和 `tooltip.hide()`。滚动订阅返回的取消函数应交给 `addCleanup`。

### 双模式滚动与导航

窄屏（< 84em）在 `#appScroll` 内滚动，body 固定；宽屏（≥ 84em）由窗口滚动，app-scroll 回归普通流。`page.scroll` 提供 `isWide`、`element`、`viewport`、`position`、`capture`、`restore`、`target`、`scrollToElement`、`onChange` 和 `onModeChange`。窄屏 appScroll 与宽屏 html 均通过 scrollbar-gutter: stable 预留滚动条空间，避免长短页切换时 Header 和正文横移。跨断点保存正文锚点及视口偏移，再转移到新容器；普通锚点默认预留 64px，脚注居中，代码收起预留 24px。

普通同源 HTML 链接使用 Fetch + History API。新标签页、修饰键点击、下载、资源链接、外链及 `data-no-pjax` 保留原生行为。目标缺少主题结构、运行时版本变化、当前或目标正文含未托管的可执行脚本或内联 module，或请求 / 脚本加载失败时回退完整导航。

获取并校验目标 HTML 后，含公式的目标页先准备 `data-page-math` 样式与公式实际使用的字体；通过屏幕外的公式副本获取字库需求，当前页面和交互保持可用，仅显示加载提示。点击导航的地址与正文在准备结束后一起提交；新的导航或当前页锚点操作会取消准备、移除临时副本和新增样式。资源失败或总等待超过 8 秒时继续切换，避免导航被 CDN 永久阻塞。

提交前发出 `yinyang:before-navigate`，销毁旧 page，更新 `data-page-head` 节点并替换 body；外观属性保留在 documentElement。普通链接切换对 article 及其后的页尾内容进行 240ms CSS 交叉淡化，目录侧栏与悬浮入口同步淡入；挂载前保留旧正文和页尾的不可交互视觉副本，清除副本 ID 和脚本，等待阅读次数时覆盖新正文。加载提示独立运行，不使用会暂停渲染的 View Transition 更新回调。统计完成或最多等待 800ms 后，在滚动恢复完成时交叉淡化并清理副本；Header 和背景不参与动画，无位移和中间空白。统计失败或超时会移除本页阅读次数，避免稍后突现；没有阅读次数的页面不等待统计。历史恢复和带 fragment 的导航直接切换；初始化期间的锚点操作立即移除副本、显示新正文，页面销毁时也清理副本。新页面 mount 后顺序重放 `data-page-runtime` 正文脚本，等待外部经典脚本和外部 module 的 load，再恢复焦点与阅读状态。内联 module 不进入无刷新导航，避免依赖不存在的 load 完成事件或改写模块导入语义。已插入脚本不能回滚，初始化期间的锚点操作保留最新目标，再次跨页使用完整导航。恢复代次防止旧异步定位覆盖新操作。首次加载、普通 fragment 和脚注入口由导航统一路由。`yinyang:page-ready` 在初始化和滚动恢复后由 document 发出，包含 `detail.url`；它不等待所有图片、全站字体或无可见阅读次数的后台统计；无刷新切换的可见阅读次数已完成等待或超时兜底，首次加载不额外等待公式或统计资源。

### 自定义脚本

`extraHead` 适合只加载一次的全局集成。`extraBody` / 正文中需随导航重新执行的脚本标记 `data-page-runtime`，使用当前 page 管理资源。首次加载的 footer 脚本如需使用 page 上的主题服务，应监听 `yinyang:page-ready`；该脚本在后续导航重放时，主题功能已经 mount，不能假定首次加载也有相同时序。主题不会重放自定义 Head 脚本。

事件是通知，不是可取消导航钩子。初始化时机、事件资源清理和自定义脚本依赖应由集成自身明确处理，不将全局监听重复注册到每个页面。

## 内容渲染

### 代码、图片与目录

`_markup/render-codeblock.html` 使用 `transform.HighlightCodeBlock` 保留 fence Options / Attributes 与站点高亮配置，构建语言标签、复制按钮和按 `codeMaxLines`（默认 15）预判的折叠结构。`code-toolbar.js` 绑定交互、按真实高度校正折叠，并包装缩进代码块。复制使用 Clipboard API → execCommand 降级，反馈带状态播报与关闭动画。

`image-tag.html` 解析页面资源尺寸（跳过 SVG），输出原生懒加载、可选骨架与失败占位；`image-loading.js` 管理缓存图、解码、淡入与破缓存重试。已知尺寸的图片在加载、失败、重试与成功时保持同一宽高占位，矮图的失败反馈使用横排，避免最小高度撑开正文。`image.border` / `galleryBorder` 独立控制正文 / Gallery 内描边，默认关闭、不影响布局且跳过 SVG。

`toc.html` 仅渲染目录结构，`toc.js` 管理宽屏侧栏、窄屏浮层、焦点与滚动监听；`toc: false` 禁用目录。`footnotes.js` 按脚注链接语义识别跳转，兼容 Hugo 和 Notes 添加的 ID 前缀。

手机（≤ 600px）使用吸顶紧凑页头，当前栏目按钮展开单列导航，长名称允许换行。`socials.icon` 指向 `assets/icons/<name>.svg`，可由站点资源提供或覆盖，缺省或资源不存在时保留纯文字。桌面空间不足时也使用单列菜单。窄屏 TOC 使用右下角 44px 纯图标圆形入口和悬浮卡片，卡片内部滚动、突出当前章节；打开时隔离背景，关闭恢复阅读位置，跳转避让吸顶页头。宽屏保留侧栏与可见章节范围指示。

### 数学公式

`_markup/render-passthrough.html` 配合 Goldmark passthrough，在构建期调用 Hugo `transform.ToMath`，输出 HTML + MathML；非法 LaTeX 使用错误颜色标注，不阻断构建。`math.html` 检查实际渲染 HTML 中的 KaTeX 标记；Notes 时间线通过共用 `notes-paginator.html` 检查当前分页内容，包含标签时间线。含公式时输出带 `data-page-head`、SRI 和 crossorigin 的 jsDelivr KaTeX 0.19.0 CSS 链接，字体随 CSS 从 CDN 加载，不包含浏览器公式渲染 JS 或本地 KaTeX 资源。

KaTeX CDN 固定为 0.19.0，不使用浮动 latest URL；升级须验证 Hugo 构建输出与样式兼容，尤其 0.18 起部分类名添加 `katex-` 前缀（当前 Hugo 0.168.0 已验证）。裸 `<` / `>` 使用 `\lt` / `\gt`，对齐 `&` 使用 `\&`，换行用双反斜杠。块级公式内 `=` / `-` 等标记不能单独成行，否则 Markdown 可能将其解析为 setext 标题，打断公式块。Markdown 复制保留原始公式源码。

### Notes、Blog 与 Gallery

- Notes 位于 `content/notes/YYYY-MM/NNN.md`，每月三位递增序号；标题、来源和 `note_tags` 可选。列表每页 30 条，倒序按月分组展示完整正文。
- `note-content.html` 为聚合时间线中每条 Note 的 ID、命名锚点和本地 fragment 添加稳定前缀，同时更新 label / ARIA 等 ID 引用；引用本 Note 之外目标的链接保持原样。详情页保留原始正文 ID。
- `note_tags` 与 Blog `tags` 隔离，总览 `/notes/tags/`，条目 `/notes/tags/<tag>/`；URL 使用 Hugo taxonomy / term 页面链接。
- `page-title.html` 为无标题 Note 使用正文前 60 字，空正文回退日期时间；浏览器元信息、JSON-LD 与 RSS 共用。`note-source.html` 支持 `[标题](URL)`、裸 URL 域名与普通文字，不抓取远端标题。
- Notes 详情复用文章操作和纠错入口，不包含 TOC、AI 标注或文章首尾注入。Blog 详情支持这些功能；Gallery 使用 `Params.gallery` 的 `{url, name}` 数组，宽屏两列、手机单列，共用图片和文章操作。
- Blog RSS 只包含 `mainSections`，Notes section RSS 只包含 Notes；首页 outputs 与定向 `/notes` 的 cascade 分别控制。taxonomy / term 仅输出 HTML。
- `exampleSite/note.nu` / `blog.nu` 无参数创建内容并通过 VS Code 打开；Blog 使用时间戳 Page Bundle 且默认草稿。脚本不负责发布。

## 跨功能约定

404 的 `params.notFound.available` 指定启用列表，支持 `sleep` / `black-hole` / `flashlight` / `receipt` / `constellation` / `puzzle` / `terminal` / `channel` / `cat` / `draw-home`。各场景模板根元素通过 `data-nf-devices` 声明适用的 `mobile` / `desktop`；`flashlight`、`constellation`、`terminal` 仅桌面，其余两端均适用。浏览器每次 mount 按视口 ≤ 600px 为移动端、其余为桌面端筛选已启用模板，再从适配项中随机选择；单项固定，无匹配时保留普通 404 与首页链接，不越过 available。调整窗口大小保留当前互动，下次 mount 重新筛选。场景资源成功后才显示互动；失败或 8 秒超时保留普通 404。`page.notFoundReady` 在完成或兜底后结束，导航等待它再恢复滚动并发出 page-ready；离页会结束该页等待，脚本按资源指纹 URL 缓存场景定义，不保留旧 page；新版本加载失败时不会误用旧版本。`not-found-state.html` 统一过滤、去重；未配置、空数组或无有效项时启用全部。`layouts/404.html` 通过 `not-found-assets.html` 输出已启用场景的设备标记和资源地址，Head 仅内联公共 404 CSS。选中后请求该场景的一份 CSS 和一份 JS；JS 在构建期封装公共场景工具、独立 initialize 函数和插画 HTML，只有终端 / 电台附带文章列表。场景 JS 不进入全站 bundle。每款分别放在 `layouts/partials/not-found/`、`assets/css/not-found/`、`assets/js/not-found/`，独立拥有标题、状态区、布局和返回入口；公共文件只提供选择、绘图基础样式及生命周期工具，不装配共同可见组件。无 JS 时保留普通 404 与首页链接。终端 / 电台使用构建期输出的站内文章 URL，画路仅在实际轨迹终点靠近小屋时完成，不自动补齐路线。

共有七款以参考稿的 400×245 SVG 构图为准，使用粗无衬线数字；`cat` 展示名为“是猫干的”，只移动独立圆环零。标题使用 `.nf-sr-only`；操作反馈分别融入气泡、票据盖章、定位标记、拼图结果标签和设备屏显，不共用一行说明。状态保留 role=status 与 aria-live。Web Animations、粒子和弹性跟随通过 page 托管并在 dispose 时取消 / 删除；拖动保留速度和当前动画位置，松手后接续惯性或回弹。`sleep` 初始保持睡着，监听整个 document 的光标，仅在约 700ms 内位移达到 36 CSS 像素时唤醒；点击 / 键盘聚焦直接唤醒，回家入睡阶段锁定唤醒，关闭整体视差；日常只移动眼球，点击时人脸局部弹起并出现星点，重复点击从当前动画位置接续，整体画面和两侧数字保持稳定。星图划过点亮、点击 / 回车揭晓。画路区域禁用文本选择，任意位置下笔后 document 接收拖动，SVG 捕获指针；路径不截断在插画 viewBox，允许绘制到整个可视区域，松手自动出发。实际终点进入小屋范围后跳转首页，否则显示可见提示；点击 / 键盘激活小屋沿预设虚线回家；重新下笔、重画按钮和小球均可重置并中断旧运动，重置与 dispose 会取消待执行的跳转。

所有 404 插画都禁止随光标整幅位移或倾斜，只保留眼球追踪、手电筒光圈、拖动和各款自身动画。`sleep` 的回家入口先锁定唤醒，复用正常入睡的缓慢闭眼与 Zzz 淡入，睡着后人脸以 4.8 秒周期做约 1 像素的呼吸微动、Zzz 持续漂浮；该入口不触发人脸位移或弹跳，等待入睡完成再跳转；动画等待使用生命周期监听和计时器兜底。`black-hole` 保留数字公转、吸积盘脉动与点击吞入 / 捞回。

反馈由各款独立布局：睡脸 / 猫爪气泡、小票短章、黑洞信号条、星图定位标记、拼图结果贴签、电台屏显与终端命令输出；光圈和小球的反馈随各自目标定位到可视区域，不能遮挡交互。小票拖动及旧票撕走不受局部裁切，只有重新送纸时启用打印口裁切。光圈监听整个 document，坐标不截断在插画 viewBox。终端按空白分隔命令，`cd` / `cd ~` / `cd ~/` / `cd /` 返回首页，`pwd` 输出站点首页路径，保留 `home` / `random` / `help` / `ls` / `clear`。

404 图形与反馈颜色使用主题变量，实时跟随 indigo / violet / graphite 及明暗模式；黑洞深色内核也从 `variables.css` 取色。暗色模式中的幽灵使用浅色轮廓与深色眼睛，保持主体可辨识。

- 可见颜色使用 `variables.css` 的亮 / 暗 CSS 变量。明暗与配色独立，`theme-changing` 短暂禁用全局过渡；主动明暗切换在支持的浏览器使用圆形 View Transition。
- 字体使用 `--font-body` / `--font-heading` / `--font-code` 区分正文、标题和代码，标题默认继承所在页面字体；`fonts.css` 通过 UNPKG 加载固定版本 `@zf-web-font/opposans@0.2.0` 的 400 / 500 / 700 字重，通过 jsDelivr 加载 Fira Code 6.2.0 可变字库。正文在桌面和手机上均使用 14px、Regular 400、0.025em 字距和中西文自动间距；段落行高 1.8、下间距 32px；粗体和正文链接使用 600 字重及柔化的主题色。`--color-prose` 管理亮 / 暗正文颜色；代码和公式重置字距与自动间距。使用 `font-display: swap` 并保留系统字体回退，字体文件不随主题分发，示例站无需额外注入字体。正文标题、段落和列表的间距统一在 `global.css` 管理。
- 页头顶部留白由 `.site-header-content` 的 padding 提供，避免标题 margin 沿父级折叠后叠加 `.app-shell` 的整屏最小高度；列表不另设固定最小高度，短页由应用外壳撑满视口。
- 图标源位于 `assets/icons/*.svg`，`icon.html` 构建期内联并移除 xmlns，通过 currentColor 着色；复制按钮三态图标由 `copy-icons.html` 共用，运行时通过页面 JSON 配置提供。
- 动画结束监听使用生命周期工具，并带计时器兜底；销毁 DOM 前等待关闭动画，页面 dispose 时直接清理。
- 模态使用 dialog / aria-modal，打开移入焦点、Esc 关闭、Tab 陷阱、关闭归还焦点；锁定背景须同时覆盖宽屏 html/body 与窄屏 appScroll，保存并恢复位置。
- 动态交互采用页面生命周期管理的 document 委托和打开态 guard；浮层按需创建、关闭后销毁，动态文本使用 textContent。
- TOC backdrop / 面板 / 按钮层级为 998 / 1000 / 1001，全屏模态使用 2000；模态控件用 aria-label，不挂 data-tooltip。
- 宽表格仅溢出时提供焦点和滑动提示；代码、表格与块级公式限制横向 overscroll。链接 hover / focus 与目录激活状态保持字号、字重和字距稳定，通过颜色、背景和指示条反馈，避免文字变宽或重新换行。
- Markdown 表格使用不透明页面底色、淡主题色表头、轻斑马纹和柔和水平分隔线；表格颜色统一由 `variables.css` 的 `--color-table-*` 变量派生，随明暗与配色切换，行内代码在所有行中使用稍深底色。
- Header 导航、Posts 标题和 Notes 标题 / 时间 / 来源 / 标签链接共用 `global.css` 的动态下划线：hover 或键盘聚焦时从左展开，离开时向右收起；使用逐行背景兼容长标题换行。

## 配置参数（全部位于 `[params]` 下）

- `headTitle` — 页头展示标题（回退到 `author.name`）
- `description` — meta description 和页头副标题
- `mainSections` — 首页和列表页展示的 content sections
- `author.name` / `author.homepage` — SEO JSON-LD 使用
- `socials` — 页头链接数组，`{name, link, icon?}`；可选 `icon` 对应 `assets/icons/<name>.svg`
- `favicon` — 网站图标路径
- `extraHead` — 注入 `</head>` 前的原始 HTML
- `extraBody` — 注入 `</body>` 前的原始 HTML
- `postContent` — 站点配置（映射），文章首尾注入：`enabled`（布尔值，总闸）、`header` / `footer`（文章正文前后的注入 HTML，`safeHTML`）
- `extraCSSFiles` — 额外 CSS 路径数组，以 `<link>` 加载
- `colorScheme` — 站点配置（映射），配色方案：`default`（默认 `indigo`）、`available`（允许 `indigo` / `violet` / `teal` / `amber` / `rose` / `graphite`）、`allowUserChoice`（多于一套有效配色时显示选择器）
- `staticPrefix` — CDN 前缀，同时生成 `dns-prefetch`
- `image` — 站点配置（映射），图片增强：`enabled`（布尔值，总闸）、`lazy`（布尔值，为 `<img>` 添加 `loading="lazy"`）、`loading`（布尔值，启用骨架屏 + 加载失败重试，首页不生效）、`border` / `galleryBorder`（布尔值，分别启用正文 / Gallery 图片的柔和内描边，默认关闭，跳过 SVG）
- `actions` — 站点配置（映射），文章操作区总开关与子功能：`enabled`（布尔值，总闸，`false` 或未配时编辑/复制按钮全部不渲染）、`copyMarkdown`（布尔值，启用"复制 Markdown"按钮）、嵌套 `editPage`（`enabled` 布尔值 + `repo` GitHub 仓库 URL + `branch` 分支名默认 `main` + `text` 纠错链接文字）。编辑按钮需 `actions.enabled` + `editPage.enabled` + `editPage.repo` 同时满足
- `tableOfContents` — 布尔值，启用 TOC 侧边栏
- `codeMaxLines` — 代码块折叠阈值，默认 15
- `album` — 单页 Open Graph 图片覆盖（字符串数组）
- `toc` — 文章 front matter（布尔值），设置为 `false` 时单篇禁用 TOC
- `ai` — 文章 front matter（字符串），标注 AI 创作方式：`none`（纯人，缺省等同）/ `assisted`（AI 辅助创作）/ `generated`（AI 生成·经人工编辑）。`assisted`/`generated` 时由 `ai-label.html` partial（`single.html` 的 `post-header` 内 meta 行之后调用）渲染 `.ai-label` 标注行（复用 `.action-icon` 图标约定 + 弱色小字，CSS 在 `post-page.css`）；`none`、缺省或未知值不渲染。仅覆盖 `single`，gallery 不进
- `aiLabel` — 站点配置（映射），AI 标注总开关与文案：`enabled`（布尔值，缺省视为开启，`false` 关闭所有标注渲染）、`assisted` / `generated`（字符串，自定义文案，缺省回退默认 `AI 辅助创作` / `AI 生成 · 经人工编辑`）
