window.yinyangRuntime.register('sidenotes', function (page) {
  var boundary = '[data-sidenote-start], [data-sidenote-end]'
  var blockSelector = 'p, li, blockquote, dt, dd, h1, h2, h3, h4, h5, h6, td, th, figcaption'
  var revealers = new Map()

  page.revealSidenote = function (target) {
    var reveal = revealers.get(target.closest('.sidenote[data-sidenote]'))
    if (reveal) reveal()
  }

  document.querySelectorAll('.sidenote-list').forEach(function (list) {
    var host = list.parentElement
    var notes = new Map(Array.from(list.children, function (note) { return [note.dataset.sidenote, note] }))
    var anchors = new Map()
    var active = new Set()
    var controls = new Map()
    var panels = new Map()
    var linkButtons = []
    var group
    var opened
    var hovered
    var focused
    var wide
    var room = 0
    var frame = 0

    // Collect before editing the tree, so splitting text cannot disturb traversal.
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.nodeType === Node.TEXT_NODE || node.matches(boundary)) return NodeFilter.FILTER_ACCEPT
        if (node === list || node.matches('pre, script, style, textarea, svg, math, .katex, button, [contenteditable]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_SKIP
      }
    })
    var content = []
    for (var node = walker.nextNode(); node; node = walker.nextNode()) content.push(node)

    function blockOf(element) {
      var table = element.closest('table')
      return table ? table.closest('.table-scroll') || table : element.closest(blockSelector) || host
    }

    content.forEach(function (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        var start = node.dataset.sidenoteStart
        if (notes.has(start)) active.add(start)
        else active.delete(node.dataset.sidenoteEnd)
        group = null
        return
      }
      if (!active.size || !node.textContent.trim()) return
      var parent = node.parentElement
      var link = parent.closest('a[href]')
      var block = blockOf(parent)
      if (link) {
        group = null
        var linkGroup = controls.get(link)
        if (!linkGroup) {
          linkGroup = { block: block, ids: new Set() }
          controls.set(link, linkGroup)
        }
        active.forEach(function (id) {
          linkGroup.ids.add(id)
          if (!anchors.has(id)) anchors.set(id, link)
        })
        return
      }

      var firstInGroup = !group || group.block !== block
      if (firstInGroup) group = { block: block, ids: new Set(active) }
      var mark = document.createElement('span')
      mark.className = 'sidenote-mark'
      mark.tabIndex = firstInGroup ? 0 : -1
      mark.setAttribute('role', 'button')
      node.replaceWith(mark)
      mark.appendChild(node)
      controls.set(mark, group)
      active.forEach(function (id) { if (!anchors.has(id)) anchors.set(id, mark) })
    })

    function panelFor(block) {
      var panel = panels.get(block)
      if (panel) return panel
      panel = document.createElement('div')
      panel.className = 'sidenote-inline'
      panel.hidden = true
      if (block === host) host.insertBefore(panel, list)
      else if (block.matches('li, dd, td, th, figcaption')) block.appendChild(panel)
      else block.after(panel)
      panels.set(block, panel)
      return panel
    }

    // Snapshot the controls before adding the narrow-screen link buttons.
    for (var [control, entry] of Array.from(controls)) {
      var panel = panelFor(entry.block)
      if (!control.matches('a')) continue
      var button = document.createElement('button')
      button.type = 'button'
      button.className = 'sidenote-link-toggle'
      button.hidden = true
      button.textContent = (control.textContent.trim() || '链接') + '的旁注'
      panel.before(button)
      controls.set(button, entry)
      linkButtons.push(button)
    }

    function updateHighlights() {
      var marked = new Set()
      ;[opened, hovered, focused].forEach(function (entry) {
        if (entry) entry.ids.forEach(function (id) { marked.add(id) })
      })
      notes.forEach(function (note, id) { note.classList.toggle('sidenote-active', marked.has(id)) })
      controls.forEach(function (entry, control) {
        if (control.matches('a')) return
        var highlighted = false
        for (var id of entry.ids) {
          if (!marked.has(id)) continue
          highlighted = true
          break
        }
        control.classList.toggle('sidenote-active', highlighted)
      })
    }

    function renderSelection() {
      if (list.childElementCount !== notes.size) {
        notes.forEach(function (note) { list.appendChild(note) })
      }
      panels.forEach(function (panel) { panel.hidden = true })
      if (!wide && opened) {
        var panel = panels.get(opened.block)
        notes.forEach(function (note, id) { if (opened.ids.has(id)) panel.appendChild(note) })
        panel.hidden = false
      }
      controls.forEach(function (entry, control) {
        if (control.matches('a')) return
        control.removeAttribute(wide ? 'aria-expanded' : 'aria-pressed')
        control.setAttribute(wide ? 'aria-pressed' : 'aria-expanded', String(opened === entry))
      })
      updateHighlights()
    }

    notes.forEach(function (note, id) {
      revealers.set(note, function () {
        if (wide || !list.contains(note)) return
        var entry = controls.get(anchors.get(id))
        if (entry) {
          opened = entry
          renderSelection()
        }
      })
    })

    function layoutRail() {
      if (!wide) return
      var top = host.getBoundingClientRect().top
      var edge = 0
      notes.forEach(function (note, id) {
        var anchor = anchors.get(id)
        var rect = anchor && anchor.getClientRects()[0]
        var next = Math.max(edge, rect ? rect.top - top : 0)
        note.style.setProperty('--sidenote-top', next + 'px')
        edge = next + note.offsetHeight + 12
      })
      var required = Math.max(0, Math.ceil(edge - 12 - (host.offsetHeight - room)))
      if (required !== room) {
        room = required
        host.style.setProperty('--sidenote-room', room + 'px')
      }
    }

    function scheduleLayout() {
      if (!wide || frame) return
      frame = page.requestAnimationFrame(function () {
        frame = 0
        layoutRail()
      })
    }

    function updateMode() {
      var next = page.scroll.isWide()
      if (wide === next) return
      wide = next
      host.classList.toggle('sidenotes-wide', wide)
      list.hidden = !wide
      linkButtons.forEach(function (button) { button.hidden = wide })
      if (!wide) {
        room = 0
        host.style.removeProperty('--sidenote-room')
      }
      renderSelection()
      layoutRail()
    }

    function targetOf(node) {
      return node instanceof Element && node.closest('.sidenote-mark, .sidenote-link-toggle, a[href]')
    }

    function activate(event) {
      var control = targetOf(event.target)
      var entry = controls.get(control)
      if (!entry || control.matches('a')) return
      if (event.type === 'keydown') {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (control.matches('button')) return
        event.preventDefault()
      }
      opened = opened === entry ? null : entry
      renderSelection()
    }

    function track(event) {
      var control = targetOf(event.target)
      var related = targetOf(event.relatedTarget)
      if (control === related) return
      var entry = controls.get(event.type.endsWith('out') ? related : control)
      if (event.type.startsWith('focus')) focused = entry
      else hovered = entry
      updateHighlights()
    }

    page.listen(host, 'click', activate)
    page.listen(host, 'keydown', activate)
    ;['focusin', 'focusout', 'pointerover', 'pointerout'].forEach(function (event) { page.listen(host, event, track) })
    page.listen(window, 'resize', scheduleLayout)
    page.listen(host, 'animationend', scheduleLayout)
    if (document.fonts) page.listen(document.fonts, 'loadingdone', scheduleLayout)
    page.addCleanup(page.scroll.onModeChange(updateMode))
    if ('ResizeObserver' in window) {
      var observer = new ResizeObserver(page.guard(scheduleLayout))
      observer.observe(host)
      notes.forEach(function (note) { observer.observe(note) })
      page.addCleanup(function () { observer.disconnect() })
    }
    updateMode()
  })
})
