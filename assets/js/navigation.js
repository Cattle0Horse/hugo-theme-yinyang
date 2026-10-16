;(function () {
  var lifecycle = window.yinyangRuntime
  var horizontalSelector = '.code-scroll-viewport, .table-scroll, .plain-code-wrapper > pre, .katex-display'
  var positions = new Map()
  var sequence = 0
  var prefix = Date.now().toString(36) + '-'
  var displayedURL = new URL(location.href)
  var displayedId = null
  var pending = null
  var initializing = null
  var restoreGeneration = 0
  var requestedPosition = null
  var needsReady = true
  var loading = null
  var pageTransition = null

  function ready(url) {
    if (!needsReady) return
    needsReady = false
    document.dispatchEvent(new CustomEvent('yinyang:page-ready', { detail: { url: url.href } }))
  }
  function followHash(hash, behavior) {
    var page = lifecycle.page
    if (page.footnotes && page.footnotes.followHash(hash, { scroll: true, behavior: behavior })) return
    var target = page.scroll.target(hash)
    if (target) page.scroll.scrollToElement(target, { behavior: behavior })
  }
  function nextFrame() { return new Promise(function (resolve) { requestAnimationFrame(resolve) }) }
  async function settleHash(url, follow) {
    var generation = restoreGeneration
    // Preserve the requested fragment, not a snapshot taken halfway through its
    // smooth scroll, if custom-script initialization finishes in the meantime.
    requestedPosition = { url: url.href, saved: null }
    if (follow !== false) followHash(url.hash, 'auto')
    await nextFrame()
    await nextFrame()
    if (generation !== restoreGeneration || initializing) return
    rememberPosition()
    ready(url)
  }

  async function restorePosition(url, saved, options) {
    var generation = ++restoreGeneration
    requestedPosition = { url: url.href, saved: saved }
    var body = document.body
    var page = lifecycle.page
    function current() { return generation === restoreGeneration && document.body === body && page.active }
    await nextFrame()
    await nextFrame()
    if (!current()) return false
    if (saved) {
      if (page.code && saved.folds) page.code.restoreFolds(saved.folds)
      document.querySelectorAll(horizontalSelector).forEach(function (scroll, index) {
        scroll.scrollLeft = saved.horizontal && saved.horizontal[index] || 0
      })
      page.scroll.restore(saved)
    } else if (url.hash) {
      followHash(url.hash, 'instant')
      // Footnote highlighting schedules its final centered scroll on the next frame.
      await nextFrame()
      if (!current()) return false
    }
    else page.scroll.element().scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (options.focus) {
      var heading = document.querySelector('.app-scroll h1, .app-scroll h2')
      if (heading) {
        var temporary = !heading.hasAttribute('tabindex')
        if (temporary) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
        if (temporary) page.listen(heading, 'blur', function () { heading.removeAttribute('tabindex') }, { once: true })
      }
    }
    rememberPosition()
    if (!initializing || options.ready) ready(url)
    return true
  }

  function writeEntry(url, replace) {
    var id = prefix + (++sequence)
    var state = Object.assign({}, history.state, { yinyang: { id: id, url: url.href } })
    history[replace ? 'replaceState' : 'pushState'](state, '', url.href)
    return id
  }
  function rememberPosition(reading) {
    positions.set(displayedId, Object.assign({}, positions.get(displayedId), reading || lifecycle.page.scroll.capture()))
  }
  function rememberPage() {
    rememberPosition()
    var saved = positions.get(displayedId)
    saved.folds = Array.from(document.querySelectorAll('.code-block-body')).map(function (body) { return body.classList.contains('is-folded') })
    saved.horizontal = Array.from(document.querySelectorAll(horizontalSelector)).map(function (scroll) { return scroll.scrollLeft })
  }
  function hideLoading() {
    if (loading) loading.remove()
    loading = null
  }
  function showLoading(controller) {
    if (pending !== controller) return
    loading = document.createElement('div')
    loading.className = 'navigation-loading'
    loading.setAttribute('role', 'status')
    loading.setAttribute('aria-live', 'polite')
    var progress = document.createElement('span')
    progress.className = 'navigation-progress'
    progress.setAttribute('aria-hidden', 'true')
    var label = document.createElement('span')
    label.className = 'navigation-loading-label'
    label.textContent = '正在加载…'
    loading.append(progress, label)
    document.body.appendChild(loading)
  }
  function cancelPending(invalidate) {
    if (invalidate !== false) {
      if (pageTransition) pageTransition()
      restoreGeneration++
      requestedPosition = null
      if (lifecycle.page.footnotes) lifecycle.page.footnotes.cancelScroll()
    }
    if (initializing) {
      initializing.interacted = true
      if (initializing.reveal) initializing.reveal()
    } else {
      if (pending) pending.abort()
      pending = null
    }
    hideLoading()
    var shell = document.querySelector('.app-shell')
    if (shell) shell.removeAttribute('aria-busy')
  }
  function samePage(a, b) { return a.pathname === b.pathname && a.search === b.search }
  function executable(script) { return !script.type || /^(?:module|text\/javascript|application\/javascript)$/i.test(script.type) }
  function requiresDocumentNavigation(body) {
    return Array.from(body.querySelectorAll('script')).some(function (script) {
      // Inline modules have no reliable load boundary for ordered replay. Leave
      // their import resolution and evaluation lifecycle to native navigation.
      return (executable(script) && !script.hasAttribute('data-page-runtime')) ||
        (script.type.trim().toLowerCase() === 'module' && !script.hasAttribute('src'))
    })
  }

  async function fetchPage(url, controller) {
    var response = await fetch(url.href, { signal: controller.signal, credentials: 'same-origin' })
    if ((!response.ok && response.status !== 404) || !/text\/html/i.test(response.headers.get('Content-Type') || '')) throw new Error('Not a theme page')
    var destination = new URL(response.url)
    if (destination.origin !== location.origin) throw new Error('External redirect')
    destination.hash = url.hash
    var next = new DOMParser().parseFromString(await response.text(), 'text/html')
    if (!next.querySelector('.app-shell #appScroll') || !next.getElementById('yinyang-page-config') || next.body.hasAttribute('data-no-pjax')) throw new Error('Unsupported page')
    var nextRuntime = next.querySelector('script[data-yinyang-runtime]')
    var nextBundle = next.querySelector('script[data-yinyang-navigation]')
    if (!nextRuntime || !nextBundle || nextRuntime.textContent !== document.querySelector('script[data-yinyang-runtime]').textContent || nextBundle.getAttribute('src') !== document.querySelector('script[data-yinyang-navigation]').getAttribute('src')) throw new Error('Runtime version changed')
    if (requiresDocumentNavigation(next.body)) throw new Error('Custom page scripts require document navigation')
    return { document: next, url: destination }
  }
  function syncHead(next, keepStyles) {
    var previous = Array.from(document.head.querySelectorAll('[data-page-head]'))
    next.head.querySelectorAll('[data-page-head]').forEach(function (node) {
      var index = previous.findIndex(function (old) { return old.isEqualNode(node) })
      if (index !== -1) previous.splice(index, 1)
      else document.head.appendChild(node.cloneNode(true))
    })
    var retained = []
    previous.forEach(function (node) {
      if (keepStyles && (node.tagName === 'STYLE' || (node.tagName === 'LINK' && node.getAttribute('rel') === 'stylesheet'))) retained.push(node)
      else node.remove()
    })
    return function () { retained.forEach(function (node) { node.remove() }) }
  }
  function cloneWithoutIds(node) {
    var clone = node.cloneNode(true)
    clone.removeAttribute('id')
    clone.querySelectorAll('[id]').forEach(function (child) { child.removeAttribute('id') })
    return clone
  }
  function loadMathFonts(root) {
    var fonts = new Map()
    root.querySelectorAll('.katex-html').forEach(function (formula) {
      var walker = document.createTreeWalker(formula, NodeFilter.SHOW_TEXT)
      var text
      while ((text = walker.nextNode())) {
        if (!text.textContent.trim()) continue
        var style = getComputedStyle(text.parentElement)
        var font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily
        fonts.set(font, (fonts.get(font) || '') + text.textContent)
      }
    })
    return Promise.all(Array.from(fonts, function (entry) { return document.fonts.load(entry[0], entry[1]) }))
  }
  function prepareMath(next, controller) {
    var source = next.head.querySelector('[data-page-math]')
    if (!source) return Promise.resolve()
    var existing = Array.from(document.head.querySelectorAll('[data-page-math]')).find(function (node) { return node.isEqualNode(source) })
    var link = existing || source.cloneNode(true)
    return new Promise(function (resolve) {
      var finished = false
      var probe = null
      var timer = setTimeout(finish, 8000)
      function finish() {
        if (finished) return
        finished = true
        clearTimeout(timer)
        link.removeEventListener('load', loaded)
        link.removeEventListener('error', finish)
        controller.signal.removeEventListener('abort', finish)
        if (probe) probe.remove()
        if (!existing && controller.signal.aborted) link.remove()
        resolve()
      }
      async function loaded() {
        if (finished) return
        link.removeEventListener('load', loaded)
        try {
          if (document.fonts && document.fonts.load) {
            // Render only formula clones offscreen; the current article stays live.
            // Explicit font loads also cover text annotations without waiting for unrelated fonts.
            probe = document.createElement('div')
            probe.className = 'markdown-body'
            probe.setAttribute('aria-hidden', 'true')
            probe.inert = true
            probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none'
            next.body.querySelectorAll('.katex').forEach(function (formula) {
              var display = formula.parentElement.classList.contains('katex-display')
              probe.appendChild(cloneWithoutIds(display ? formula.parentElement : formula))
            })
            document.body.appendChild(probe)
            await loadMathFonts(probe)
          }
        } catch (error) {
          // Failed resources must not trap navigation or cause reload loops.
        }
        finish()
      }
      controller.signal.addEventListener('abort', finish, { once: true })
      link.addEventListener('error', finish, { once: true })
      if (link.sheet) loaded()
      else {
        link.addEventListener('load', loaded, { once: true })
        if (!existing) document.head.appendChild(link)
      }
      if (controller.signal.aborted) finish()
    })
  }
  function runScript(source, url, target) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script')
      Array.from(source.attributes).forEach(function (attribute) { script.setAttribute(attribute.name, attribute.value) })
      if (source.src) script.src = new URL(source.getAttribute('src'), url).href
      script.async = false
      script.textContent = source.textContent
      var waits = !!source.src || source.type === 'module'
      function clean() {
        script.removeEventListener('load', loaded)
        script.removeEventListener('error', failed)
      }
      function loaded() { clean(); resolve() }
      function failed() { clean(); reject(new Error('Page script failed')) }
      if (waits) {
        script.addEventListener('load', loaded, { once: true })
        script.addEventListener('error', failed, { once: true })
      }
      if (target) target.replaceWith(script)
      else document.head.appendChild(script)
      if (!waits) resolve()
    })
  }
  function loadAnalytics(source, url, page) {
    var previous = document.head.querySelector('script[data-page-analytics]')
    if (!source) {
      if (previous) previous.remove()
      return Promise.resolve()
    }
    var container = document.getElementById('busuanzi_container_page_pv')
    var value = document.getElementById('busuanzi_value_page_pv')
    if (!container || !value) {
      runScript(source, url, previous).catch(function () {})
      return Promise.resolve()
    }
    // Script load only starts the JSONP request. Wait for its actual DOM result
    // so the count is included in the new article's transition snapshot.
    return new Promise(function (resolve) {
      var finished = false
      var observer = new MutationObserver(function () { if (value.textContent.trim()) finish() })
      function finish() {
        if (finished) return
        finished = true
        observer.disconnect()
        clearTimeout(timer)
        stopCleanup()
        if (!value.textContent.trim()) container.remove()
        resolve()
      }
      var timer = setTimeout(finish, 800)
      var stopCleanup = page.addCleanup(finish)
      observer.observe(container, { childList: true, characterData: true, subtree: true })
      runScript(source, url, previous).catch(finish)
    })
  }
  function captureArticle(next) {
    var article = document.querySelector('.app-scroll > article')
    if (!article) return null
    var header = document.querySelector('.app-header')
    var headerBounds = header && header.getBoundingClientRect()
    var viewport = lifecycle.page.scroll.viewport()
    var cover = document.createElement('div')
    cover.className = 'navigation-outgoing'
    cover.setAttribute('aria-hidden', 'true')
    cover.inert = true
    var scrolls = []
    var shared = []
    if (document.startViewTransition) {
      var detail = next.body.querySelector('[data-transition-page]') || document.querySelector('[data-transition-page]')
      var key = detail && detail.getAttribute('data-transition-page')
      if (key) ['title', 'time'].forEach(function (kind) {
        var target = Array.from(next.body.querySelectorAll('[data-transition-' + kind + ']')).find(function (node) {
          return node.getAttribute('data-transition-' + kind) === key
        })
        if (target) shared.push({ kind: kind, to: target, from: null })
      })
    }
    // Trailing page content, including the correction/footer area, fades with the article.
    for (var node = article; node; node = node.nextElementSibling) {
      if (node.tagName === 'SCRIPT') continue
      var bounds = node.getBoundingClientRect()
      var clone = cloneWithoutIds(node)
      var originals = [node].concat(Array.from(node.querySelectorAll('*')))
      var copies = [clone].concat(Array.from(clone.querySelectorAll('*')))
      originals.forEach(function (original, index) {
        if (original.scrollLeft || original.scrollTop) {
          scrolls.push({ node: copies[index], left: original.scrollLeft, top: original.scrollTop })
        }
        shared.forEach(function (pair) {
          if (pair.from || original.getAttribute('data-transition-' + pair.kind) !== key) return
          var bounds = original.getBoundingClientRect()
          if (bounds.bottom > viewport.top && bounds.top < viewport.bottom) {
            pair.from = copies[index]
          }
        })
      })
      clone.querySelectorAll('script').forEach(function (script) { script.remove() })
      clone.style.cssText = 'position:absolute;margin:0;box-sizing:border-box;left:' + bounds.left +
        'px;top:' + bounds.top + 'px;width:' + bounds.width + 'px;padding:' + getComputedStyle(node).padding
      cover.appendChild(clone)
    }
    return {
      element: cover,
      shared: shared.filter(function (pair) { return pair.from }),
      headerVisible: !headerBounds || (headerBounds.bottom > viewport.top && headerBounds.top < viewport.bottom),
      restoreScroll: function () {
        // Detached clones cannot retain scroll offsets; restore after insertion.
        scrolls.forEach(function (saved) {
          saved.node.scrollTo({ left: saved.left, top: saved.top, behavior: 'instant' })
        })
      }
    }
  }
  function slideArticle(cover, entering, page, removeCover, shared, stopShared) {
    shared = shared || []
    var article = entering[0]
    var viewport = page.scroll.viewport()
    var candidates = article.querySelectorAll('.post-header, .note-single-header, .markdown-body > *, .site-date-catalog, .posts-line, .notes-header, .notes-month-title, .note-entry, .notes-pagination, .taxonomy-term, .terms-item')
    var nodes = entering.slice(1)
    // Animate visible content groups only; a Note entry owns its nested body.
    for (var node of candidates) {
      if (shared.some(function (pair) { return node.contains(pair.to) })) continue
      if (nodes.some(function (parent) { return parent.contains(node) })) continue
      var bounds = node.getBoundingClientRect()
      if (bounds.top >= viewport.bottom + 24) break
      if (bounds.bottom > viewport.top && bounds.top < viewport.bottom + 24) nodes.push(node)
    }
    if (!shared.length && !nodes.some(function (node) { return article.contains(node) })) nodes.push(article)
    for (var sibling = article.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      if (sibling.tagName === 'SCRIPT') continue
      var bounds = sibling.getBoundingClientRect()
      if (bounds.bottom > viewport.top && bounds.top < viewport.bottom + 24) nodes.push(sibling)
    }
    var items = nodes.map(function (node) { return { node: node, delay: node.style.animationDelay } })
    var finished = false
    var stopListeners = []
    var stopMotion
    function finish() {
      if (finished) return
      finished = true
      removeCover()
      items.forEach(function (item) {
        item.node.classList.remove('navigation-enter-item')
        item.node.style.animationDelay = item.delay
      })
      stopListeners.forEach(function (stop) { stop() })
      if (stopMotion) stopMotion()
      if (stopShared) stopShared()
      stopCleanup()
      if (pageTransition === finish) pageTransition = null
    }
    var stopCleanup = page.addCleanup(finish)
    pageTransition = finish
    items.forEach(function (item, index) {
      item.node.style.animationDelay = (80 + Math.min(index * 45, 240)) + 'ms'
      item.node.classList.add('navigation-enter-item')
    })
    entering.forEach(function (node) {
      node.classList.remove('page-preparing')
      node.classList.add('page-entering')
    })
    cover.classList.add('is-leaving')
    var last = nodes[nodes.length - 1] || article
    var animation = 'page-slide-in'
    var duration = 500 + Math.min((nodes.length - 1) * 45, 240)
    var sidebar = document.getElementById('tocSidebar')
    if (sidebar && page.scroll.isWide()) {
      var links = sidebar.querySelectorAll('.toc-nav a')
      var tocDuration = 575 + Math.min((links.length - 1) * 35, 240)
      if (links.length && tocDuration > duration) {
        last = links[links.length - 1]
        animation = 'toc-item-enter'
        duration = tocDuration
      }
    }
    stopMotion = page.onMotionEnd(last, { type: 'animationend', animation: animation, timeout: duration + 100 }, finish)
    // Reading and activation take precedence over the remaining entrance delay.
    ;['pointerdown', 'click', 'wheel', 'touchmove', 'keydown'].forEach(function (type) {
      stopListeners.push(page.listen(document, type, finish, { capture: true, passive: true }))
    })
  }
  async function revealArticle(snapshot, entering, page, removeCover) {
    if (!page.active) { removeCover(); return }
    var viewport = page.scroll.viewport()
    var pairs = snapshot.shared.filter(function (pair) {
      var bounds = pair.to.getBoundingClientRect()
      return bounds.width > 0 && bounds.bottom > viewport.top && bounds.top < viewport.bottom
    })
    if (!pairs.length) {
      slideArticle(snapshot.element, entering, page, removeCover)
      return
    }
    var html = document.documentElement
    var transition
    var cancelled = false
    var cleaned = false
    pairs.forEach(function (pair) {
      pair.oldName = pair.from.style.viewTransitionName
      pair.newName = pair.to.style.viewTransitionName
      pair.from.style.viewTransitionName = 'yinyang-' + pair.kind
    })
    html.classList.add('navigation-sharing')
    function clean() {
      if (cleaned) return
      cleaned = true
      pairs.forEach(function (pair) {
        pair.from.style.viewTransitionName = pair.oldName
        pair.to.style.viewTransitionName = pair.newName
      })
      html.classList.remove('navigation-sharing')
      stopCleanup()
      if (pageTransition === stop) pageTransition = null
    }
    function stop() {
      cancelled = true
      if (transition) transition.skipTransition()
      clean()
    }
    var stopCleanup = page.addCleanup(stop)
    pageTransition = stop
    try {
      // All resource and script waits have finished. The callback only changes
      // the visible DOM, so the browser never pauses rendering for network I/O.
      transition = document.startViewTransition(function () {
        if (cancelled || !page.active) { removeCover(); return }
        snapshot.element.remove()
        pairs.forEach(function (pair) { pair.to.style.viewTransitionName = 'yinyang-' + pair.kind })
        slideArticle(snapshot.element, entering, page, removeCover, pairs, stop)
      })
    } catch (error) {
      clean()
      slideArticle(snapshot.element, entering, page, removeCover)
      return
    }
    transition.ready.catch(function () {})
    transition.finished.then(clean, clean)
    await transition.updateCallbackDone
  }
  async function commitPage(prepared, state, controller) {
    // An inserted script cannot be rolled back. Keep this document's initialization
    // alive; another document request uses a full navigation until it finishes.
    initializing = controller
    restoreGeneration++
    needsReady = true
    var next = prepared.document
    var destination = prepared.url
    var scripts = Array.from(next.body.querySelectorAll('script[data-page-runtime]'))
    var analytics = next.head.querySelector('script[data-page-analytics]')
    var article = next.body.querySelector('.app-scroll > article')
    var snapshot = article && !state && !destination.hash ? captureArticle(next) : null
    var cover = snapshot && snapshot.element
    var entering = [article]
    var header = next.body.querySelector('.app-header')
    // Resetting the new scroll container must not reveal an offscreen header
    // before the article is ready. Keep an already-visible header steady.
    if (snapshot && !snapshot.headerVisible && header) entering.push(header)
    var stopCoverCleanup
    function removeCover() {
      if (!cover) return
      cover.remove()
      cover = null
      removeOldStyles()
      entering.forEach(function (node) { node.classList.remove('page-preparing', 'page-entering') })
    }
    document.dispatchEvent(new CustomEvent('yinyang:before-navigate', { detail: { url: destination.href } }))
    rememberPage()
    var saved = state && state.yinyang ? positions.get(state.yinyang.id) : null
    lifecycle.page.dispose()
    displayedId = state && state.yinyang && state.yinyang.url === destination.href ? state.yinyang.id : writeEntry(destination, !!state)
    displayedURL = destination
    var removeOldStyles = syncHead(next, !!cover)
    document.documentElement.lang = next.documentElement.lang
    document.documentElement.classList.add('theme-changing')
    if (saved && saved.folds) next.body.querySelectorAll('.code-block-body').forEach(function (body, index) {
      if (typeof saved.folds[index] === 'boolean') body.classList.toggle('is-folded', saved.folds[index])
    })
    if (cover) entering.forEach(function (node) { node.classList.add('page-preparing') })
    document.body.replaceWith(next.body)
    if (loading) document.body.appendChild(loading)
    document.querySelector('.app-shell').setAttribute('aria-busy', 'true')
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    lifecycle.page = lifecycle.createPage()
    var page = lifecycle.mount()
    if (cover) {
      // Keep the visual copy out of feature initialization and its DOM queries.
      document.body.appendChild(cover)
      snapshot.restoreScroll()
      controller.reveal = removeCover
      stopCoverCleanup = page.addCleanup(removeCover)
    }
    page.scroll.onChange(rememberPosition)
    page.requestAnimationFrame(function () { document.documentElement.classList.remove('theme-changing') })
    // Keep a visual copy of the old article while statistics load. Unlike a
    // View Transition update callback, this leaves the loading animation running.
    if (page.notFoundReady) await page.notFoundReady
    await loadAnalytics(analytics, destination.href, page)
    for (var script of scripts) {
      await runScript(script, destination.href, script)
    }
    while (true) {
      // Let a user-requested footnote scroll finish before taking its snapshot.
      await nextFrame()
      var position = saved
      if (controller.interacted) {
        position = requestedPosition && requestedPosition.url === displayedURL.href
          ? requestedPosition.saved : page.scroll.capture()
      }
      if (await restorePosition(displayedURL, position, {
        focus: !state && !controller.interacted, ready: true
      })) break
      // A same-document action owns the new position and URL, including actions
      // during the two-frame restoration window.
      controller.interacted = true
    }
    if (stopCoverCleanup) stopCoverCleanup()
    controller.reveal = null
    if (cover) await revealArticle(snapshot, entering, page, removeCover)
  }
  async function navigate(url, state) {
    if (initializing || requiresDocumentNavigation(document.body) || document.body.hasAttribute('data-no-pjax')) {
      if (state) location.replace(url.href)
      else location.assign(url.href)
      return
    }
    cancelPending()
    rememberPage()
    var controller = new AbortController()
    pending = controller
    showLoading(controller)
    document.querySelector('.app-shell').setAttribute('aria-busy', 'true')
    try {
      var prepared = await fetchPage(url, controller)
      if (pending !== controller) return
      await prepareMath(prepared.document, controller)
      if (pending !== controller) return
      await commitPage(prepared, state, controller)
    } catch (error) {
      if (controller.signal.aborted) return
      if (initializing === controller) location.replace(displayedURL.href)
      else if (state) location.replace(url.href)
      else location.assign(url.href)
    } finally {
      if (initializing === controller) initializing = null
      if (pending === controller) cancelPending(false)
    }
  }

  lifecycle.mount()
  function restoreInitialPage(page) {
    var restore = page.guard(function () { restorePosition(displayedURL, null, { ready: true }) })
    if (page.notFoundReady) page.notFoundReady.then(restore)
    else restore()
  }
  if (!window.fetch || !window.AbortController || !document.querySelector('.app-shell')) {
    restoreInitialPage(lifecycle.page)
    return
  }
  history.scrollRestoration = 'manual'
  displayedId = writeEntry(displayedURL, true)
  rememberPosition()
  lifecycle.page.scroll.onChange(rememberPosition)
  window.yinyangNavigation = {
    pushHash: function (hash) {
      cancelPending()
      rememberPage()
      var url = new URL(location.href)
      url.hash = hash
      displayedId = writeEntry(url, false)
      displayedURL = url
      settleHash(url, false)
    }
  }
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    var link = event.target.closest && event.target.closest('a[href]')
    if (!link || link.hasAttribute('download') || link.closest('[data-no-pjax]') || (link.getAttribute('target') && link.getAttribute('target').toLowerCase() !== '_self')) return
    var url
    try { url = new URL(link.getAttribute('href'), document.baseURI) } catch (error) { return }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return
    if (/\.(?:xml|json|pdf|zip|gz|png|jpe?g|gif|webp|svg|mp[34]|webm|ogg|woff2?|ttf|css|js)$/i.test(url.pathname)) return
    event.preventDefault()
    if (!samePage(url, displayedURL)) { navigate(url, null); return }
    cancelPending()
    rememberPage()
    if (url.href !== displayedURL.href) {
      displayedId = writeEntry(url, false)
      displayedURL = url
    }
    if (url.hash) settleHash(url)
    else restorePosition(url, null, {})
  })
  window.addEventListener('popstate', function (event) {
    cancelPending()
    rememberPage()
    var url = new URL(location.href)
    if (!samePage(url, displayedURL)) { navigate(url, event.state || {}); return }
    displayedURL = url
    displayedId = event.state && event.state.yinyang ? event.state.yinyang.id : writeEntry(url, true)
    restorePosition(url, positions.get(displayedId), {})
  })
  window.addEventListener('hashchange', function () {
    var url = new URL(location.href)
    if (!samePage(url, displayedURL)) return
    // popstate already owns restoration for this entry.
    if (url.href === displayedURL.href) return
    cancelPending()
    var state = history.state && history.state.yinyang
    if (!state || state.url !== url.href) displayedId = writeEntry(url, true)
    displayedURL = url
    settleHash(url)
  })
  restoreInitialPage(lifecycle.page)
})()
