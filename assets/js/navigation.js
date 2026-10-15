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
  var loadingTimer = 0

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
    if (options.animate) {
      var article = document.querySelector('.app-scroll > article')
      if (article) {
        article.classList.remove('page-preparing')
        article.classList.add('page-entering')
        page.onMotionEnd(article, { type: 'animationend', animation: 'page-enter', timeout: 300 }, function () {
          article.classList.remove('page-entering')
        })
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
    clearTimeout(loadingTimer)
    loadingTimer = 0
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
      restoreGeneration++
      requestedPosition = null
      if (lifecycle.page.footnotes) lifecycle.page.footnotes.cancelScroll()
    }
    if (initializing) {
      initializing.interacted = true
      var article = document.querySelector('.app-scroll > article')
      if (article) article.classList.remove('page-preparing')
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
  function syncHead(next) {
    var previous = Array.from(document.head.querySelectorAll('[data-page-head]'))
    next.head.querySelectorAll('[data-page-head]').forEach(function (node) {
      var index = previous.findIndex(function (old) { return old.isEqualNode(node) })
      if (index !== -1) previous.splice(index, 1)
      else document.head.appendChild(node.cloneNode(true))
    })
    previous.forEach(function (node) { node.remove() })
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
    hideLoading()
    document.dispatchEvent(new CustomEvent('yinyang:before-navigate', { detail: { url: destination.href } }))
    rememberPage()
    var saved = state && state.yinyang ? positions.get(state.yinyang.id) : null
    lifecycle.page.dispose()
    displayedId = state && state.yinyang && state.yinyang.url === destination.href ? state.yinyang.id : writeEntry(destination, !!state)
    displayedURL = destination
    syncHead(next)
    document.documentElement.lang = next.documentElement.lang
    document.documentElement.classList.add('theme-changing')
    if (saved && saved.folds) next.body.querySelectorAll('.code-block-body').forEach(function (body, index) {
      if (typeof saved.folds[index] === 'boolean') body.classList.toggle('is-folded', saved.folds[index])
    })
    var article = next.body.querySelector('.app-scroll > article')
    if (article) article.classList.add('page-preparing')
    document.body.replaceWith(next.body)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    lifecycle.page = lifecycle.createPage()
    var page = lifecycle.mount()
    page.scroll.onChange(rememberPosition)
    page.requestAnimationFrame(function () { document.documentElement.classList.remove('theme-changing') })
    for (var script of scripts) {
      await runScript(script, destination.href, script)
    }
    if (analytics) runScript(analytics, destination.href, document.head.querySelector('script[data-page-analytics]')).catch(function () {})
    else {
      var oldAnalytics = document.head.querySelector('script[data-page-analytics]')
      if (oldAnalytics) oldAnalytics.remove()
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
        focus: !state && !controller.interacted, animate: true, ready: true
      })) break
      // A same-document action owns the new position and URL, including actions
      // during the two-frame restoration window.
      controller.interacted = true
    }
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
    loadingTimer = setTimeout(function () { showLoading(controller) }, 120)
    document.querySelector('.app-shell').setAttribute('aria-busy', 'true')
    try {
      var prepared = await fetchPage(url, controller)
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
  if (!window.fetch || !window.AbortController || !document.querySelector('.app-shell')) {
    restorePosition(displayedURL, null, { ready: true })
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
  restorePosition(displayedURL, null, { ready: true })
})()
