function mountScene(page, root, name, definition) {
  var scene = root.querySelector('.nf-scene')
  scene.innerHTML = definition.html
  var status = scene.querySelector('[data-nf-status]')
  var svg = scene.querySelector('.nf-drawing-canvas') || scene.querySelector('svg')
  var ignoreClickUntil = 0
  var ignoreClickTarget = null
  var animations = new Set()
  var particles = new Set()
  function say(text) { status.textContent = text }
  function find(selector) { return scene.querySelector(selector) }
  function listen(target, type, handler) { return page.listen(target, type, handler) }
  function point(event) {
    var p = svg.createSVGPoint()
    p.x = event.clientX
    p.y = event.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse())
  }
  function activate(target, callback) {
    listen(target, 'click', function (event) {
      if (performance.now() < ignoreClickUntil && ignoreClickTarget && ignoreClickTarget.contains(event.target)) return
      callback(event)
    })
    if (target.tagName.toLowerCase() !== 'button') {
      listen(target, 'keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        callback(event)
      })
    }
  }
  // Pointer capture keeps a drag attached to its surface, including on touch screens.
  function drag(target, start, move, end, options) {
    var captureTarget = options && options.captureTarget || target
    var pointer = null
    var origin = null
    var moved = false
    var velocity = { x: 0, y: 0 }
    var previous = null
    var previousTime = 0
    listen(target, 'pointerdown', function (event) {
      if (!event.isPrimary || event.button !== 0 || pointer !== null) return
      var p = point(event)
      if (start(p, event) === false) return
      event.preventDefault()
      pointer = event.pointerId
      origin = p
      moved = false
      velocity = { x: 0, y: 0 }
      previous = p
      previousTime = performance.now()
      captureTarget.setPointerCapture(pointer)
    })
    listen(target, 'pointermove', function (event) {
      if (event.pointerId !== pointer) return
      var p = point(event)
      var now = performance.now()
      var elapsed = Math.max(1, now - previousTime)
      velocity = { x: (p.x - previous.x) / elapsed, y: (p.y - previous.y) / elapsed }
      previous = p
      previousTime = now
      if (Math.hypot(p.x - origin.x, p.y - origin.y) > 5) moved = true
      move(p, origin)
    })
    function finish(event) {
      if (event.pointerId !== pointer) return
      var id = pointer
      pointer = null
      if (captureTarget.hasPointerCapture(id)) captureTarget.releasePointerCapture(id)
      if (moved) {
        ignoreClickUntil = performance.now() + 400
        ignoreClickTarget = captureTarget.closest('.nf-reference-play') || captureTarget
      }
      if (performance.now() - previousTime > 100) velocity = { x: 0, y: 0 }
      end(point(event), origin, moved, event.type !== 'pointerup', velocity)
    }
    listen(target, 'pointerup', finish)
    listen(target, 'pointercancel', finish)
    listen(captureTarget, 'lostpointercapture', finish)
    page.addCleanup(function () {
      if (pointer !== null && captureTarget.hasPointerCapture(pointer)) captureTarget.releasePointerCapture(pointer)
    })
  }
  function openArticle(article) {
    var link = document.createElement('a')
    link.href = article.url
    link.hidden = true
    root.appendChild(link)
    link.click()
    link.remove()
  }
  function animate(node, keyframes, options, complete) {
    var animation = node.animate(keyframes, options)
    var timer = 0
    var stopListening = listen(animation, 'finish', finish)
    animations.add(cancel)
    function cancel() {
      if (!animations.delete(cancel)) return
      stopListening()
      page.clearTimeout(timer)
      animation.cancel()
    }
    function finish() {
      if (!animations.has(cancel)) return
      cancel()
      if (complete) complete()
    }
    timer = page.setTimeout(finish, (options.duration || 0) + (options.delay || 0) + 100)
    return cancel
  }
  function emit(x, y, count) {
    for (var i = 0; i < count; i++) {
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', x)
      dot.setAttribute('cy', y)
      dot.setAttribute('r', 1.5 + Math.random() * 2)
      dot.setAttribute('class', 'nf-particle nf-fill-accent')
      dot.style.transformOrigin = x + 'px ' + y + 'px'
      svg.appendChild(dot)
      particles.add(dot)
      var angle = i / count * Math.PI * 2
      var length = 24 + Math.random() * 40
      ;(function (particle, dx, dy) {
        animate(particle, [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.15)', opacity: 0 }],
        { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' }, function () {
          particles.delete(particle)
          particle.remove()
        })
      })(dot, Math.cos(angle) * length, Math.sin(angle) * length - 12)
    }
  }
  // A damped spring runs only while the pointer response is settling.
  function follow(callback, options) {
    var surface = options && options.global ? document : find('.nf-reference-play')
    var state = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
    var frame = 0
    var last = 0
    function tick(time) {
      frame = 0
      var delta = last ? Math.min(2, (time - last) / 16.67) : 1
      last = time
      state.vx = (state.vx + (state.tx - state.x) * .075 * delta) * Math.pow(.74, delta)
      state.vy = (state.vy + (state.ty - state.y) * .075 * delta) * Math.pow(.74, delta)
      state.x += state.vx * delta
      state.y += state.vy * delta
      if (callback) callback(state)
      if (Math.abs(state.tx - state.x) + Math.abs(state.ty - state.y) + Math.abs(state.vx) + Math.abs(state.vy) > .005) request()
    }
    function request() { if (!frame && !document.hidden) frame = page.requestAnimationFrame(tick) }
    listen(surface, 'pointermove', function (event) {
      var p = point(event)
      state.tx = Math.max(-1, Math.min(1, (p.x - 200) / 180))
      state.ty = Math.max(-1, Math.min(1, (p.y - 122) / 110))
      request()
    })
    listen(surface, 'pointerleave', function () { state.tx = state.ty = 0; request() })
    listen(document, 'visibilitychange', function () {
      page.cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (!document.hidden) request()
    })
  }
  page.addCleanup(function () {
    animations.forEach(function (cancel) { cancel() })
    particles.forEach(function (particle) { particle.remove() })
  })
  page.notFound = { scene: scene, svg: svg, articles: definition.articles,
    say: say, find: find, listen: listen, point: point, activate: activate, drag: drag, openArticle: openArticle,
    animate: animate, emit: emit, follow: follow }
  definition.initialize(page)
  root.setAttribute('data-nf-style', name)
  root.querySelector('.nf-fallback').hidden = true
  scene.hidden = false
}
