window.yinyangRuntime.register('not-found-flashlight', function (page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="flashlight"]')) return

  var play = tools.find('.nf-play')
  var status = tools.find('[data-nf-status]')
  var x = 199, y = 123, targetX = x, targetY = y
  var pinned = false
  var frame = 0, last = 0
  var ignoreClickUntil = 0
  function draw() {
    tools.scene.querySelectorAll('.nf-spot').forEach(function (circle) { circle.setAttribute('cx', x); circle.setAttribute('cy', y) })
    var anchor = tools.svg.createSVGPoint()
    anchor.x = x
    anchor.y = y + 65
    var screen = anchor.matrixTransform(tools.svg.getScreenCTM())
    status.style.left = Math.max(16, Math.min(window.innerWidth - 236, screen.x - 110)) + 'px'
    status.style.top = Math.max(16, Math.min(window.innerHeight - 70, screen.y + 8)) + 'px'
  }
  function tick(time) {
    frame = 0
    var delta = last ? Math.min(3, (time - last) / 16.67) : 1
    last = time
    var factor = 1 - Math.pow(.82, delta)
    x += (targetX - x) * factor
    y += (targetY - y) * factor
    draw()
    if (Math.abs(targetX - x) + Math.abs(targetY - y) > .1) request()
  }
  function request() { if (!frame && !document.hidden) frame = page.requestAnimationFrame(tick) }
  function shine(p) {
    if (pinned) return
    targetX = p.x
    targetY = p.y
    request()
  }
  tools.listen(document, 'pointermove', function (event) { shine(tools.point(event)) })
  tools.drag(document, function (p, event) {
    if (event.target.closest('a, button, input, textarea, select')) return false
    shine(p)
  }, shine, function (p, origin, moved) {
    if (moved) ignoreClickUntil = performance.now() + 400
  }, { captureTarget: tools.svg })
  function toggleGhost() {
    pinned = !pinned
    play.setAttribute('aria-pressed', String(pinned))
    if (pinned) { targetX = 206; targetY = 105; tools.emit(206, 103, 9) }
    tools.say(pinned ? '找到一只幽灵，页面还没找到。' : '放开它，继续找一找。')
    request()
  }
  tools.activate(play, function (event) { event.stopPropagation(); toggleGhost() })
  tools.listen(document, 'click', function (event) {
    if (event.defaultPrevented || performance.now() < ignoreClickUntil || event.button !== 0 || play.contains(event.target) || event.target.closest('a, button, input, textarea, select')) return
    toggleGhost()
  })
  tools.listen(play, 'keydown', function (event) {
    var delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key]
    if (!delta) return
    event.preventDefault()
    pinned = false
    play.setAttribute('aria-pressed', 'false')
    shine({ x: targetX + delta[0], y: targetY + delta[1] })
  })
  tools.listen(document, 'visibilitychange', function () {
    page.cancelAnimationFrame(frame); frame = 0; last = 0
    if (!document.hidden) request()
  })
})
