window.yinyangRuntime.register('lists', function (runtime) {
  var styles = new Map([['a', 'lower-alpha'], ['A', 'upper-alpha'], ['i', 'lower-roman'], ['I', 'upper-roman']])
  var lists = document.querySelectorAll('.markdown-body ul, .markdown-body ol')
  if (!lists.length) return
  lists.forEach(function (list) {
    if (!list.hasAttribute('role')) list.setAttribute('role', 'list')
    if (list.tagName === 'OL') {
      list.style.setProperty('--list-counter-style', styles.get(list.getAttribute('type')) || 'decimal')
      Array.from(list.children).forEach(function (item) {
        if (item.tagName === 'LI' && item.hasAttribute('value')) item.style.counterSet = 'list-item ' + item.value
      })
    }
    list.classList.add('prose-list')
  })
  function measure() {
    var widths = Array.from(lists, function (list) {
      var width = 0
      Array.prototype.forEach.call(list.children, function (item) {
        if (item.tagName === 'LI') width = Math.max(width, parseFloat(getComputedStyle(item, '::before').width) || 0)
      })
      return width
    })
    lists.forEach(function (list, index) {
      list.style.setProperty('--list-inset', 'calc(' + widths[index] + 'px + 0.4em)')
    })
  }
  measure()
  var frame = 0
  function schedule() {
    if (!frame) frame = runtime.requestAnimationFrame(function () { frame = 0; measure() })
  }
  runtime.listen(window, 'resize', schedule)
  if (document.fonts) {
    document.fonts.ready.then(runtime.guard(schedule))
    runtime.listen(document.fonts, 'loadingdone', schedule)
  }
})
