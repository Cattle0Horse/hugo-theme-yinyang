window.yinyangRuntime.register('not-found-sleep', function (page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="sleep"]')) return

  var play = tools.find('.nf-play')
  var face = tools.find('.nf-sleep-face')
  var home = tools.find('.nf-sleep-home')
  var eyes = tools.find('.nf-eye-open')
  var dreams = tools.find('.nf-dreams')
  var timer = 0
  var cancelWake = null
  var cancelClose = null
  var cancelDreams = null
  var falling = false
  var afterSleep = null
  var leaving = false
  var motionOrigin = null
  var lastPointer = null
  var motionStarted = 0
  play.classList.add('nf-asleep')
  function wake() {
    if (leaving) return
    var changed = !play.classList.contains('nf-awake') || falling
    page.clearTimeout(timer)
    if (cancelClose) cancelClose()
    if (cancelDreams) cancelDreams()
    cancelClose = cancelDreams = null
    falling = false
    afterSleep = null
    play.classList.remove('nf-falling-asleep', 'nf-asleep')
    play.classList.add('nf-awake')
    play.setAttribute('aria-pressed', 'true')
    if (changed) tools.say('嗯？有人在找我吗？')
  }
  function nap() {
    if (leaving || falling || !play.classList.contains('nf-awake')) return
    page.clearTimeout(timer)
    timer = page.setTimeout(fallAsleep, 1800)
  }
  function finishSleep() {
    cancelDreams = null
    falling = false
    play.classList.remove('nf-falling-asleep')
    tools.say('呼……睡着了')
    var done = afterSleep
    afterSleep = null
    if (done) done()
  }
  function showDreams() {
    cancelClose = null
    play.classList.remove('nf-awake')
    play.classList.add('nf-asleep')
    play.setAttribute('aria-pressed', 'false')
    cancelDreams = tools.animate(dreams, [{ opacity: 0 }, { opacity: 1 }],
      { duration: 600, easing: 'ease-out', fill: 'both' }, finishSleep)
  }
  function fallAsleep(complete) {
    if (complete) afterSleep = complete
    if (falling) return
    falling = true
    motionOrigin = lastPointer
    motionStarted = performance.now()
    tools.say(leaving ? '嘘，慢慢睡着吧' : '困了，慢慢闭上眼睛')
    var from = getComputedStyle(eyes).scale
    play.classList.add('nf-falling-asleep')
    if (play.classList.contains('nf-awake')) {
      cancelClose = tools.animate(eyes, [{ scale: from }, { scale: '1 .05' }],
        { duration: 420, easing: 'ease-in-out', fill: 'both' }, showDreams)
    } else showDreams()
  }
  tools.listen(document, 'pointermove', function (event) {
    var point = { x: event.clientX, y: event.clientY }
    var now = performance.now()
    if (leaving) { lastPointer = point; return }
    if (play.classList.contains('nf-awake') && !falling) {
      page.clearTimeout(timer)
      motionOrigin = point
      motionStarted = now
    } else {
      if (!motionOrigin || now - motionStarted > 700) {
        motionOrigin = lastPointer || point
        motionStarted = now
      }
      if (Math.hypot(point.x - motionOrigin.x, point.y - motionOrigin.y) >= 36) {
        wake()
        motionOrigin = point
        motionStarted = now
      }
    }
    lastPointer = point
  })
  tools.listen(document, 'pointerleave', nap)
  tools.listen(play, 'focus', wake)
  tools.listen(play, 'blur', nap)
  tools.activate(play, function () {
    if (leaving) return
    wake()
    var from = getComputedStyle(face).transform
    if (cancelWake) cancelWake()
    cancelWake = tools.animate(face, [
      { transform: from },
      { transform: 'translateY(8px) scale(1.08,.9)', offset: .2 },
      { transform: 'translateY(-12px) scale(.95,1.06)', offset: .5 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 800, easing: 'cubic-bezier(.2,.8,.2,1)' })
    tools.emit(200, 106, 9)
    tools.say('醒了醒了……你找哪一页？')
    if (window.matchMedia('(hover: none)').matches) nap()
  })
  tools.follow(function (state) {
    if (leaving) return
    tools.scene.querySelectorAll('.nf-pupil').forEach(function (pupil) {
      pupil.style.transform = 'translate(' + state.x * 7 + 'px,' + state.y * 7 + 'px)'
    })
  }, { global: true })
  tools.listen(home, 'click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (leaving) return
    leaving = true
    home.setAttribute('aria-disabled', 'true')
    page.clearTimeout(timer)
    fallAsleep(function () { tools.openArticle({ url: home.getAttribute('href') }) })
  })
})
