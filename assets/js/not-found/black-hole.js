function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="black-hole"]')) return

  var play = tools.find('.nf-play')
  tools.activate(play, function () {
    var swallowed = play.classList.toggle('nf-swallowed')
    play.setAttribute('aria-pressed', String(swallowed))
    if (swallowed) tools.emit(200, 128, 22)
    tools.say(swallowed ? '连 404，也被吸进去了' : '把数字捞回来了')
  })
}
