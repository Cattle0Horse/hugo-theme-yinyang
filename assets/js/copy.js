window.yinyangRuntime.register('copy', function (runtime) {
  function bindCopyButton(button, text, options) {
    if (!button) return
    options = options || {}
    var defaultLabel = options.defaultLabel || button.getAttribute('aria-label') || ''
    var resetTimer = 0
    var feedback = null

    function removeFeedback() {
      var node = feedback
      feedback = null
      button.removeAttribute('data-copy-feedback')
      runtime.unlisten(document, 'scroll', removeFeedback, true)
      runtime.unlisten(window, 'resize', removeFeedback)
      if (!node) return
      node.setAttribute('aria-hidden', 'true')
      node.classList.remove('is-visible')
      runtime.removeAfterTransition(node)
    }

    function showFeedback(label) {
      removeFeedback()
      var node = document.createElement('span')
      node.className = 'copy-feedback'
      node.setAttribute('role', 'status')
      node.setAttribute('aria-live', 'polite')
      node.setAttribute('aria-atomic', 'true')
      document.body.appendChild(node)
      feedback = node
      button.setAttribute('data-copy-feedback', 'true')
      runtime.tooltip.hide(button)
      runtime.requestAnimationFrame(function () {
        if (feedback !== node) return
        node.textContent = label
        runtime.positionFloating(node, button, 'center')
        node.classList.add('is-visible')
      })
      runtime.listen(document, 'scroll', removeFeedback, true)
      runtime.listen(window, 'resize', removeFeedback)
    }

    function fallbackCopy(value) {
      var focus = document.activeElement
      var ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      var ok = false
      try { ok = document.execCommand('copy') } catch (error) {}
      document.body.removeChild(ta)
      if (focus && focus.focus) focus.focus({ preventScroll: true })
      return ok
    }

    function setState(success) {
      button.disabled = false
      var label = success ? (options.successLabel || '已复制') : (options.errorLabel || '复制失败，请手动选择')
      button.dataset.state = success ? 'success' : 'error'
      runtime.label(button, label)
      showFeedback(label)
      runtime.clearTimeout(resetTimer)
      resetTimer = runtime.setTimeout(function () {
        removeFeedback()
        button.dataset.state = ''
        runtime.label(button, defaultLabel)
      }, options.resetDelay || (success ? 2000 : 4000))
    }

    runtime.addCleanup(function () { if (feedback) feedback.remove() })

    runtime.listen(button, 'click', function () {
      if (button.disabled) return
      button.disabled = true
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          navigator.clipboard.writeText(text).then(runtime.guard(function () { setState(true) })).catch(runtime.guard(function () { setState(fallbackCopy(text)) }))
        } catch (error) {
          setState(fallbackCopy(text))
        }
      } else {
        setState(fallbackCopy(text))
      }
    })
  }
  runtime.bindCopyButton = bindCopyButton
  runtime.expose('bindCopyButton', bindCopyButton)
})
