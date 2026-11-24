window.yinyangRuntime.register('tables', function (runtime) {
  var tables = []

  function cellText(cell) {
    return String(cell.textContent || '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
  }

  function cellAlignment(cell) {
    var style = cell.getAttribute && cell.getAttribute('style') || ''
    var match = style.match(/text-align\s*:\s*(left|center|right)/i)
    return match ? match[1].toLowerCase() : ''
  }

  function alignmentMarker(cell) {
    var alignment = cellAlignment(cell)
    if (alignment === 'left') return ':---'
    if (alignment === 'center') return ':---:'
    if (alignment === 'right') return '---:'
    return '---'
  }

  function serializeTable(table) {
    var rows = Array.prototype.slice.call(table.rows)
    if (!rows.length) return ''
    var header = rows.shift()
    var headerCells = Array.prototype.map.call(header.cells, cellText)
    var lines = [
      '| ' + headerCells.join(' | ') + ' |',
      '| ' + Array.prototype.map.call(header.cells, alignmentMarker).join(' | ') + ' |'
    ]
    rows.forEach(function (row) {
      lines.push('| ' + Array.prototype.map.call(row.cells, cellText).join(' | ') + ' |')
    })
    return lines.join('\n')
  }

  function addTableTools(wrapper, table) {
    var tools = table.querySelector('.table-tools')
    if (!tools) {
      tools = document.createElement('caption')
      tools.className = 'table-tools'
      table.insertBefore(tools, table.firstChild)
    }
    var button = tools.querySelector('[data-copy-table]')
    if (!button) {
      button = document.createElement('button')
      button.className = 'table-copy-btn copy-button action-button state-button'
      button.type = 'button'
      button.setAttribute('aria-label', '复制表格')
      button.setAttribute('data-tooltip', '复制表格')
      button.setAttribute('data-copy-table', '')
      button.innerHTML = runtime.config && runtime.config.copyIcons || ''
      tools.appendChild(button)
    }
    if (button.dataset.tableCopyBound === 'true') return
    button.dataset.tableCopyBound = 'true'
    if (runtime.bindCopyButton) runtime.bindCopyButton(button, serializeTable(table), { defaultLabel: '复制表格' })
  }

  document.querySelectorAll('.markdown-body table').forEach(function (table) {
    if (table.closest('.highlight')) return
    var wrapper = table.closest('.table-wrapper')
    var region = wrapper && wrapper.querySelector('.table-scroll')
    var hint = wrapper && wrapper.querySelector('.table-scroll-hint')
    if (!wrapper) {
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
    addTableTools(wrapper, table)
    tables.push({ region: region, hint: hint })
  })

  if (tables.length) runtime.bindFloatingActions('.table-scroll')

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
