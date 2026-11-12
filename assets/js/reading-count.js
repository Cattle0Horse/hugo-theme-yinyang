window.yinyangRuntime.register('reading-count', function (runtime) {
  var container = document.getElementById('busuanzi_container_page_pv')
  var value = document.getElementById('busuanzi_value_page_pv')
  if (!container || !value) return

  var revealed = false
  var observer
  function reveal() {
    if (revealed || !value.textContent.trim()) return
    revealed = true
    runtime.requestAnimationFrame(function () {
      if (container.isConnected !== false) container.classList.add('is-visible')
    })
    if (observer) observer.disconnect()
  }

  if (window.MutationObserver) {
    observer = new MutationObserver(reveal)
    observer.observe(value, { childList: true, characterData: true, subtree: true })
    runtime.addCleanup(function () { observer.disconnect() })
  }
  reveal()
})
