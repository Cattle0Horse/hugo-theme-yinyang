;(function () {
  if (!window.fetch || !window.AbortController || !document.querySelector('.app-shell')) return
  var lifecycle = window.yinyangRuntime
  var wide = window.matchMedia('(min-width: 84em)')
  var positions = new Map()
  var sequence = 0
  var prefix = Date.now().toString(36) + '-'
  var displayedURL = new URL(location.href)
  var displayedId = null
  var pending = null
  var pendingAnchor = false
  var loading = null
  var loadingTimer = 0
  history.scrollRestoration = 'manual'

  function writeEntry(url, replace) {
    var id = prefix + (++sequence)
    var state = Object.assign({}, history.state, { yinyang: { id: id, url: url.href } })
    history[replace ? 'replaceState' : 'pushState'](state, '', url.href)
    return id
  }

  function rememberPosition() {
    if (pendingAnchor) return
    var scroll = document.getElementById('appScroll')
    positions.set(displayedId, Object.assign({}, positions.get(displayedId), { top: wide.matches ? window.scrollY : scroll.scrollTop, left: wide.matches ? window.scrollX : scroll.scrollLeft }))
  }

  function rememberPage() {
    rememberPosition()
    var position = positions.get(displayedId)
    position.folds = Array.from(document.querySelectorAll('.code-block-body')).map(function (body) { return body.classList.contains('is-folded') })
    position.horizontal = Array.from(document.querySelectorAll('.code-scroll-viewport, .table-scroll')).map(function (scroll) { return scroll.scrollLeft })
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
    loading.appendChild(progress)
    loading.appendChild(label)
    document.body.appendChild(loading)
  }

  function cancelPending() {
    if (pending) pending.abort()
    pending = null
    hideLoading()
    document.querySelector('.app-shell').removeAttribute('aria-busy')
  }

  function samePage(a, b) { return a.pathname === b.pathname && a.search === b.search }

  function executable(script) {
    return !script.type || /^(?:module|text\/javascript|application\/javascript)$/i.test(script.type)
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
    var script = document.createElement('script')
    Array.from(source.attributes).forEach(function (attribute) { script.setAttribute(attribute.name, attribute.value) })
    if (source.src) script.src = new URL(source.getAttribute('src'), url).href
    script.async = false
    script.textContent = source.textContent
    if (target) target.replaceWith(script)
    else document.head.appendChild(script)
  }

  function restorePosition(url, saved, body, focus, animate) {
    function scrollToPosition() {
      if (document.body !== body) return
      var scroll = document.getElementById('appScroll')
      var top = saved ? saved.top : 0
      var left = saved ? saved.left : 0
      if (!saved && url.hash) {
        var id = url.hash.slice(1)
        try { id = decodeURIComponent(id) } catch (error) {}
        var target = document.getElementById(id)
        if (target) top = target.getBoundingClientRect().top + (wide.matches ? window.scrollY : scroll.scrollTop - scroll.getBoundingClientRect().top) - 64
      }
      ;(wide.matches ? window : scroll).scrollTo({ top: Math.max(0, top), left: left, behavior: 'instant' })
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (document.body !== body) return
        if (saved && saved.horizontal) document.querySelectorAll('.code-scroll-viewport, .table-scroll').forEach(function (scroll, index) { scroll.scrollLeft = saved.horizontal[index] || 0 })
        scrollToPosition()
        if (focus) {
          var heading = document.querySelector('.app-scroll h1, .app-scroll h2')
          if (heading) {
            var temporary = !heading.hasAttribute('tabindex')
            if (temporary) heading.setAttribute('tabindex', '-1')
            heading.focus({ preventScroll: true })
            if (temporary) lifecycle.page.listen(heading, 'blur', function () { heading.removeAttribute('tabindex') }, { once: true })
          }
        }
        if (animate) {
          var article = document.querySelector('.app-scroll > article')
          if (article) {
            article.classList.remove('page-preparing')
            article.classList.add('page-entering')
            lifecycle.page.listen(article, 'animationend', function (event) {
              if (event.target === article && event.animationName === 'page-enter') article.classList.remove('page-entering')
            })
          }
        }
        rememberPosition()
        if (animate) document.dispatchEvent(new CustomEvent('yinyang:page-ready', { detail: { url: url.href } }))
      })
    })
  }

  async function navigate(url, state) {
    cancelPending()
    rememberPosition()
    var controller = new AbortController()
    pending = controller
    loadingTimer = setTimeout(function () { showLoading(controller) }, 120)
    document.querySelector('.app-shell').setAttribute('aria-busy', 'true')
    try {
      var response = await fetch(url.href, { signal: controller.signal, credentials: 'same-origin' })
      if ((!response.ok && response.status !== 404) || !/text\/html/i.test(response.headers.get('Content-Type') || '')) throw new Error('Not a theme page')
      var destination = new URL(response.url)
      if (destination.origin !== location.origin) throw new Error('External redirect')
      destination.hash = url.hash
      var next = new DOMParser().parseFromString(await response.text(), 'text/html')
      if (pending !== controller) return
      if (!next.querySelector('.app-shell #appScroll') || !next.querySelector('script[data-yinyang-runtime]') || next.body.hasAttribute('data-no-pjax')) throw new Error('Unsupported page')
      if (next.querySelector('script[data-yinyang-runtime]').textContent !== document.querySelector('script[data-yinyang-runtime]').textContent || next.querySelector('script[data-yinyang-navigation]').getAttribute('src') !== document.querySelector('script[data-yinyang-navigation]').getAttribute('src')) throw new Error('Runtime version changed')
      // Unmanaged custom scripts keep their normal full-document lifecycle.
      if (Array.from(next.body.querySelectorAll('script')).some(function (script) { return executable(script) && !script.hasAttribute('data-page-runtime') })) throw new Error('Custom page scripts')
      var scripts = Array.from(next.body.querySelectorAll('script[data-page-runtime]'))
      var analytics = next.head.querySelector('script[data-page-analytics]')
      hideLoading()
      document.dispatchEvent(new CustomEvent('yinyang:before-navigate', { detail: { url: destination.href } }))
      lifecycle.page.dispose()
      rememberPage()
      var saved = state && state.yinyang ? positions.get(state.yinyang.id) : null
      displayedId = state && state.yinyang && state.yinyang.url === destination.href ? state.yinyang.id : writeEntry(destination, !!state)
      displayedURL = destination
      pendingAnchor = false
      syncHead(next)
      document.documentElement.lang = next.documentElement.lang
      document.documentElement.classList.add('theme-changing')
      if (saved && saved.folds) next.body.querySelectorAll('.code-block-body').forEach(function (body, index) {
        if (typeof saved.folds[index] === 'boolean') body.classList.toggle('is-folded', saved.folds[index])
      })
      var nextArticle = next.body.querySelector('.app-scroll > article')
      if (nextArticle) nextArticle.classList.add('page-preparing')
      document.body.replaceWith(next.body)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      lifecycle.page = lifecycle.createPage()
      scripts.forEach(function (script) { runScript(script, destination.href, script) })
      lifecycle.page.requestAnimationFrame(function () { document.documentElement.classList.remove('theme-changing') })
      if (analytics) runScript(analytics, destination.href, document.head.querySelector('script[data-page-analytics]'))
      pending = null
      restorePosition(destination, saved, document.body, !state, true)
    } catch (error) {
      if (controller.signal.aborted) return
      if (state) location.replace(url.href)
      else location.assign(url.href)
    } finally {
      if (pending === controller) {
        pending = null
        hideLoading()
        document.querySelector('.app-shell').removeAttribute('aria-busy')
      }
    }
  }

  displayedId = writeEntry(displayedURL, true)
  rememberPosition()
  window.yinyangNavigation = {
    pushHash: function (hash) {
      cancelPending()
      rememberPosition()
      var url = new URL(location.href)
      url.hash = hash
      displayedId = writeEntry(url, false)
      displayedURL = url
      pendingAnchor = false
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
    cancelPending()
    rememberPosition()
    if (samePage(url, displayedURL)) {
      if (!url.hash) {
        event.preventDefault()
        if (displayedURL.hash) {
          displayedId = writeEntry(url, false)
          displayedURL = url
        }
        restorePosition(url, null, document.body, false)
        return
      }
      pendingAnchor = url.href !== location.href
      return
    }
    event.preventDefault()
    navigate(url, null)
  })

  window.addEventListener('popstate', function (event) {
    cancelPending()
    rememberPosition()
    var url = new URL(location.href)
    if (!samePage(url, displayedURL)) {
      // Distinguish history traversal even when another script used a null state.
      navigate(url, event.state || {})
      return
    }
    displayedURL = url
    displayedId = event.state && event.state.yinyang ? event.state.yinyang.id : writeEntry(url, true)
    pendingAnchor = false
    restorePosition(url, positions.get(displayedId), document.body, false)
  })

  window.addEventListener('hashchange', function () {
    if (!samePage(new URL(location.href), displayedURL)) return
    var state = history.state && history.state.yinyang
    if (!state || state.url !== location.href) displayedId = writeEntry(new URL(location.href), true)
    displayedURL = new URL(location.href)
    pendingAnchor = false
  })
  document.addEventListener('scroll', function (event) {
    if (event.target === document || event.target.id === 'appScroll') rememberPosition()
  }, { capture: true, passive: true })
  document.dispatchEvent(new CustomEvent('yinyang:page-ready', { detail: { url: displayedURL.href } }))
})()
