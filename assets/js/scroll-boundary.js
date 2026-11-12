window.yinyangRuntime.register('scroll-boundary', function (runtime) {
  var shell = document.querySelector('.app-main')
  var limit = 72
  var resistance = .55
  var rawPull = 0
  var releaseTimer = 0
  var lastMove = 0
  var inputUntil = 0
  var inputDelta = 0
  var lastTop = runtime.scroll.position().top
  var touch = null
  var wheel = null
  var spring = window.yinyangRuntime.createSpring(runtime, paint, { mass: 1, stiffness: 280, dampingRatio: .82 })
  runtime.scrollEffect = { get offset() { return spring.position }, reset: reset }
  document.documentElement.classList.add('scroll-boundary-feedback')

  function paint(offset) {
    if (!shell) return
    if (offset) {
      shell.style.setProperty('--scroll-boundary-offset', offset + 'px')
      shell.classList.add('scroll-boundary-active')
    } else {
      shell.style.removeProperty('--scroll-boundary-offset')
      shell.classList.remove('scroll-boundary-active')
    }
  }
  function clearMotion() {
    runtime.clearTimeout(releaseTimer)
    releaseTimer = 0
    rawPull = 0
    spring.reset()
  }
  function reset() {
    clearMotion()
    inputUntil = 0
    wheel = null
    lastTop = runtime.scroll.position().top
  }
  function release(cancelled) {
    runtime.clearTimeout(releaseTimer)
    releaseTimer = 0
    rawPull = 0
    spring.release(cancelled || performance.now() - lastMove >= 80 ? 0 : spring.velocity)
  }
  function unresist(offset) {
    return -Math.sign(offset) * limit / resistance * Math.log(1 - Math.min(.999, Math.abs(offset) / limit))
  }
  function range() {
    var view = runtime.scroll.viewport()
    var node = runtime.scroll.isWide() ? document.documentElement : runtime.scroll.element()
    return { node: node, height: view.height, max: Math.max(0, node.scrollHeight - view.height), top: runtime.scroll.position().top }
  }
  function edge(bounds) {
    bounds = bounds || range()
    if (bounds.max <= 1) return 0
    return bounds.top <= 1 ? 1 : bounds.top >= bounds.max - 1 ? -1 : 0
  }
  function accepts(event) {
    if (event.defaultPrevented || document.documentElement.classList.contains('toc-open')) return false
    var node = event.target
    if (node.closest && node.closest('[inert], [role="dialog"], [role="menu"]')) return false
    var root = runtime.scroll.isWide() ? document.documentElement : runtime.scroll.element()
    for (; node && node !== root && node !== document.body; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) return false
    }
    return true
  }
  function flushWheel(bounds) {
    if (!wheel || !wheel.pending || performance.now() - wheel.time > 800) return
    if (wheel.pending * edge(bounds) >= 0) return
    // Wheel input adds momentum, never displacement. Taper the speed budget
    // as the page approaches a small desktop excursion.
    spring.impulse(-wheel.pending * 3, 400 * Math.max(0, 1 - Math.abs(spring.position) / 24))
    wheel.pending = 0
  }
  function wheelInput(event) {
    if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !accepts(event)) return
    var bounds = range()
    if (bounds.max <= 1) { reset(); return }
    var delta = event.deltaY
    if (event.deltaMode === 1) {
      var style = getComputedStyle(bounds.node)
      delta *= parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    } else if (event.deltaMode === 2) delta *= bounds.height
    var now = performance.now()
    var direction = Math.sign(delta)
    var magnitude = Math.abs(delta)
    var gap = wheel ? now - wheel.time : Infinity
    if (!wheel || gap > 160 || wheel.direction !== direction) {
      wheel = { target: lastTop, direction: direction, pending: 0, feedback: false, tail: false }
    }
    // Browsers do not identify trackpad inertia. A rapidly decaying pixel
    // sequence stops adding force after its first response; a fresh push resumes it.
    if (event.deltaMode === 0 && wheel.pixel && gap <= 50 && wheel.feedback) {
      if (magnitude < wheel.magnitude * .85) wheel.tail = true
      else if (magnitude > wheel.magnitude * 1.25 + 1) wheel.tail = false
    } else wheel.tail = false
    wheel.time = now
    wheel.magnitude = magnitude
    wheel.pixel = event.deltaMode === 0
    // Project native travel because several wheel events may precede a scroll
    // notification. A passive listener can also see this event's compositor
    // scroll already applied, so reconcile against the last notified position.
    var target = direction > 0 ? Math.max(wheel.target, lastTop) : Math.min(wheel.target, lastTop)
    target = Math.max(0, Math.min(bounds.max, target)) + delta
    wheel.target = Math.max(0, Math.min(bounds.max, target))
    if (!wheel.tail) {
      wheel.pending += target - wheel.target
      if (wheel.pending) wheel.feedback = true
    }
    inputUntil = 0
    touch = null
    runtime.clearTimeout(releaseTimer)
    releaseTimer = 0
    rawPull = 0
    if (delta * edge(bounds) > 0) clearMotion()
    flushWheel(bounds)
  }
  function pull(delta) {
    var side = edge()
    if (!side || (!spring.position && delta * side >= 0)) { clearMotion(); return false }
    if (!rawPull && spring.position * side > 0) rawPull = unresist(spring.position)
    rawPull -= delta
    if (rawPull * side <= 0) { clearMotion(); return false }
    var offset = Math.sign(rawPull) * limit * (1 - Math.exp(-Math.abs(rawPull) * resistance / limit))
    var now = performance.now()
    var speed = (offset - spring.position) * 1000 / Math.max(1, now - lastMove)
    lastMove = now
    // Dragging writes its resisted position immediately; only release is simulated.
    spring.hold(offset, Math.max(-900, Math.min(900, speed)))
    if (!touch) {
      runtime.clearTimeout(releaseTimer)
      releaseTimer = runtime.setTimeout(function () { release(false) }, 80)
    }
    return true
  }
  runtime.listen(document, 'wheel', wheelInput, { passive: true })
  runtime.listen(document, 'pointerdown', function (event) {
    if (event.pointerType !== 'touch' || (event.target.closest && event.target.closest('a, button, input, select, textarea'))) reset()
  }, { passive: true })
  runtime.listen(document, 'touchstart', function (event) {
    if (event.touches.length !== 1 || !accepts(event)) { touch = null; reset(); return }
    wheel = null
    inputUntil = 0
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    runtime.clearTimeout(releaseTimer)
    rawPull = unresist(spring.position)
    spring.hold(spring.position, 0)
    lastMove = performance.now()
  }, { passive: true })
  runtime.listen(document, 'touchmove', function (event) {
    if (!touch || event.touches.length !== 1) { touch = null; release(true); return }
    var point = event.touches[0]
    var dx = touch.x - point.clientX
    var dy = touch.y - point.clientY
    touch = { x: point.clientX, y: point.clientY }
    if (Math.abs(dy) <= Math.abs(dx) || !accepts(event)) return
    inputDelta = dy
    inputUntil = performance.now() + 240
    if (pull(dy) && event.cancelable) event.preventDefault()
  }, { passive: false })
  ;['touchend', 'touchcancel'].forEach(function (type) {
    runtime.listen(document, type, function () { touch = null; release(type === 'touchcancel') }, { passive: true })
  })
  runtime.addCleanup(runtime.scroll.onChange(function () {
    var top = runtime.scroll.position().top
    if (wheel) flushWheel(range())
    else if (top !== lastTop && performance.now() <= inputUntil) {
      inputUntil = performance.now() + 240
      pull(inputDelta)
    }
    lastTop = top
  }))
  runtime.addCleanup(runtime.scroll.onModeChange(reset))
  ;['keydown', 'click'].forEach(function (type) { runtime.listen(document, type, reset, true) })
  runtime.listen(window, 'blur', reset)
  runtime.listen(window, 'resize', reset)
  runtime.addCleanup(function () {
    reset()
    document.documentElement.classList.remove('scroll-boundary-feedback')
    delete runtime.scrollEffect
  })
})
