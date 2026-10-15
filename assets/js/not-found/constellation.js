window.yinyangRuntime.register('not-found-constellation', function (page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="constellation"]')) return

  var play = tools.find('.nf-play')
  var stars = Array.from(tools.scene.querySelectorAll('.nf-star'))
  var visited = new Set()
  var trail = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  trail.setAttribute('class', 'nf-star-trail')
  tools.svg.prepend(trail)
  var complete = false
  stars.forEach(function (star, index) {
    star.style.setProperty('--delay', -index * .37 + 's')
    star.style.setProperty('--twinkle', 2 + index % 4 * .6 + 's')
  })
  function reveal() {
    complete = true
    play.classList.add('nf-complete')
    play.setAttribute('aria-pressed', 'true')
    tools.emit(200, 120, 18)
    tools.say('找到啦，是一座 404 星座。')
  }
  tools.listen(play, 'pointermove', function (event) {
    if (complete) return
    var p = tools.point(event)
    var star = stars.find(function (node) { return !visited.has(node) && Math.hypot(p.x - Number(node.getAttribute('cx')), p.y - Number(node.getAttribute('cy'))) < 18 })
    if (!star) return
    visited.add(star)
    star.classList.add('nf-visited')
    trail.setAttribute('d', Array.from(visited).map(function (node, index) { return (index ? 'L' : 'M') + node.getAttribute('cx') + ' ' + node.getAttribute('cy') }).join(' '))
    tools.emit(Number(star.getAttribute('cx')), Number(star.getAttribute('cy')), 4)
    if (visited.size >= 6) reveal()
  })
  tools.activate(play, function () {
    if (!complete) reveal()
    else {
      complete = false
      visited.clear()
      trail.setAttribute('d', '')
      stars.forEach(function (star) { star.classList.remove('nf-visited') })
      play.classList.remove('nf-complete')
      play.setAttribute('aria-pressed', 'false')
      tools.say('星星散开了，沿星光再找一次。')
    }
  })
  tools.drag(play, function () {}, function () {}, function () {})
})
