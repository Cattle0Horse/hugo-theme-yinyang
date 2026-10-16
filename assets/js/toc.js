window.yinyangRuntime.register('toc', function (runtime) {
  'use strict'
  var sidebar = document.getElementById('tocSidebar')
  var floatBtn = document.getElementById('tocFloatBtn')
  var backdrop = document.getElementById('tocBackdrop')
  var tocScroll = document.getElementById('tocScroll')
  var tocNav = sidebar && sidebar.querySelector('.toc-nav')
  var appScroll = document.getElementById('appScroll')
  var background = document.querySelector('.app-content')
  var backgroundState = null
  if (!sidebar || !tocNav || !appScroll) return

  var links = Array.prototype.slice.call(tocNav.querySelectorAll('a[href^="#"]'))
  function setEntranceDelays(viewport) {
    var index = 0
    var last = null
    links.forEach(function (link) {
      var bounds = viewport && link.getBoundingClientRect()
      if (bounds && (bounds.bottom <= viewport.top || bounds.top >= viewport.bottom)) return
      link.style.setProperty('--toc-enter-delay', Math.min(index++ * 35, 240) + 'ms')
      last = link
    })
    return last
  }
  var cancelEntrance = null
  function finishEntrance() {
    sidebar.classList.remove('toc-entering')
    if (cancelEntrance) cancelEntrance()
    cancelEntrance = null
  }
  runtime.addCleanup(finishEntrance)
  ;['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach(function (type) {
    runtime.listen(sidebar, type, finishEntrance, { capture: true, passive: true })
  })

  // Modality: focus containment, background isolation, and responsive state.
  function focusable() {
    return sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  }

  function setNavTabbable(enabled) {
    links.forEach(function (link) {
      if (enabled) link.removeAttribute('tabindex')
      else link.setAttribute('tabindex', '-1')
    })
  }

  function openToc() {
    if (runtime.scroll.isWide() || sidebar.classList.contains('toc-open')) return
    backgroundState = { reading: runtime.scroll.capture(), inert: background.inert }
    background.inert = true
    document.documentElement.classList.add('toc-open')
    sidebar.classList.add('toc-open')
    sidebar.setAttribute('aria-hidden', 'false')
    sidebar.setAttribute('role', 'dialog')
    sidebar.setAttribute('aria-modal', 'true')
    sidebar.inert = false
    setNavTabbable(true)
    floatBtn.setAttribute('aria-expanded', 'true')
    floatBtn.setAttribute('aria-label', '关闭目录')
    backdrop.classList.add('toc-open')
    sidebar.focus({ preventScroll: true })
    var active = tocNav.querySelector('.toc-active')
    if (active) tocScroll.scrollTo({
      top: tocScroll.scrollTop + active.getBoundingClientRect().top - tocScroll.getBoundingClientRect().top - 8,
      behavior: 'instant'
    })
    finishEntrance()
    var last = setEntranceDelays(tocScroll.getBoundingClientRect())
    sidebar.classList.add('toc-entering')
    if (last) cancelEntrance = runtime.onMotionEnd(last, {
      type: 'animationend', animation: 'toc-item-enter', timeout: 780
    }, finishEntrance)
  }

  function unlockBackground() {
    document.documentElement.classList.remove('toc-open')
    if (!backgroundState) return
    background.inert = backgroundState.inert
    runtime.scroll.restore(backgroundState.reading)
    backgroundState = null
  }

  runtime.addCleanup(unlockBackground)

  function closeToc(returnFocus) {
    if (runtime.scroll.isWide()) return
    finishEntrance()
    sidebar.classList.remove('toc-open')
    unlockBackground()
    sidebar.setAttribute('aria-hidden', 'true')
    sidebar.inert = true
    sidebar.removeAttribute('role')
    sidebar.removeAttribute('aria-modal')
    setNavTabbable(false)
    floatBtn.setAttribute('aria-expanded', 'false')
    floatBtn.setAttribute('aria-label', '打开目录')
    backdrop.classList.remove('toc-open')
    if (returnFocus !== false) floatBtn.focus({ preventScroll: true })
  }

  runtime.listen(floatBtn, 'click', function () {
    if (sidebar.classList.contains('toc-open')) {
      closeToc(false)
    } else {
      openToc()
    }
  })
  runtime.listen(backdrop, 'click', function () { closeToc(true) })
  runtime.listen(sidebar.querySelector('.toc-close'), 'click', function () { closeToc(true) })
  runtime.listen(document, 'keydown', function (event) {
    if (!sidebar.classList.contains('toc-open')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeToc(true)
      return
    }
    if (event.key !== 'Tab') return
    var items = focusable()
    if (!items.length) {
      event.preventDefault()
      sidebar.focus({ preventScroll: true })
      return
    }
    var first = items[0]
    var last = items[items.length - 1]
    if (document.activeElement === sidebar || !sidebar.contains(document.activeElement)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })

  function syncMode() {
    finishEntrance()
    setEntranceDelays()
    if (runtime.scroll.isWide()) {
      sidebar.classList.remove('toc-open')
      unlockBackground()
      sidebar.inert = false
      sidebar.removeAttribute('role')
      sidebar.removeAttribute('aria-modal')
      sidebar.setAttribute('aria-hidden', 'false')
      backdrop.classList.remove('toc-open')
      floatBtn.setAttribute('aria-expanded', 'false')
      floatBtn.setAttribute('aria-label', '打开目录')
      floatBtn.removeAttribute('aria-disabled')
      setNavTabbable(true)
    } else {
      var open = sidebar.classList.contains('toc-open')
      if (!open && sidebar.contains(document.activeElement)) floatBtn.focus({ preventScroll: true })
      sidebar.setAttribute('aria-hidden', open ? 'false' : 'true')
      sidebar.inert = !open
      setNavTabbable(open)
    }
  }
  runtime.addCleanup(runtime.scroll.onModeChange(syncMode))
  syncMode()

  // Scrollspy and heading feedback.
  function decodeHash(hash) {
    try {
      return decodeURIComponent(hash)
    } catch (error) {
      return hash
    }
  }

  function headingOffset() {
    var header = document.getElementById('appHeader')
    if (!header || getComputedStyle(header).position !== 'sticky') return 64
    return header.getBoundingClientRect().height + 16
  }

  var entries = []
  links.forEach(function (link) {
    var id = decodeHash(link.getAttribute('href').slice(1))
    var heading = document.getElementById(id)
    if (!heading) return
    entries.push({ link: link, heading: heading })
  })

  var indicator = document.getElementById('tocIndicator')
  var highlightedHeading = null
  var cancelHighlight = null
  function clearHeadingHighlight() {
    if (cancelHighlight) cancelHighlight()
    cancelHighlight = null
    if (highlightedHeading) highlightedHeading.classList.remove('toc-target')
    highlightedHeading = null
  }
  function highlightHeading(target) {
    clearHeadingHighlight()
    highlightedHeading = target
    target.offsetWidth
    target.classList.add('toc-target')
    cancelHighlight = runtime.onMotionEnd(target, { type: 'animationend', animation: 'toc-target-fade', timeout: 2400 }, clearHeadingHighlight)
  }
  runtime.addCleanup(clearHeadingHighlight)
  function updateActive() {
    if (!entries.length) return
    var viewport = runtime.scroll.viewport()
    var viewportTop = viewport.top
    var viewportBottom = viewport.bottom
    var wide = runtime.scroll.isWide()
    var positions = entries.map(function (entry) { return entry.heading.getBoundingClientRect().top })
    var current = entries[0]
    var currentLine = viewportTop + headingOffset() + 2
    positions.forEach(function (top, index) {
      if (top <= currentLine) current = entries[index]
    })
    if (!wide) {
      var scroller = runtime.scroll.element()
      var scrollEnd = scroller.scrollHeight - scroller.clientHeight
      if (runtime.scroll.position().top >= scrollEnd - 2) current = entries[entries.length - 1]
    }
    var visible = []
    entries.forEach(function (entry, index) {
      var active = entry === current
      if (wide) {
        var end = positions[index + 1]
        if (index === positions.length - 1) {
          end = document.documentElement.scrollHeight - runtime.scroll.position().top + viewportTop
        }
        active = end > viewportTop && positions[index] < viewportBottom
      }
      entry.link.classList.toggle('toc-active', active)
      if (entry === current) entry.link.setAttribute('aria-current', 'location')
      else entry.link.removeAttribute('aria-current')
      if (active) visible.push(entry.link)
    })
    if (!visible.length || !wide) {
      indicator.classList.remove('is-visible')
      return
    }
    var navRect = tocNav.getBoundingClientRect()
    var first = visible[0].getBoundingClientRect()
    var last = visible[visible.length - 1].getBoundingClientRect()
    indicator.style.top = (first.top - navRect.top) + 'px'
    indicator.style.bottom = (navRect.bottom - last.bottom) + 'px'
    indicator.classList.add('is-visible')

    var scrollRect = tocScroll.getBoundingClientRect()
    var margin = 8
    var adjust = 0
    if (first.top < scrollRect.top + margin) {
      adjust = first.top - scrollRect.top - margin
    } else if (last.bottom > scrollRect.bottom - margin) {
      adjust = last.bottom - scrollRect.bottom + margin
    }
    if (adjust) {
      tocScroll.scrollBy({ top: adjust })
    }
  }

  runtime.listen(tocNav, 'click', function (event) {
    var link = event.target.closest('a[href^="#"]')
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    var target = document.getElementById(decodeHash(link.getAttribute('href').slice(1)))
    if (!target) return
    event.preventDefault()
    if (!runtime.scroll.isWide()) closeToc(true)
    runtime.requestAnimationFrame(function () {
      runtime.scroll.scrollToElement(target, { offset: headingOffset() })
      highlightHeading(target)
    })
    runtime.pushHash(link.getAttribute('href'))
  })

  runtime.addCleanup(runtime.scroll.onChange(updateActive))
  runtime.listen(window, 'resize', updateActive)
  updateActive()
})
