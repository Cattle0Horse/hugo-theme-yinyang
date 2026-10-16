window.yinyangRuntime.register('code-toolbar', function (runtime) {
  // 围栏代码块的工具栏/折叠结构已由构建期 render-codeblock.html 输出。
  // 这里只做运行时部分：
  //   1) 给构建期 [data-copy-block] 按钮绑定复制
  //   2) 折叠交互（toggle is-folded）与展开高度测量
  //   3) 缩进式代码块（裸 <pre>，非 .highlight）运行时包装浮动复制按钮
  var COPY_ICONS = runtime.config.copyIcons

  function bindCopy(button, codeEl) {
    if (!button || !codeEl || !runtime.bindCopyButton) return
    var text = codeEl.textContent || ''
    if (text.endsWith('\n')) text = text.slice(0, -1)
    runtime.bindCopyButton(button, text, { defaultLabel: '复制代码' })
  }

  function sourceCode(button) {
    var wrapper = button.closest('.code-block-wrapper')
    return wrapper ? wrapper.querySelector('.code-scroll-viewport code') : null
  }

  // 1) 构建期按钮：绑定复制
  var prebuilt = document.querySelectorAll('button[data-copy-block]')
  for (var i = 0; i < prebuilt.length; i++) {
    bindCopy(prebuilt[i], sourceCode(prebuilt[i]))
  }

  // 2) 折叠交互：构建期按 codeMaxLines 决定折叠，CSS 使用相同的行数。
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(runtime.guard(scheduleHeightUpdate))
  }

  // 3) 缩进代码块（裸 pre，非 .highlight）：构建期无法介入，运行时包装浮动复制按钮
  function enhancePlainPre(pre) {
    if (pre.closest('.highlight')) return
    var code = pre.querySelector(':scope > code')
    if (!code) return
    var wrapper = document.createElement('div')
    wrapper.className = 'plain-code-wrapper'
    var copyBtn = document.createElement('button')
    copyBtn.className = 'plain-code-copy code-copy-btn action-button state-button'
    copyBtn.type = 'button'
    copyBtn.setAttribute('aria-label', '复制代码')
    copyBtn.setAttribute('data-tooltip', '复制代码')
    copyBtn.innerHTML = COPY_ICONS
    pre.parentNode.insertBefore(wrapper, pre)
    wrapper.appendChild(pre)
    wrapper.appendChild(copyBtn)
    bindCopy(copyBtn, code)
  }

  document.querySelectorAll('.markdown-body pre').forEach(enhancePlainPre)
})
