# YinYang

一个极简的 Hugo 博客主题，支持 Blog 长文、Notes 短记录与 Gallery 图库。

**在线演示**：[https://cattle0horse.github.io/](https://cattle0horse.github.io/)

![亮色主题](./images/home-light.png)

![暗色主题](./images/home-dark.png)

## 功能

主题提供以下能力：

| 功能 | 说明 |
|---|---|
| 🌓 外观切换 | 靛蓝 / 紫罗兰 / 青绿 / 琥珀 / 玫瑰 / 石墨配色与明暗模式独立选择，支持亮色 / 暗色 / 跟随浏览器、偏好保存与首次加载无闪屏；支持的浏览器中提供明暗切换圆形扩散动画 |
| 🧭 站内导航 | 无刷新切换页面、正文交叉淡化与加载进度提示；前进后退恢复阅读位置、代码展开状态和内容横向滚动位置 |
| 📱 自适应布局 | 宽窄屏切换保持阅读位置，页头链接空间不足时自动收进菜单，Gallery 手机单列展示 |
| 📖 阅读排版 | OPPO Sans 正文与 Fira Code 代码字体、长标题换行、宽表格局部横向滚动与滑动提示，代码和公式独立横向滚动 |
| 📐 数学公式 | 构建期 KaTeX 渲染行内与块级公式，输出 HTML 与 MathML，按需从 CDN 加载样式与字体，页面加载无需公式渲染 JS |
| 💻 代码块工具栏 | 语法高亮、语言标签、一键复制、长代码折叠与展开，缩进式代码块也支持复制 |
| 🖼 图片增强 | 原生懒加载、异步解码、骨架屏占位、加载淡入与失败重试；正文和 Gallery 可独立启用柔和内描边 |
| 📑 文章目录 | 宽屏侧边栏 / 窄屏浮层，滚动高亮与自动跟随，点击跳转并标记标题，可按文章禁用 |
| 📌 脚注跳转 | 引用与脚注双向跳转、提示与脉冲高亮 |
| 🗂 Gallery 图库 | 独立内容类型，响应式图片网格与说明文字，复用图片增强和文章操作 |
| 📝 Notes 短记录 | 可选标题、完整正文时间线、按月分组与分页、独立链接、多种来源格式，以及与 Blog 隔离的标签体系 |
| 🏷 Blog 标签 | 文章标签、标签总览与按标签浏览，与 Notes 标签分别组织 |
| ⚡ 文章操作区 | 复制原始 Markdown、查看 GitHub Raw、编辑原文与底部纠错入口，支持 Blog / Gallery / Note 详情页 |
| 🤖 AI 创作标注 | 文章 front matter 声明辅助或生成方式，可关闭标注或自定义文案 |
| 📡 RSS 订阅 | Blog 与 Notes 独立 feed，可分别启用 |
| 🔎 SEO | 页面标题与描述、Open Graph 和 JSON-LD 结构化数据，支持自定义分享图片 |
| 📊 访问统计 | 可选不蒜子全站 UV/PV 采集，Blog / Gallery / Note 详情页展示阅读量 |
| ⌨️ 键盘交互 | 菜单键盘导航、目录浮层焦点锁定与 Esc 关闭、焦点归还、复制结果状态播报 |
| 🛠 内容与样式自定义 | 自定义字体、CSS、Head / Body 与文章首尾内容注入、静态资源 CDN 前缀；提供 Blog / Note 内容模板与 Nushell 创建脚本 |

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
hugo server -s exampleSite --themesDir ../.. --theme hugo-theme-yinyang
```

浏览器打开 `http://localhost:1313` 即可预览主题效果。命令可直接用于 PowerShell / Nushell。

构建示例站与运行回归测试：

```shell
hugo -s exampleSite --themesDir ../.. --theme hugo-theme-yinyang
node --expose-gc --test
```

主题由 Hugo 直接构建，无需 npm 工具链；回归验证需要 Node 和 Hugo，使用 Node 内置测试运行器。

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

`mainSections` 只控制 Blog 首页，Notes 固定从 `content/notes/` 读取并显示在 `/notes/`。

### Notes 标签

Notes 使用独立的 `note_tags` taxonomy，不会进入 Blog 的 `tags`。站点需要显式注册 `tags` 和 `note_tags`：

```toml
[taxonomies]
tag = "tags"
note_tag = "note_tags"

[permalinks.taxonomy]
note_tags = "/notes/tags/"

[permalinks.term]
note_tags = "/notes/tags/:slug/"
```

Blog 标签继续使用 `tags`，链接到 `/tags/<tag>/`；Note 标签写在 `note_tags`，链接到 `/notes/tags/<tag>/`。两个 taxonomy 即使使用相同名称的标签，也会分别统计和展示。

### 配色与明暗模式

主题内置靛蓝（`indigo`）、紫罗兰（`violet`）、青绿（`teal`）、琥珀（`amber`）、玫瑰（`rose`）和石墨（`graphite`）六套配色，共用中性背景，每套均支持亮色与暗色。页头的色点按钮展开紧凑色点调色盘，浅色底与细边框标记当前配色。明暗按钮点击轮换「亮色 → 暗色 → 跟随浏览器」，默认跟随浏览器并实时响应其偏好变化。手动选择会保存在浏览器中，重新选择「跟随浏览器」会清除手动明暗偏好。

```toml
[params.colorScheme]
default = "indigo"
available = ["indigo", "violet", "teal", "amber", "rose", "graphite"]
allowUserChoice = true
```

- `default`：首次访问时使用的配色；未配置或不在 `available` 中时，使用第一套有效配色。
- `available`：站点允许的配色；支持上述六种配色，无效值会被忽略。
- `allowUserChoice`：至少有两套可用配色时，在页头显示调色盘按钮。

不配置 `[params.colorScheme]` 时使用靛蓝配色且不显示调色盘。明暗选择按钮始终保留。旧配色配置或浏览器保存的旧配色值会回退到有效默认配色。

### 站内无刷新导航

普通站内页面链接使用无刷新导航，切换页面时同步标题、SEO 信息和按需样式，并重新初始化目录、复制按钮、代码块和图片交互。目标加载完成后，旧正文与新正文进行 240ms 交叉淡化，无位移，Header 保持稳定。历史恢复及带锚点的导航直接切换；前进、后退恢复阅读位置、代码展开状态及内容横向滚动位置。

点击站内链接后立即显示顶部主题色进度条及带旋转图标的“正在加载…”提示，期间保留原内容；完成、取消或失败后清理提示。

外链、新标签页、Ctrl / Command 点击、下载和 RSS 继续由浏览器处理。请求失败、目标不是主题页面、运行时代码版本变化，或当前 / 目标正文含未托管脚本、内联 module 脚本时，自动使用正常页面跳转。

给链接或其父元素添加 `data-no-pjax` 可强制正常跳转。自定义集成可以在 `document` 上监听 `yinyang:before-navigate`（提交新页面前）和 `yinyang:page-ready`（主题初始化、焦点及滚动恢复后），事件的 `detail.url` 为目标 URL。这些事件只提供通知；无刷新切换时会先等待公式资源及有时限的可见阅读次数，ready 不等待全部图片、全站字体、后台统计或过渡动画结束。

需要随页面重新执行的正文 / `extraBody` 脚本应标记 `data-page-runtime`，并通过 `window.yinyangRuntime.page` 的监听、计时器和 `addCleanup` 管理资源。导航时先初始化主题功能，再按正文顺序重放这些脚本，等待外部经典脚本和外部 module 加载。内联 module 保留完整页面加载，以保持其原生模块语义。自定义脚本初始化期间，站内锚点仍可操作；再次跨页使用正常导航。首次加载使用 defer 主题 bundle，因此普通 footer 脚本如需调用 `window.yinyangRuntime.page.bindCopyButton()` 等主题服务，应监听 `yinyang:page-ready`。`extraHead` 中的自定义脚本不会随导航重放。

### RSS

主题将 Blog 和 Notes 分成两个 feed：Blog 使用 `/index.xml`，且只包含 `mainSections` 中的内容；Notes 使用 `/notes/index.xml`。`tags` 和 `note_tags` 的总览页及条目页均不生成 RSS。

Hugo 的 `outputs` 决定文件是否真正生成。以下配置同时开启 Blog RSS 和 Notes RSS：

```toml
[outputs]
home = ["HTML", "RSS"]
section = ["HTML"]
taxonomy = ["HTML"]
term = ["HTML"]

[[cascade]]
outputs = ["HTML", "RSS"]

[cascade.target]
kind = "section"
path = "/notes"
```

- 禁用 Blog RSS：将 `home` 改为 `["HTML"]`。
- 禁用 Notes RSS：删除上述 `[[cascade]]` 配置，或将其 `outputs` 改为 `["HTML"]`。
- 不要给全局 `section` 加入 `"RSS"`，否则 Gallery 等其他 Section 也会生成 feed。

### Notes 短记录

Notes 用于直接留下不要求完整的短记录。每条 Note 是独立页面，按月份目录和月内三位序号组织：

```text
content/notes/
└── 2026-08/
    ├── 001.md
    └── 002.md
```

最小内容只有日期和正文；`title`、`note_tags`、`source` 都是可选字段：

```yaml
---
date: 2026-08-31T14:19:47+08:00
draft: false
# title: ""
# note_tags: []
# source: []
---

一句话也算写作。先留下，再回头。
```

- 未设置 `title` 时，页面保持无标题；浏览器标题和 SEO 使用正文前 60 个字符，空正文回退到日期时间。
- `source` 是来源列表，每项可以是普通文字、URL 或 `[标题](URL)`。Markdown 链接显示指定标题，裸 URL 只显示域名，普通文字直接显示；列表和详情页会在正文前显示来源。
- `/notes/` 每页显示 30 条，完整正文直接在时间线中展开；每条记录仍有独立固定链接。
- `/notes/tags/<tag>/` 只显示拥有对应 `note_tags` 的 Note，并复用 `/notes/` 的时间线、按月分组和分页样式。
- Note 详情页使用独立的 Notes 标签，并复用复制 Markdown、编辑原文、查看 Raw 和底部纠错入口。
- Notes 不进入 Blog RSS；启用 Notes RSS 时，只进入独立的 `/notes/index.xml`。

主题的 `archetypes/notes.md` 提供上述 front matter。示例站根目录还包含无参数创建脚本；在示例站中使用：

```powershell
cd exampleSite
nu note.nu
```

脚本会找到当前月份的最大三位序号，创建下一条 Note 并通过 VS Code 打开。实际内容站点使用时，将 `exampleSite/note.nu` 复制到站点根目录后运行同一命令。脚本只负责创建，不执行构建、提交或发布。

### 快速新建 Blog

Blog 使用独立 Page Bundle，便于把正文、图片和附件放在同一目录。示例站中运行：

```powershell
cd exampleSite
nu blog.nu
```

脚本会创建 `content/posts/YYYY-MM-DD-HHMMSS/index.md` 并通过 VS Code 打开。新文章默认 `draft: true`，必须填写标题并在完成后手动改为 `false`。实际内容站点使用时，将 `exampleSite/blog.nu` 复制到站点根目录；发布仍由独立流程负责。

Blog archetype 会把所有主题支持的页面级 front matter 作为注释提供，需要时直接取消注释：

```yaml
---
title: ""
date: 2026-08-31T16:30:00+08:00
draft: true
# summary: ""
# description: ""
# tags: []
# ai: none # none | assisted | generated
# toc: true # false disables the table of contents
# album: [] # Open Graph image URLs
---
```

### 字体

标题、正文和导航默认使用 **OPPO Sans**，代码块与行内代码默认使用 **Fira Code**，代码中的中文回退 OPPO Sans，无需在 `extraHead` 中注入字体。OPPO Sans 通过 UNPKG 加载固定版本 `@zf-web-font/opposans@0.2.0` 的 Regular 400 / Medium 500 / Bold 700 WOFF2；Fira Code 通过 jsDelivr 加载 6.2.0 可变字库。正文在桌面和手机上均使用 14px、Regular 400、0.025em 字距和中西文自动间距，段落使用 1.8 倍行高、32px 下间距；粗体和正文链接使用 600 字重及柔化的主题色。正文颜色和页面背景区分明暗模式，代码与公式保持独立的字距。字体按实际使用请求，文件不随主题分发；OPPO Sans 完整字库的首访下载量较大。`font-display: swap` 让文字先用系统字体显示，加载完成后切换；字库未覆盖的字符或字体加载失败时回退系统字体。

| 用途 | 字体栈 |
|---|---|
| 标题、正文与导航 | `"OPPO Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", ...` |
| 代码 | `"Fira Code", "SF Mono", Menlo, Monaco, "Courier New", ...` |

标题默认继承正文字体；可通过 `--font-body` / `--font-heading` / `--font-code` 分别调整正文、标题与代码字体。使用 `extraCSSFiles` 加载自己的字体样式表：

```toml
[params]
extraCSSFiles = ["css/fonts.css"]
```

### 页头导航链接

导航通过 `params.socials` 配置，按配置顺序展示。整排链接放不下时，全部收进导航菜单；空间恢复后自动展开。明暗与配色按钮始终直接展示。

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

### 访问统计

不蒜子统计在未配置时关闭。启用后，所有页面都会采集全站 UV/PV，但暂不展示；Blog、Gallery、Note 详情页的标题下显示本页阅读量，Notes 时间线不为每条 Note 单独计数。示例站已启用。

```toml
[params.busuanzi]
enabled = true
```

启用后，浏览器会从 `busuanzi.ibruce.info` 加载脚本并向其发送统计请求；本地预览的访问也可能进入统计。切换详情页时最多等待 800ms，让阅读次数随正文一起出现；超时或加载失败时省略本页阅读次数，避免稍后突现。计数由第三方服务提供，脚本被拦截或服务不可用时数字不会显示。

### 数学公式

本主题在构建期将 `$...$` / `$$...$$` 渲染为 KaTeX HTML 与 MathML，页面加载时**无需公式渲染 JS**。仅含公式的页面通过 jsDelivr 加载固定版本 KaTeX 0.19.0 的 CSS 及其引用的字体，Notes 时间线按当前分页内容判断。无刷新导航会保留当前页面，等待目标页公式 CSS 和公式实际使用的字体，再切换正文、恢复阅读位置；等待期间仍可操作当前页面或改选其他链接。加载失败或超过 8 秒后继续切换，CDN 不可用时公式排版可能异常。直接打开或刷新页面仍遵循浏览器自身的样式与字体加载流程。使用支持新版 KaTeX 类名的 Hugo（当前已验证 0.168.0），升级样式时须核对构建输出的兼容性。使用前需启用 Goldmark 的 passthrough 扩展：

```toml
[markup]
[markup.goldmark.extensions]
[markup.goldmark.extensions.passthrough]
enable = true
delimiters = { block = ["$$", "$$"], inline = ["$", "$"] }
```

在正文中直接书写 LaTeX 即可：

```markdown
行内公式 $E = mc^2$

块级公式：
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

书写注意：块级公式内的 `=` / `-` 等标记**不能单独成行**（会被 markdown 解析为 setext 标题打断公式），裸 `<` / `>` 请用 `\lt` / `\gt`。

### 代码块

代码块自动获得语言标签、复制按钮，超过 `codeMaxLines`（默认 15）行的代码块自动折叠：

```toml
[params]
codeMaxLines = 15
```

### 图片、文章操作与目录

`[params.image]` 控制图片增强，`enabled` 为总开关，`lazy` 启用原生懒加载，`loading` 额外启用加载占位和失败重试：

```toml
[params.image]
enabled = true
lazy = true
loading = true
border = true
galleryBorder = false
```

`border` 为正文图片启用柔和的 1.5px 内描边，Gallery 图片由 `galleryBorder` 独立控制；两项默认关闭，不处理 SVG。描边随明暗主题变化，不占布局尺寸，也不影响点击；关闭 `loading` 后仍可使用。

`loading` 启用时，骨架屏图片使用 `decoding="async"` 异步解码：图片字节到位即触发 `load`，解码移出主线程、不再阻塞页面交互；上屏前经 `img.decode()` 协调，保证像素可绘制后立刻淡入（200ms opacity + scale 合成器动画），骨架屏不占用多余等待时间。

`tableOfContents` 启用文章目录。文章 frontmatter 使用 `toc: false` 可单篇禁用目录。

文章操作区（标题下方按钮）由 `[params.actions]` 控制：`enabled` 为总开关，`copyMarkdown` 启用"复制 Markdown"按钮，嵌套 `editPage` 启用编辑原文 / 查看 Raw 按钮和底部纠错链接，`branch` 默认值为 `main`，`text` 可覆盖链接文案：

```toml
[params.actions]
enabled = true
copyMarkdown = true

[params.actions.editPage]
enabled = true
repo = "https://github.com/Cattle0Horse/Cattle0Horse.github.io"
branch = "main"
text = "有错误？欢迎提交 Pull Request"
```

`extraHead`、`extraBody` 和 `postContent.header`、`postContent.footer` 会按原样通过 `safeHTML` 注入，仅应填入可信内容。`extraCSSFiles` 则按路径生成样式链接。

### AI 创作标注

文章 front matter 使用 `ai` 声明创作方式，会在文章标题下方的元信息区显示一个低调的标注行（SVG 图标 + 弱色小字）：

| `ai` 值 | 含义 | 标题下方显示 |
|---|---|---|
| `none` | 纯人创作（默认，缺省等同此值） | 不显示 |
| `assisted` | AI 辅助创作 | `AI 辅助创作` |
| `generated` | AI 生成，经人工编辑 | `AI 生成 · 经人工编辑` |

`ai` 缺省、为 `none` 或其他未知值时，标注行均不显示。

标注行为可通过站点配置 `[params.aiLabel]` 控制：`enabled` 为总开关（缺省开启，`false` 时即使文章声明 `ai` 也不渲染），`assisted` / `generated` 可自定义文案（缺省回退上表默认文案）：

```toml
[params.aiLabel]
enabled = true
assisted = "由 AI 协助撰写"
generated = "由 AI 生成，经人工校对"
```

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

每张图片由共享的 `image-tag.html` 渲染，自动获得与正文图片一致的懒加载、骨架屏和失败重试能力（受 `[params.image]` 的 `lazy` / `loading` 控制），并以两列网格布局展示，`name` 显示为图片下方的说明文字。

> 注意：`gallery` 不属于 `mainSections`（默认 `["posts"]`），因此不会出现在首页或 `/gallery/` 列表页，需通过文章 URL 直接访问。可参考 `exampleSite/content/gallery/sample.md`。

### 文章首尾插入内容

`[params.postContent]` 控制文章正文前后的注入内容，`enabled` 为总开关，`header` / `footer` 按原样通过 `safeHTML` 注入：

```toml
[params.postContent]
enabled = true
header = ""
footer = ""
```

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

[permalinks.taxonomy]
note_tags = "/notes/tags/"

[permalinks.term]
note_tags = "/notes/tags/:slug/"

# ---------- Taxonomy ----------
[taxonomies]
tag = "tags"
note_tag = "note_tags"

# ---------- RSS ----------
[outputs]
home = ["HTML", "RSS"]
section = ["HTML"]
taxonomy = ["HTML"]
term = ["HTML"]

[[cascade]]
outputs = ["HTML", "RSS"]

[cascade.target]
kind = "section"
path = "/notes"

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
staticPrefix = "https://cdn.jsdelivr.net/gh/cattle0horse/blog"

[params.colorScheme]
default = "indigo"
available = ["indigo", "violet", "teal", "amber", "rose", "graphite"]
allowUserChoice = true

[params.image]
enabled = true
lazy = true
loading = true
border = true
galleryBorder = false

# ---------- 作者 ----------
[params.author]
homepage = "https://github.com/cattle0horse"
name = "CattleHorse"

# ---------- 社交链接 ----------
[[params.socials]]
name = "Notes"
link = "/notes/"
[[params.socials]]
name = "RSS"
link = "/index.xml"
[[params.socials]]
name = "Github"
link = "https://github.com/cattle0horse"
```
