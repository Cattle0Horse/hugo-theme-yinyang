window.yinyangRuntime.register('tooltip', function (runtime) {
  var tooltip = document.getElementById('uiTooltip')
  if (!tooltip) return
  var active = null
  var timer = 0

  function positionTooltip(target) {
    if (!tooltip || !target) return
    var rect = target.getBoundingClientRect()
    var tip = tooltip.getBoundingClientRect()
    var top = rect.top - tip.height - 8
    var below = top < 8
    if (below) top = rect.bottom + 8
    var left = rect.left + (rect.width - tip.width) / 2
    left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8))
    tooltip.style.left = left + 'px'
    tooltip.style.top = top + 'px'
    tooltip.classList.toggle('is-below', below)
  }

  function show(target, delayed) {
    runtime.clearTimeout(timer)
    if (target.hasAttribute('data-copy-feedback')) return
    timer = runtime.setTimeout(function () {
      active = target
      tooltip.textContent = target.getAttribute('data-tooltip') || target.getAttribute('aria-label')
      tooltip.setAttribute('aria-hidden', 'false')
      tooltip.classList.add('is-visible')
      positionTooltip(target)
    }, delayed ? 300 : 0)
  }

  function hide(target) {
    runtime.clearTimeout(timer)
    if (target && active && target !== active) return
    active = null
    tooltip.classList.remove('is-visible')
    tooltip.setAttribute('aria-hidden', 'true')
  }

  function update(target) {
    if (active !== target) return
    tooltip.textContent = target.getAttribute('data-tooltip') || target.getAttribute('aria-label')
    positionTooltip(target)
  }

  runtime.tooltip = { update: update, hide: hide }
  runtime.addCleanup(function () { hide() })

  if (window.matchMedia('(hover: hover)').matches) {
    runtime.listen(document, 'mouseover', function (event) {
      var target = event.target.closest('[data-tooltip]')
      if (target && !target.contains(event.relatedTarget)) show(target, true)
    })
    runtime.listen(document, 'mouseout', function (event) {
      var target = event.target.closest('[data-tooltip]')
      if (target && !target.contains(event.relatedTarget)) hide(target)
    })
  }
  runtime.listen(document, 'focusin', function (event) {
    var target = event.target.closest('[data-tooltip]')
    if (target && target.matches(':focus-visible')) show(target, false)
  })
  runtime.listen(document, 'focusout', function (event) {
    var target = event.target.closest('[data-tooltip]')
    if (target) hide(target)
  })
  runtime.listen(window, 'resize', function () { if (active) positionTooltip(active) })
})
