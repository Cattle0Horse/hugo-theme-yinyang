window.yinyangRuntime.register('ui-helpers', function (runtime) {
  runtime.label = function (button, label) {
    if (!button) return
    button.setAttribute('aria-label', label)
    button.setAttribute('data-tooltip', label)
    if (runtime.tooltip) runtime.tooltip.update(button)
  }
  runtime.positionFloating = function (node, anchor, alignment) {
    var rect = anchor.getBoundingClientRect()
    var bounds = node.getBoundingClientRect()
    var left = alignment === 'end' ? rect.right - bounds.width : rect.left
    var top = rect.bottom + 8
    if (alignment === 'center') {
      left = rect.left + (rect.width - bounds.width) / 2
      top = rect.top - bounds.height - 8
      if (top < 8) top = rect.bottom + 8
      top = Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))
    }
    else if (top + bounds.height > window.innerHeight - 8) top = Math.max(8, rect.top - bounds.height - 8)
    node.style.left = Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8)) + 'px'
    node.style.top = top + 'px'
  }
  runtime.removeAfterTransition = function (node) {
    var removeCleanup = runtime.addCleanup(function () { node.remove() })
    runtime.onMotionEnd(node, { property: 'opacity', timeout: 220 }, function () { removeCleanup(); node.remove() })
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
