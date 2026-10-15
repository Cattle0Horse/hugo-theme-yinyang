window.yinyangRuntime.register('not-found-cat', function (page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="cat"]')) return

  var zero = tools.find('.nf-cat-zero')
  var play = tools.find('.nf-play')
  var paw = tools.find('.nf-cat-paw')
  var moved = false
  var cancelRoll = null
  var base
  function pose() {
    var matrix = new DOMMatrix(getComputedStyle(zero).transform)
    return { x: matrix.e, y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI }
  }
  function transform(p) { return 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + p.angle + 'deg)' }
  function roll(on, velocity) {
    var from = pose()
    if (cancelRoll) cancelRoll()
    moved = on
    play.classList.toggle('nf-pushed', on)
    play.setAttribute('aria-pressed', String(on))
    var to = { x: on ? 88 : 0, y: on ? 50 : 0, angle: on ? 34 : 0 }
    zero.style.transform = transform(to)
    cancelRoll = tools.animate(zero, [
      { transform: transform(from) },
      { transform: 'translate(' + (to.x + velocity * 12) + 'px,' + (to.y - 14) + 'px) rotate(' + (on ? 40 : -8) + 'deg)', offset: .65 },
      { transform: transform(to) }
    ], { duration: 900, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'both' })
    tools.animate(paw, [{ translate: '0 0' }, { translate: '-14px 13px', offset: .35 }, { translate: '0 0' }], { duration: 520, easing: 'ease-out' })
    if (on) tools.emit(259, 148, 8)
    tools.say(on ? '它推了，还装作没看见。' : '把零悄悄放回来了。')
  }
  tools.activate(play, function () { roll(!moved, 0) })
  tools.drag(zero, function () {
    base = pose()
    if (cancelRoll) cancelRoll()
    zero.style.transform = transform(base)
    play.classList.add('nf-dragging')
  }, function (p, origin) {
    zero.style.transform = transform({ x: base.x + p.x - origin.x, y: base.y + (p.y - origin.y) * .5, angle: base.angle + (p.x - origin.x) * .6 })
  }, function (p, origin, dragged, cancelled, velocity) {
    play.classList.remove('nf-dragging')
    if (cancelled) { roll(moved, 0); return }
    if (!dragged) return
    roll(base.x + p.x - origin.x + velocity.x * 80 > 15, velocity.x)
  })
})
