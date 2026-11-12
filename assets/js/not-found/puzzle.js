function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="puzzle"]')) return

  var piece = tools.find('.nf-piece')
  var play = tools.find('.nf-play')
  var solved = false
  var cancelSnap = null
  var base
  function pose() {
    var matrix = new DOMMatrix(getComputedStyle(piece).transform)
    return { x: matrix.e, y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI }
  }
  function writePose(value) {
    piece.style.transform = 'translate(' + value.x + 'px,' + value.y + 'px) rotate(' + value.angle + 'deg)'
  }
  function place(on, releaseVelocity) {
    if (cancelSnap) cancelSnap()
    solved = on
    play.classList.toggle('nf-complete', on)
    play.classList.remove('nf-near-slot')
    play.setAttribute('aria-pressed', String(on))
    var target = { x: on ? -61 : 0, y: on ? -87 : 0, angle: 0 }
    var speed = releaseVelocity || { x: 0, y: 0 }
    cancelSnap = tools.springTo(pose, writePose, target, {
      stiffness: on ? .18 : .22,
      damping: on ? .6 : .64,
      velocity: { x: (speed.x || 0) * 16.67, y: (speed.y || 0) * 16.67, angle: 0 },
      threshold: .12,
      speedThreshold: .02
    }, function () { cancelSnap = null })
    if (on) {
      tools.emit(200, 102, 18)
      tools.animate(play, [{ scale: '1' }, { scale: '1.035 .965', offset: .25 }, { scale: '.985 1.02', offset: .6 }, { scale: '1' }], { duration: 650, easing: 'ease-out' })
    }
    tools.say(on ? '拼好了，还是 404' : '就差这最后一块')
  }
  tools.drag(piece, function () {
    base = pose()
    if (cancelSnap) cancelSnap()
    writePose(base)
    play.classList.add('nf-dragging')
  }, function (p, origin) {
    var x = base.x + p.x - origin.x, y = base.y + p.y - origin.y
    piece.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + Math.max(-8, Math.min(8, (p.x - origin.x) / 15)) + 'deg)'
    play.classList.toggle('nf-near-slot', Math.hypot(x + 61, y + 87) < 48)
  }, function (p, origin, moved, cancelled, releaseVelocity) {
    play.classList.remove('nf-dragging')
    if (!moved && !cancelled) return
    place(cancelled ? solved : Math.hypot(base.x + p.x - origin.x + 61, base.y + p.y - origin.y + 87) < 55, releaseVelocity)
  })
  tools.activate(play, function () { place(!solved) })
}
