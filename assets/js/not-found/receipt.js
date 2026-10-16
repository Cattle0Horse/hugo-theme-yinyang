function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="receipt"]')) return

  var play = tools.find('.nf-play')
  var ticket = tools.find('.nf-ticket')
  var feed = tools.find('.nf-ticket-feed')
  var reason = tools.find('.nf-ticket-reason')
  var status = tools.find('[data-nf-status]')
  var busy = false
  var count = 0
  var cancelReturn = null
  var reasons = ['页面被猫叼走了', '服务器去喝奶茶了', '这一页提前下班了', '内容正在环游宇宙', '作者忘了带这一页']
  function finishPrint() {
    busy = false
    play.setAttribute('aria-busy', 'false')
    play.classList.remove('nf-printing')
    feed.removeAttribute('clip-path')
    tools.say('已重新开票')
    status.setAttribute('aria-label', '已重新开票，原因：' + reasons[count % reasons.length])
  }
  function feedTicket() {
    reason.textContent = '原因：' + reasons[++count % reasons.length]
    ticket.style.transform = ''
    feed.setAttribute('clip-path', 'url(#nf-receipt-feed)')
    tools.animate(ticket, [{ transform: 'translateY(-130px)', opacity: 0 },
      { transform: 'translateY(4px)', opacity: 1, offset: .8 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }, finishPrint)
  }
  function print() {
    if (busy) return
    busy = true
    play.setAttribute('aria-busy', 'true')
    play.classList.add('nf-printing')
    var from = getComputedStyle(ticket).transform
    var position = new DOMMatrix(from)
    if (cancelReturn) cancelReturn()
    feed.removeAttribute('clip-path')
    tools.say('')
    tools.animate(ticket, [{ transform: from, opacity: 1 }, { transform: 'translate(' + position.e + 'px,' + (position.f + 135) + 'px) rotate(12deg)', opacity: 0 }],
      { duration: 420, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'both' }, feedTicket)
  }
  tools.drag(ticket, function () {
    if (busy) return false
    if (cancelReturn) cancelReturn()
    feed.removeAttribute('clip-path')
    tools.say('')
    play.classList.add('nf-dragging')
  }, function (p, origin) {
    ticket.style.transform = 'translate(' + (p.x - origin.x) + 'px,' + (p.y - origin.y) + 'px) rotate(' + Math.max(-12, Math.min(12, (p.x - origin.x) / 15)) + 'deg)'
  }, function (p, origin, moved, cancelled) {
    play.classList.remove('nf-dragging')
    if (!moved && !cancelled) return
    if (!cancelled && p.y - origin.y > 38) print()
    else {
      var from = getComputedStyle(ticket).transform
      ticket.style.transform = ''
      cancelReturn = tools.animate(ticket, [{ transform: from }, { transform: 'translateY(-4px)', offset: .7 }, { transform: 'translateY(0)' }], { duration: 600, easing: 'ease-out' })
    }
  })
  tools.activate(play, print)
}
