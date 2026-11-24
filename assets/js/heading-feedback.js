window.yinyangRuntime.register('heading-feedback', function (runtime) {
  var highlighted = null
  var cancel = null
  function clear() {
    if (cancel) cancel()
    cancel = null
    if (highlighted) highlighted.classList.remove('heading-target')
    highlighted = null
  }

  runtime.highlightHeading = function (target) {
    if (!/^H[1-6]$/.test(target.tagName)) return
    clear()
    highlighted = target
    // Flush the removal so clicking the current fragment can replay it.
    void target.offsetWidth
    target.classList.add('heading-target')
    cancel = runtime.onMotionEnd(target, { type: 'animationend', animation: 'heading-target-arrow', timeout: 1650 }, clear)
  }

  runtime.addCleanup(clear)
})
