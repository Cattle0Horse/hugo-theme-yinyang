window.yinyangRuntime.register('code-toolbar', function (runtime) {
  // 围栏的工具栏和源码行在构建期生成；缩进代码在此增强。
  // 显示开关只作用于当前代码块，复制始终读取不含行号的源码。

  function bindCopy(button, codeEl) {
    if (!button || !codeEl || !runtime.bindCopyButton) return
    var source = codeEl.cloneNode(true)
    source.querySelectorAll('.ln, .lnt').forEach(function (number) { number.remove() })
    var text = source.textContent || ''
    if (text.endsWith('\n')) text = text.slice(0, -1)
    runtime.bindCopyButton(button, text, { defaultLabel: '复制代码' })
  }

  // 构建期按 codeMaxLines 决定折叠，CSS 使用相同的行数。
  var foldInstances = []

  function updateExpandedHeight(instance) {
    var renderedHeight = instance.hl.scrollHeight
    var scrollbarGutter = Math.max(0, instance.viewport.offsetHeight - instance.viewport.clientHeight)
    var expandedHeight = Math.ceil(renderedHeight + scrollbarGutter + 1)
    instance.viewport.style.setProperty('--code-height', expandedHeight + 'px')
  }

  var codeBodies = document.querySelectorAll('.code-block-body')
  codeBodies.forEach(function (body) {
    var viewport = body.querySelector('.code-scroll-viewport')
    var expandBar = body.querySelector('.code-expand-bar')
    if (!viewport || !expandBar) return
    var hl = viewport.querySelector('.highlight')
    if (!hl) return
    var lineCount = parseInt(expandBar.getAttribute('data-lines'), 10) || 0
    var expandText = expandBar.querySelector('.expand-text')

    var instance = { body: body, viewport: viewport, hl: hl, update: updateExpand }
    foldInstances.push(instance)
    updateExpandedHeight(instance)

    function updateExpand() {
      var folded = body.classList.contains('is-folded')
      expandBar.setAttribute('aria-expanded', String(!folded))
      runtime.label(expandBar, folded ? '展开全部代码' : '收起代码')
      if (expandText) expandText.textContent = folded ? '展开全部 (' + lineCount + ' 行)' : '收起'
    }
    runtime.listen(expandBar, 'click', function () {
      if (!body.classList.contains('is-folded')) {
        var wrapper = body.closest('.code-block-wrapper')
        if (wrapper.getBoundingClientRect().top < runtime.scroll.viewport().top) {
          runtime.scroll.scrollToElement(wrapper, { offset: 24, behavior: 'instant' })
        }
      }
      body.classList.toggle('is-folded')
      updateExpand()
    })
    updateExpand()
  })

  var foldableBodies = new Set(foldInstances.map(function (instance) { return instance.body }))
  runtime.code = {
    restoreFolds: function (folds) {
      Array.prototype.forEach.call(codeBodies, function (body, index) {
        if (!foldableBodies.has(body)) body.classList.remove('is-folded')
        else if (typeof folds[index] === 'boolean') body.classList.toggle('is-folded', folds[index])
      })
      foldInstances.forEach(function (instance) { instance.update() })
    }
  }

  if (foldInstances.length) {
    var heightUpdateFrame = 0

    function scheduleHeightUpdate() {
      if (heightUpdateFrame) return
      heightUpdateFrame = runtime.requestAnimationFrame(function () {
        heightUpdateFrame = 0
        foldInstances.forEach(updateExpandedHeight)
      })
    }

    runtime.listen(window, 'resize', scheduleHeightUpdate)
    if (window.ResizeObserver) {
      var observer = new window.ResizeObserver(scheduleHeightUpdate)
      foldInstances.forEach(function (instance) { observer.observe(instance.hl) })
      runtime.addCleanup(function () { observer.disconnect() })
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(runtime.guard(scheduleHeightUpdate))
  }

  // 缩进代码块：使用 textContent 保留原文，逐行添加非源码行号。
  function enhancePlainPre(pre) {
    if (pre.closest('.highlight, .code-block-wrapper')) return
    var code = pre.querySelector(':scope > code')
    if (!code) return
    var wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper no-toolbar'
    var defaults = runtime.config.codeBlock || {}
    wrapper.dataset.lineNumbers = String(!!defaults.lineNumbers)
    wrapper.dataset.wrap = String(!!defaults.wrap)
    var controls = document.createElement('template')
    controls.innerHTML = runtime.config.codeControls
    var viewport = document.createElement('div')
    viewport.className = 'code-scroll-viewport'
    var text = code.textContent.replace(/\n$/, '')
    code.textContent = ''
    text.split('\n').forEach(function (text, index) {
      var line = document.createElement('span')
      line.className = 'line'
      var number = document.createElement('span')
      number.className = 'ln'
      number.textContent = String(index + 1)
      var content = document.createElement('span')
      content.className = 'cl'
      content.textContent = text + '\n'
      line.appendChild(number)
      line.appendChild(content)
      code.appendChild(line)
    })
    pre.classList.add('chroma')
    pre.parentNode.insertBefore(wrapper, pre)
    wrapper.appendChild(controls.content)
    wrapper.appendChild(viewport)
    viewport.appendChild(pre)
  }

  document.querySelectorAll('.markdown-body pre').forEach(enhancePlainPre)

  var wrappers = document.querySelectorAll('.code-block-wrapper')
  var activeWrapper = null
  function activate(wrapper) {
    if (activeWrapper === wrapper) return
    if (activeWrapper) activeWrapper.classList.remove('is-code-active')
    activeWrapper = wrapper
    if (activeWrapper) activeWrapper.classList.add('is-code-active')
  }
  if (wrappers.length) {
    runtime.listen(document, 'click', function (event) {
      activate(event.target.closest ? event.target.closest('.code-block-wrapper') : null)
    }, true)
    runtime.addCleanup(function () { activate(null) })
  }

  wrappers.forEach(function (wrapper) {
    var viewport = wrapper.querySelector('.code-scroll-viewport')
    var motion = null
    var motionTimer = 0
    function clearMotion() {
      runtime.clearTimeout(motionTimer)
      if (motion) motion.cancel()
      motion = null
      wrapper.classList.remove('code-layout-changing')
    }
    runtime.addCleanup(clearMotion)
    var numbers = wrapper.querySelectorAll('.ln')
    var digits = 1
    numbers.forEach(function (number) {
      digits = Math.max(digits, number.textContent.trim().length)
      number.setAttribute('aria-hidden', 'true')
    })
    wrapper.style.setProperty('--code-number-width', (digits + 2) + 'ch')
    wrapper.querySelectorAll('[data-code-toggle]').forEach(function (button) {
      var key = button.dataset.codeToggle === 'numbers' ? 'lineNumbers' : 'wrap'
      function sync() {
        var enabled = wrapper.dataset[key] === 'true'
        button.setAttribute('aria-pressed', String(enabled))
        var label
        if (key === 'lineNumbers') label = enabled ? '隐藏行号' : '显示行号'
        else label = enabled ? '关闭自动换行' : '开启自动换行'
        runtime.label(button, label)
      }
      sync()
      runtime.listen(button, 'click', function () {
        var previousHeight = viewport.getBoundingClientRect().height
        clearMotion()
        var animate = key === 'wrap' && viewport.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (animate) wrapper.classList.add('code-layout-changing')
        wrapper.dataset[key] = String(wrapper.dataset[key] !== 'true')
        if (key === 'wrap' && wrapper.dataset.wrap === 'true') viewport.scrollLeft = 0
        foldInstances.forEach(updateExpandedHeight)
        sync()
        if (animate) {
          var nextHeight = viewport.getBoundingClientRect().height
          var options = { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)' }
          try {
            motion = viewport.animate([
              { height: previousHeight + 'px', maxHeight: previousHeight + 'px' },
              { height: nextHeight + 'px', maxHeight: nextHeight + 'px' }
            ], options)
            motion.onfinish = runtime.guard(clearMotion)
            motionTimer = runtime.setTimeout(clearMotion, 280)
          } catch (error) { clearMotion() }
        }
      })
    })
    wrapper.querySelectorAll('button[data-copy-block]').forEach(function (button) {
      bindCopy(button, viewport.querySelector('code'))
    })
  })
})
