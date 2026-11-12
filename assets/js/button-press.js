window.yinyangRuntime.register('button-press', function (runtime) {
  var pressed = null
  var pointer = null
  var origin = null
  var started = 0
  var releaseTimer = 0

  function clear() {
    runtime.clearTimeout(releaseTimer)
    releaseTimer = 0
    if (pressed) pressed.classList.remove('is-pressed')
    pressed = null
    pointer = null
    origin = null
  }

  runtime.listen(document, 'pointerdown', function (event) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (!event.isPrimary || event.button !== 0) { clear(); return }
    clear()
    var button = event.target.closest('.action-button, .palette-option')
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return
    pressed = button
    pointer = event.pointerId
    origin = { x: event.clientX, y: event.clientY }
    started = performance.now()
    button.classList.add('is-pressed')
  }, { passive: true })

  runtime.listen(document, 'pointerup', function (event) {
    if (!pressed || event.pointerId !== pointer) return
    pointer = null
    // A quick tap can end before the browser paints :active. Keep enough of
    // the press visible without delaying the click or opening its menu.
    var remaining = 100 - (performance.now() - started)
    if (remaining > 0) releaseTimer = runtime.setTimeout(clear, remaining)
    else clear()
  }, { passive: true })

  runtime.listen(document, 'pointermove', function (event) {
    if (pressed && event.pointerId === pointer && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) clear()
  }, { passive: true })
  runtime.listen(document, 'pointercancel', function (event) { if (event.pointerId === pointer) clear() }, { passive: true })
  runtime.listen(document, 'scroll', clear, { capture: true, passive: true })
  runtime.listen(window, 'blur', clear)
  runtime.addCleanup(clear)
})
