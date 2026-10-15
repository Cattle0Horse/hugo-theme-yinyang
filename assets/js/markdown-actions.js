window.yinyangRuntime.register('markdown-actions', function (runtime) {
  function bindOpen(btnId, urlId) {
    var btn = document.getElementById(btnId)
    var url = document.getElementById(urlId)
    if (!btn || !url) return
    var locked = false
    runtime.listen(btn, 'click', function () {
      if (locked) return
      locked = true
      btn.setAttribute('aria-disabled', 'true')
      window.open(url.textContent, '_blank', 'noopener')
      runtime.setTimeout(function () {
        locked = false
        btn.removeAttribute('aria-disabled')
      }, 500)
    })
  }
  bindOpen('edit-page-btn', 'edit-page-url')
  bindOpen('view-raw-btn', 'raw-page-url')

  var raw = document.getElementById('raw-markdown-content')
  var copyBtn = document.getElementById('copy-markdown-btn')
  if (!raw || !copyBtn) return
  var text = JSON.parse(raw.textContent)
  if (runtime.bindCopyButton) runtime.bindCopyButton(copyBtn, text, { defaultLabel: '复制 Markdown' })
})
