window.yinyangRuntime.register('tables', function (runtime) {
  var tables = []
  document.querySelectorAll('.markdown-body table').forEach(function (table) {
    if (table.closest('.highlight')) return
    var wrapper = table.closest('.table-wrapper')
    var region
    var hint
    if (wrapper) {
      region = wrapper.querySelector('.table-scroll')
      hint = wrapper.querySelector('.table-scroll-hint')
    } else {
      // Raw HTML tables do not pass through the Markdown render hook.
      wrapper = document.createElement('div')
      region = document.createElement('div')
      hint = document.createElement('p')
      wrapper.className = 'table-wrapper'
      region.className = 'table-scroll'
      hint.className = 'table-scroll-hint'
      hint.textContent = '左右滑动查看完整表格'
      table.parentNode.insertBefore(wrapper, table)
      wrapper.append(region, hint)
      region.appendChild(table)
    }
    tables.push({ region: region, hint: hint })
  })

  function updateTables() {
    tables.forEach(function (item) {
      var overflow = item.region.scrollWidth > item.region.clientWidth + 1
      item.hint.hidden = !overflow
      if (overflow) {
        item.region.setAttribute('tabindex', '0')
        item.region.setAttribute('role', 'region')
        item.region.setAttribute('aria-label', '表格，可横向滚动查看完整内容')
      } else {
        item.region.removeAttribute('tabindex')
        item.region.removeAttribute('role')
        item.region.removeAttribute('aria-label')
      }
    })
  }
  updateTables()
  runtime.listen(window, 'resize', updateTables)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(runtime.guard(updateTables))

})
