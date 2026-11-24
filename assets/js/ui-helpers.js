window.yinyangRuntime.register('ui-helpers', function (runtime) {
  runtime.label = function (button, label) {
    if (!button) return
    button.setAttribute('aria-label', label)
    button.setAttribute('data-tooltip', label)
    if (runtime.tooltip) runtime.tooltip.update(button)
  }
  runtime.positionFloating = function (node, anchor, alignment, arrowSize) {
    var rect = anchor.getBoundingClientRect()
    // Buttons shrink around their center while pressed. Anchor to their rest
    // bounds so a touch release cannot change the eventual menu gap.
    var scale = parseFloat(getComputedStyle(anchor).scale) || 1
    var width = rect.width / scale
    var height = rect.height / scale
    var leftEdge = rect.left + (rect.width - width) / 2
    var topEdge = rect.top + (rect.height - height) / 2
    // offset sizes exclude the floating layer's entrance translation.
    var floatingWidth = node.offsetWidth
    var floatingHeight = node.offsetHeight
    var margin = 8
    var gap = 8 + (arrowSize || 0)
    var left = alignment === 'end' ? leftEdge + width - floatingWidth : leftEdge
    var below = alignment !== 'center'
    var aboveTop = topEdge - floatingHeight - gap
    var belowTop = topEdge + height + gap
    if (alignment === 'center') {
      left = leftEdge + (width - floatingWidth) / 2
      below = aboveTop < margin
    } else if (belowTop + floatingHeight > window.innerHeight - margin && aboveTop >= margin) below = false
    var top = below ? belowTop : aboveTop
    left = Math.max(margin, Math.min(left, window.innerWidth - floatingWidth - margin))
    top = Math.max(margin, Math.min(top, window.innerHeight - floatingHeight - margin))
    node.style.left = left + 'px'
    node.style.top = top + 'px'
    return { below: below, anchorX: leftEdge + width / 2 - left }
  }
  runtime.removeAfterTransition = function (node) {
    var removeCleanup = runtime.addCleanup(function () { node.remove() })
    runtime.onMotionEnd(node, { property: 'opacity', timeout: 220 }, function () { removeCleanup(); node.remove() })
  }
  runtime.bindFloatingActions = function (selector) {
    var active = null
    function activate(next) {
      if (active === next) return
      if (active) active.classList.remove('is-floating-actions-active')
      active = next
      if (active) active.classList.add('is-floating-actions-active')
    }
    runtime.listen(document, 'click', function (event) {
      activate(event.target.closest ? event.target.closest(selector) : null)
    }, true)
    runtime.addCleanup(function () { activate(null) })
  }
  runtime.adjacentControl = function (trigger, backward, excluded) {
    var controls = Array.prototype.slice.call(document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))
      .filter(function (control) {
        return control.tabIndex >= 0 && !control.disabled && control.getClientRects().length &&
          !control.closest('[hidden], [inert]') && (!excluded || !excluded.contains(control))
      })
    return controls[controls.indexOf(trigger) + (backward ? -1 : 1)]
  }
})
