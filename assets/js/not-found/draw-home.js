function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="draw-home"]')) return
  var say = tools.say
  var find = tools.find
  var activate = tools.activate
  var drag = tools.drag
  var svg = tools.svg
  var path = find('.nf-drawn-path')
  var ball = find('.nf-ball')
  var field = find('.nf-drawing-field')
  var house = find('.nf-draw-home-house')
  var status = find('[data-nf-status]')
  var drawing = false
  var route = []
  var frame = 0
  var homeTimer = 0
  function positionStatus() {
    var point = svg.createSVGPoint()
    point.x = Number(ball.getAttribute('cx'))
    point.y = Number(ball.getAttribute('cy'))
    var screen = point.matrixTransform(svg.getScreenCTM())
    var width = Math.min(220, window.innerWidth - 32)
    status.style.left = Math.max(16, Math.min(window.innerWidth - width - 16, screen.x + 16)) + 'px'
    status.style.top = Math.max(16, Math.min(window.innerHeight - 75, screen.y - 48)) + 'px'
  }
  function notify(text) {
    say(text)
    positionStatus()
  }
  function moveBall(p) { ball.setAttribute('cx', p.x); ball.setAttribute('cy', p.y); positionStatus() }
  function resetRoute() {
    page.cancelAnimationFrame(frame)
    page.clearTimeout(homeTimer)
    drawing = false
    route = []
    path.setAttribute('d', '')
    moveBall({ x: 95, y: 85 })
    field.classList.remove('nf-complete', 'nf-running')
    house.removeAttribute('aria-busy')
    notify('')
  }
  function addPoint(p) {
    if (Math.hypot(p.x - route[route.length - 1].x, p.y - route[route.length - 1].y) < 3) return
    route.push(p)
    path.setAttribute('d', path.getAttribute('d') + 'L' + p.x + ' ' + p.y)
  }
  drag(document, function (p, event) {
    if (event.target.closest('a, button, input, textarea, select')) return false
    resetRoute()
    drawing = true
    route = [p]
    moveBall(p)
    path.setAttribute('d', 'M' + p.x + ' ' + p.y)
  }, function (p) {
    if (!drawing) return
    addPoint(p)
  }, function (p, origin, moved, cancelled) {
    drawing = false
    if (cancelled) resetRoute()
    else if (moved) { addPoint(p); run() }
  }, { captureTarget: svg })
  tools.listen(house, 'click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    resetRoute()
    var line = find('.nf-guide')
    path.setAttribute('d', line.getAttribute('d'))
    var length = line.getTotalLength()
    route = [line.getPointAtLength(0), line.getPointAtLength(length)]
    run()
  })
  activate(ball, resetRoute)
  activate(find('.nf-draw-home-reset'), resetRoute)
  function run() {
    if (route.length < 2) { notify('先画一条路，小球才知道怎么走'); return }
    field.classList.add('nf-running')
    house.setAttribute('aria-busy', 'true')
    field.classList.remove('nf-complete')
    var length = path.getTotalLength()
    var duration = Math.max(900, Math.min(3500, length * 3))
    var began = null
    notify('沿着你画的路，出发啦')
    function tick(time) {
      if (began === null) began = time
      var progress = Math.min(1, (time - began) / duration)
      var p = path.getPointAtLength(length * progress)
      moveBall(p)
      if (progress < 1) frame = page.requestAnimationFrame(tick)
      else {
        var arrived = p.x >= 495 && p.x <= 559 && p.y >= 223 && p.y <= 290
        field.classList.toggle('nf-complete', arrived)
        if (arrived) {
          notify('到家了，正在返回首页')
          homeTimer = page.setTimeout(function () { tools.openArticle({ url: house.getAttribute('href') }) }, 220)
        } else {
          field.classList.remove('nf-running')
          house.removeAttribute('aria-busy')
          notify('还没到家，再画近一些吧')
        }
      }
    }
    frame = page.requestAnimationFrame(tick)
  }
}
