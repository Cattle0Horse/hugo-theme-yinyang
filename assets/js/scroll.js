;(function () {
  var wide = window.matchMedia('(min-width: 84em)')
  var readingSelector = 'p, pre, table, h1, h2, h3, h4, h5, h6, .note-entry, .posts-line, .code-block-wrapper'

  window.yinyangRuntime.createScroll = function (runtime) {
    var app = document.getElementById('appScroll')
    var mode = wide.matches
    var transferring = false
    var reading = null
    var frame = 0
    var subscribers = new Set()
    var modeSubscribers = new Set()

    function element() { return wide.matches ? window : app }
    function viewport() {
      if (wide.matches) return { top: 0, bottom: window.innerHeight, height: window.innerHeight }
      var rect = app.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, height: app.clientHeight }
    }
    function position() {
      return { top: wide.matches ? window.scrollY : app.scrollTop, left: wide.matches ? window.scrollX : app.scrollLeft }
    }
    function pathFor(node) {
      var path = []
      while (node && node !== app) {
        path.unshift(Array.prototype.indexOf.call(node.parentElement.children, node))
        node = node.parentElement
      }
      return node === app ? path : null
    }
    function nodeFor(path) {
      if (!path) return null
      return path.reduce(function (node, index) { return node && node.children[index] }, app)
    }
    function capture() {
      // CSS changes the container before its queued mode event and frame run.
      // Keep the last reading anchor until that transfer has actually completed.
      if ((transferring || mode !== wide.matches) && reading) return reading
      if (document.documentElement.classList.contains('toc-open') && reading) return reading
      var view = viewport()
      var content = document.querySelector('.app-content').getBoundingClientRect()
      // Sample inside a heading aligned at 64px, beyond fractional-pixel rounding.
      var hit = document.elementFromPoint(content.left + content.width / 2, view.top + 68)
      var anchor = hit && hit.closest(readingSelector)
      if (anchor && !app.contains(anchor)) anchor = null
      var offset = position()
      reading = {
        top: offset.top, left: offset.left, wide: wide.matches,
        anchor: anchor ? pathFor(anchor) : null,
        anchorTop: anchor ? anchor.getBoundingClientRect().top - view.top : 0
      }
      return reading
    }
    function restore(saved) {
      if (!saved) return
      var top = saved.top
      var anchor = nodeFor(saved.anchor)
      if (anchor) top = position().top + anchor.getBoundingClientRect().top - viewport().top - saved.anchorTop
      element().scrollTo({ top: Math.max(0, top), left: saved.left || 0, behavior: 'instant' })
      capture()
    }
    function scrollToElement(target, options) {
      options = options || {}
      var view = viewport()
      var rect = target.getBoundingClientRect()
      var top = position().top + rect.top - view.top - (options.offset == null ? 64 : options.offset)
      if (options.align === 'center') top = position().top + rect.top - view.top - (view.height - rect.height) / 2
      var max = wide.matches ? document.documentElement.scrollHeight - view.height : app.scrollHeight - view.height
      element().scrollTo({ top: Math.max(0, Math.min(top, Math.max(0, max))), behavior: options.behavior || 'auto' })
    }
    function target(hash) {
      var id = hash.replace(/^#/, '')
      try { id = decodeURIComponent(id) } catch (error) {}
      return document.getElementById(id)
    }
    function notify() {
      frame = 0
      if (mode === wide.matches) capture()
      subscribers.forEach(function (callback) { callback(reading) })
    }
    function schedule() { if (!frame) frame = runtime.requestAnimationFrame(notify) }

    runtime.listen(app, 'scroll', schedule, { passive: true })
    runtime.listen(window, 'scroll', schedule, { passive: true })
    runtime.listen(window, 'resize', schedule)
    runtime.listen(wide, 'change', function () {
      var saved = reading
      mode = wide.matches
      transferring = true
      modeSubscribers.forEach(function (callback) { callback() })
      // Let mode-dependent UI unlock its background before transferring the reading position.
      runtime.requestAnimationFrame(function () {
        restore(saved)
        transferring = false
        capture()
      })
      schedule()
    })
    capture()
    return {
      isWide: function () { return wide.matches }, element: element, viewport: viewport, position: position,
      capture: capture, restore: restore, target: target, scrollToElement: scrollToElement,
      onChange: function (callback) { subscribers.add(callback); return function () { subscribers.delete(callback) } },
      onModeChange: function (callback) { modeSubscribers.add(callback); return function () { modeSubscribers.delete(callback) } }
    }
  }
})()
