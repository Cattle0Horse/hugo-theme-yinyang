window.yinyangRuntime.register('footnotes', function (runtime) {
  if (!runtime.config.footnotes) return
  var LINK_SELECTOR = 'a.footnote-ref, a.footnote-backref, a[role="doc-noteref"], a[role="doc-backlink"]'
  var SENT_PUNCT = /[。；：？！….;:!?]/
  // 成对分隔符：开括号 → 期待的闭括号
  var OPEN_CHARS = { "(": ")", "[": "]", "【": "】", "（": "）", "「": "」", "『": "』" }
  var CLOSE_CHARS = { ")": 1, "]": 1, "】": 1, "）": 1, "」": 1, "』": 1 }
  var BLOCK_RE = /^(P|LI|DIV|H[1-6]|BLOCKQUOTE|PRE|TABLE|TD|TH|SECTION|ARTICLE|UL|OL)$/
  var lastHighlighted = null
  var cancelHighlight = null
  var scrollFrame = 0
  var highlightGeneration = 0

  function addTooltip(link, text) {
    link.setAttribute("data-tooltip", text)
    link.setAttribute("aria-label", text)
  }

  function setupTooltips() {
    document.querySelectorAll(LINK_SELECTOR).forEach(function (link) {
      var back = link.matches('.footnote-backref, [role="doc-backlink"]')
      addTooltip(link, back ? '返回引用处' : '查看脚注 ' + link.textContent.trim())
    })
  }

  function targetKind(target) {
    if (target.matches('.footnote-ref, [role="doc-noteref"]') ||
      (target.matches('sup') && target.querySelector('.footnote-ref, [role="doc-noteref"]'))) return 'reference'
    var links = document.querySelectorAll(LINK_SELECTOR)
    for (var link of links) {
      if (runtime.scroll.target(link.getAttribute('href')) === target) {
        return link.matches('.footnote-ref, [role="doc-noteref"]') ? 'footnote' : 'reference'
      }
    }
    return null
  }

  var PAD = 2

  // 清除上一次高亮。覆盖层方案：移除覆盖层并还原段落上的定位 class，
  // 正文文本节点从未移动，布局零变化。overlay 是 block 的直接子节点，
  // parentNode 即 block，无需额外的 _block 引用。
  function clearHighlight() {
    if (cancelHighlight) cancelHighlight()
    cancelHighlight = null
    if (!lastHighlighted) return
    if (lastHighlighted.classList.contains("ref-highlight-overlay")) {
      var block = lastHighlighted.parentNode
      if (block) block.removeChild(lastHighlighted)
      if (block) block.classList.remove("ref-hl-container")
    } else {
      lastHighlighted.classList.remove("footnote-highlight")
    }
    lastHighlighted = null
  }

  // 上标所在的最近块级容器
  function blockOf(node) {
    var el = node.parentElement
    while (el && !BLOCK_RE.test(el.tagName)) el = el.parentElement
    return el
  }

  // 一次遍历：构建上标前的块内文本 + 对应的文本节点数组。
  // 后续既用文本做分句定位，也用节点数组把字符偏移映射回 (节点, 偏移)，
  // 避免对同一前缀做两次遍历。
  function blockText(block, sup) {
    var text = ""
    var nodes = []
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      if (sup.contains(node)) break
      nodes.push(node)
      text += node.data
    }
    return { text: text, nodes: nodes }
  }

  // overlay 定位基准：block 的 padding box 左上角（border box 内缘）。
  // overlay 用 inset:0 贴住 padding box，bar 相对 overlay 定位即相对此点；
  // 文本行框从 content 起点开始，坐标相减自然带上 padding 偏移，与文本对齐。
  function rectOrigin(block) {
    var r = block.getBoundingClientRect()
    return { x: r.left + block.clientLeft, y: r.top + block.clientTop }
  }

  // 分句起点：上标所在分句的起始字符索引。单趟反向扫描——从句末往前，
  // 遇句标点即止（不含标点）；若先遇未闭合的开括号（其后没有与之配对的
  // 闭括号），也止于其后（不含开括号）。边界之后紧跟的空白/标点一并跳过。
  // 找不到边界返回 0（从块开头高亮）。
  function clauseStart(text, end) {
    function clean(s) {
      while (s < end && (/\s/.test(text[s]) || SENT_PUNCT.test(text[s]))) s++
      return s
    }
    var closers = []
    for (var i = end - 1; i >= 0; i--) {
      var ch = text[i]
      if (SENT_PUNCT.test(ch)) return clean(i + 1)
      if (CLOSE_CHARS[ch]) { closers.push(ch); continue }
      if (OPEN_CHARS[ch]) {
        // 该开括号的闭括号已在右侧等待 → 已闭合，继续往前找；
        // 否则是未闭合的开括号（最内层），作为高亮边界。
        if (closers.length && closers[closers.length - 1] === OPEN_CHARS[ch]) closers.pop()
        else return clean(i + 1)
      }
    }
    return clean(0)
  }

  // 返回引用处：把上标所在分句（到最近句标点 / 未闭合开括号为止）叠一层
  // 覆盖高亮。不改动正文 DOM，覆盖层 absolute 定位在段落内，随内容滚动，
  // 返回 overlay。
  function highlightRef(sup) {
    var block = blockOf(sup)
    if (!block) return null

    var bt = blockText(block, sup)
    var text = bt.text

    var end = text.length
    while (end > 0 && /\s/.test(text[end - 1])) end--

    var start = clauseStart(text, end)

    var rects
    if (start < end) {
      // 把字符偏移映射回文本节点
      var pos = null
      var acc = 0
      for (var n = 0; n < bt.nodes.length; n++) {
        var len = bt.nodes[n].data.length
        if (start <= acc + len) { pos = { node: bt.nodes[n], offset: start - acc }; break }
        acc += len
      }
      if (!pos) return null
      var range = document.createRange()
      range.setStart(pos.node, pos.offset)
      range.setEnd(sup.parentNode, Array.prototype.indexOf.call(sup.parentNode.childNodes, sup))
      rects = range.getClientRects()
    } else {
      // 退化：上标前凑不足文本，只高亮上标自身
      var own = document.createRange()
      own.selectNodeContents(sup)
      rects = own.getClientRects()
    }

    var origin = rectOrigin(block)
    var overlay = document.createElement("span")
    overlay.className = "ref-highlight-overlay"
    var built = false
    for (var j = 0; j < rects.length; j++) {
      var r = rects[j]
      if (!r.width || !r.height) continue
      var bar = document.createElement("span")
      bar.className = "ref-highlight-bar"
      bar.style.left = (r.left - origin.x - PAD) + "px"
      bar.style.top = (r.top - origin.y - PAD) + "px"
      bar.style.width = (r.width + PAD * 2) + "px"
      bar.style.height = (r.height + PAD * 2) + "px"
      overlay.appendChild(bar)
      built = true
    }
    if (!built) return null

    block.classList.add("ref-hl-container")
    block.appendChild(overlay)
    return overlay
  }

  // 动画结束即清理，animationend 丢失时由 timeout 兜底；guard 避免清掉新的高亮。
  function scheduleClear(el) {
    var motion = el.classList.contains('ref-highlight-overlay') ? el.firstElementChild : el
    cancelHighlight = runtime.onMotionEnd(motion, { type: 'animationend', timeout: 5000 }, function () {
      if (lastHighlighted === el) clearHighlight()
    })
  }

  function followHash(hash, options) {
    options = options || {}
    var target = runtime.scroll.target(hash)
    if (!target) return false
    var kind = targetKind(target)
    if (!kind) return false
    clearHighlight()
    cancelScroll()
    if (kind === 'footnote') {
      target.offsetWidth
      target.classList.add('footnote-highlight')
      lastHighlighted = target
    } else {
      lastHighlighted = highlightRef(target.closest('sup') || target)
    }
    if (lastHighlighted) scheduleClear(lastHighlighted)
    if (kind === 'reference' && lastHighlighted && document.fonts) {
      var highlighted = lastHighlighted
      var generation = highlightGeneration
      document.fonts.ready.then(runtime.guard(function () {
        if (generation !== highlightGeneration || lastHighlighted !== highlighted || runtime.scroll.target(hash) !== target) return
        clearHighlight()
        lastHighlighted = highlightRef(target.closest('sup') || target)
        if (lastHighlighted) scheduleClear(lastHighlighted)
      }))
    }
    if (options.scroll !== false) {
      scrollFrame = runtime.requestAnimationFrame(function () {
        runtime.scroll.scrollToElement(target, { align: 'center', behavior: options.behavior })
      })
    }
    return true
  }
  function cancelScroll() {
    highlightGeneration++
    runtime.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  runtime.footnotes = { followHash: followHash, cancelScroll: cancelScroll }
  runtime.addCleanup(clearHighlight)
  setupTooltips()
  runtime.listen(document, 'click', function (event) {
    var link = event.target.closest(LINK_SELECTOR)
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    var hash = link.getAttribute('href')
    if (!hash || hash.charAt(0) !== '#') return
    var target = runtime.scroll.target(hash)
    if (target && targetKind(target)) {
      event.preventDefault()
      runtime.pushHash(hash)
      followHash(hash)
    }
  })
})
