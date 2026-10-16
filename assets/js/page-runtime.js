;(function () {
  var initializers = []
  function createPage() {
    var active = true
    var listeners = new Set()
    var timers = new Set()
    var frames = new Set()
    var cleanups = new Set()
    function capture(options) { return typeof options === 'boolean' ? options : !!(options && options.capture) }
    function removeListener(item) {
      if (!listeners.delete(item)) return
      if (item.target.removeEventListener) item.target.removeEventListener(item.type, item.listener, item.options)
      else item.target.removeListener(item.listener)
    }
    var page = {
      get active() { return active },
      guard: function (callback) { return function () { if (active) return callback.apply(this, arguments) } },
      listen: function (target, type, handler, options) {
        if (!active) return function () {}
        var existing = Array.from(listeners).find(function (item) {
          return item.target === target && item.type === type && item.handler === handler && capture(item.options) === capture(options)
        })
        if (existing) return function () { removeListener(existing) }
        var item = { target: target, type: type, handler: handler, options: options }
        item.listener = function (event) {
          if (options && options.once) removeListener(item)
          if (!active) return
          if (typeof handler === 'function') handler.call(this, event)
          else handler.handleEvent(event)
        }
        listeners.add(item)
        if (target.addEventListener) target.addEventListener(type, item.listener, options)
        else target.addListener(item.listener)
        return function () { removeListener(item) }
      },
      unlisten: function (target, type, handler, options) {
        listeners.forEach(function (item) {
          if (item.target === target && item.type === type && item.handler === handler && capture(item.options) === capture(options)) removeListener(item)
        })
      },
      setTimeout: function (callback, delay) {
        if (!active) return 0
        var id = setTimeout(function () { timers.delete(id); if (active) callback() }, delay)
        timers.add(id)
        return id
      },
      clearTimeout: function (id) { clearTimeout(id); timers.delete(id) },
      requestAnimationFrame: function (callback) {
        if (!active) return 0
        var id = requestAnimationFrame(function (time) { frames.delete(id); if (active) callback(time) })
        frames.add(id)
        return id
      },
      cancelAnimationFrame: function (id) { cancelAnimationFrame(id); frames.delete(id) },
      addCleanup: function (callback) {
        if (!active) { callback(); return function () {} }
        cleanups.add(callback)
        return function () { cleanups.delete(callback) }
      },
      onMotionEnd: function (node, options, callback) {
        if (!active) return function () {}
        var timer = 0
        var stopListening = page.listen(node, options.type || 'transitionend', function (event) {
          if (event.target !== node) return
          if (options.property && event.propertyName !== options.property) return
          if (options.animation && event.animationName !== options.animation) return
          finish()
        })
        var stopCleanup = page.addCleanup(cancel)
        function cancel() { stopListening(); page.clearTimeout(timer); stopCleanup() }
        function finish() { cancel(); callback() }
        timer = page.setTimeout(finish, options.timeout)
        return cancel
      },
      pushHash: function (hash) {
        if (window.yinyangNavigation) window.yinyangNavigation.pushHash(hash)
        else history.pushState(null, '', hash)
      },
      expose: function (name, value) {
        window[name] = value
        page.addCleanup(function () { if (window[name] === value) delete window[name] })
      },
      dispose: function () {
        if (!active) return
        active = false
        listeners.forEach(removeListener)
        timers.forEach(clearTimeout)
        frames.forEach(cancelAnimationFrame)
        // A failing custom cleanup must not prevent other features from releasing resources.
        cleanups.forEach(function (callback) {
          try { callback() } catch (error) { console.error('YinYang cleanup failed', error) }
        })
        cleanups.clear()
        timers.clear()
        frames.clear()
      }
    }
    return page
  }
  var runtime = {
    createPage: createPage,
    page: createPage(),
    register: function (name, initialize) { initializers.push({ name: name, initialize: initialize }) },
    mount: function () {
      var config = document.getElementById('yinyang-page-config')
      runtime.page.config = config ? JSON.parse(config.textContent) : {}
      runtime.page.scroll = runtime.createScroll(runtime.page)
      initializers.forEach(function (feature) { feature.initialize(runtime.page) })
      runtime.mounted = true
      return runtime.page
    }
  }
  window.yinyangRuntime = runtime
})()
