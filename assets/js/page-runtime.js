;(function () {
  function createPage() {
    var active = true
    var listeners = []
    var timers = new Set()
    var frames = new Set()
    var cleanups = []

    function removeListener(item) {
      if (item.target.removeEventListener) item.target.removeEventListener(item.type, item.handler, item.options)
      else item.target.removeListener(item.handler)
    }

    var page = {
      guard: function (callback) {
        return function () { if (active) return callback.apply(this, arguments) }
      },
      listen: function (target, type, handler, options) {
        if (target.addEventListener) target.addEventListener(type, handler, options)
        else target.addListener(handler)
        listeners.push({ target: target, type: type, handler: handler, options: options })
      },
      unlisten: function (target, type, handler, options) {
        var capture = typeof options === 'boolean' ? options : !!(options && options.capture)
        for (var i = listeners.length - 1; i >= 0; i--) {
          var item = listeners[i]
          var itemCapture = typeof item.options === 'boolean' ? item.options : !!(item.options && item.options.capture)
          if (item.target === target && item.type === type && item.handler === handler && itemCapture === capture) {
            removeListener(item)
            listeners.splice(i, 1)
          }
        }
      },
      setTimeout: function (callback, delay) {
        var id = setTimeout(function () {
          timers.delete(id)
          if (active) callback()
        }, delay)
        timers.add(id)
        return id
      },
      clearTimeout: function (id) { clearTimeout(id); timers.delete(id) },
      requestAnimationFrame: function (callback) {
        var id = requestAnimationFrame(function (time) {
          frames.delete(id)
          if (active) callback(time)
        })
        frames.add(id)
        return id
      },
      cancelAnimationFrame: function (id) { cancelAnimationFrame(id); frames.delete(id) },
      addCleanup: function (callback) { cleanups.push(callback) },
      expose: function (name, value) {
        window[name] = value
        cleanups.push(function () { if (window[name] === value) delete window[name] })
      },
      dispose: function () {
        if (!active) return
        active = false
        listeners.forEach(removeListener)
        timers.forEach(clearTimeout)
        frames.forEach(cancelAnimationFrame)
        cleanups.forEach(function (callback) { callback() })
        listeners.length = cleanups.length = 0
        timers.clear()
        frames.clear()
      }
    }
    return page
  }

  window.yinyangRuntime = { createPage: createPage, page: createPage() }
})()
