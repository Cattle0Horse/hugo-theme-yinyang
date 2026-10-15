window.yinyangRuntime.register('scrollbar', function (runtime) {
  function scrollNode() { return runtime.scroll.isWide() ? document.documentElement : runtime.scroll.element() }
  var active = scrollNode()
  var timer = 0
  var frame = 0
  var near = false
  var rect = null
  function refresh() {
    var next = scrollNode()
    if (next !== active) {
      active.classList.remove('show-scrollbar')
      active = next
      rect = null
      near = false
    }
  }
  function hideLater() {
    runtime.clearTimeout(timer)
    timer = runtime.setTimeout(function () {
      if (!near) active.classList.remove('show-scrollbar')
    }, 600)
  }
  runtime.addCleanup(runtime.scroll.onChange(function () {
    refresh()
    active.classList.add('show-scrollbar')
    hideLater()
  }))
  runtime.listen(document, 'mousemove', function (event) {
    runtime.cancelAnimationFrame(frame)
    frame = runtime.requestAnimationFrame(function () {
      refresh()
      if (!rect) rect = active.getBoundingClientRect()
      var wasNear = near
      near = event.clientX > rect.right - 24
      if (near) {
        active.classList.add('show-scrollbar')
        runtime.clearTimeout(timer)
      } else if (wasNear) hideLater()
    })
  }, { passive: true })
  runtime.listen(window, 'resize', function () { refresh(); rect = null })
  runtime.addCleanup(function () { active.classList.remove('show-scrollbar') })
})
