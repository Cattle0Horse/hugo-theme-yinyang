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
    return { x: matrix.e, y: matrix.f }
  }
  function place(on) {
    var from = getComputedStyle(piece).transform
    if (cancelSnap) cancelSnap()
    solved = on
    play.classList.toggle('nf-complete', on)
    play.classList.remove('nf-near-slot')
    play.setAttribute('aria-pressed', String(on))
    piece.style.transform = 'translate(' + (on ? -61 : 0) + 'px,' + (on ? -87 : 0) + 'px)'
    cancelSnap = tools.animate(piece, [{ transform: from },
      { transform: 'translate(' + (on ? -64 : 2) + 'px,' + (on ? -91 : -5) + 'px)', offset: .7 },
      { transform: piece.style.transform }], { duration: 700, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'both' })
    if (on) {
      tools.emit(200, 102, 18)
      tools.animate(play, [{ scale: '1' }, { scale: '1.035 .965', offset: .25 }, { scale: '.985 1.02', offset: .6 }, { scale: '1' }], { duration: 650, easing: 'ease-out' })
    }
    tools.say(on ? '拼好了，还是 404' : '就差这最后一块')
  }
  tools.drag(piece, function () {
    base = pose()
    if (cancelSnap) cancelSnap()
    piece.style.transform = 'translate(' + base.x + 'px,' + base.y + 'px)'
    play.classList.add('nf-dragging')
  }, function (p, origin) {
    var x = base.x + p.x - origin.x, y = base.y + p.y - origin.y
    piece.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + Math.max(-8, Math.min(8, (p.x - origin.x) / 15)) + 'deg)'
    play.classList.toggle('nf-near-slot', Math.hypot(x + 61, y + 87) < 48)
  }, function (p, origin, moved, cancelled) {
    play.classList.remove('nf-dragging')
    if (!moved && !cancelled) return
    place(cancelled ? solved : Math.hypot(base.x + p.x - origin.x + 61, base.y + p.y - origin.y + 87) < 55)
  })
  tools.activate(play, function () { place(!solved) })
}
