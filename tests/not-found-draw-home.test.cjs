const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function drawing() {
  let gesture, id = 0, destination = null
  const frames = new Map(), timers = new Map()
  function element() {
    const node = new EventTarget(), attrs = new Map()
    node.style = {}
    node.classList = { add() {}, remove() {}, toggle() {} }
    node.setAttribute = (name, value) => attrs.set(name, String(value))
    node.getAttribute = name => attrs.get(name)
    node.removeAttribute = name => attrs.delete(name)
    return node
  }
  const ball = element(), route = element(), house = element(), reset = element(), status = element()
  house.setAttribute('href', '/sub/')
  route.getTotalLength = () => 100
  route.getPointAtLength = distance => {
    const values = route.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)
    const ratio = distance / 100
    return { x: values[0] + (values.at(-2) - values[0]) * ratio, y: values[1] + (values.at(-1) - values[1]) * ratio }
  }
  const svg = element()
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return this } })
  svg.getScreenCTM = () => ({})
  const nodes = { '.nf-drawn-path': route, '.nf-ball': ball, '.nf-drawing-field': element(), '.nf-draw-home-house': house, '[data-nf-status]': status, '.nf-draw-home-reset': reset }
  const context = { window: { innerWidth: 1280, innerHeight: 900 }, document: new EventTarget() }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/not-found/draw-home.js'), 'utf8'), context)
  const initialize = context.initialize
  initialize({
    requestAnimationFrame: callback => { const key = ++id; frames.set(key, callback); return key },
    cancelAnimationFrame: key => frames.delete(key),
    setTimeout: callback => { const key = ++id; timers.set(key, callback); return key }, clearTimeout: key => timers.delete(key),
    notFound: {
      scene: { querySelector: () => ({}) }, svg, find: selector => nodes[selector], say: text => { status.textContent = text },
      listen: (node, type, handler) => node.addEventListener(type, handler), activate: (node, handler) => node.addEventListener('click', handler),
      drag(target, start, move, end) { gesture = { start, move, end } }, openArticle(article) { destination = article.url }
    }
  })
  function frame(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)) }
  return {
    ball, route, frames, timers,
    get destination() { return destination },
    start(point) { gesture.start(point, { target: { closest: () => null } }) },
    finish(point) { gesture.move(point); gesture.end(point, {}, true, false) },
    arrive() { frame(0); frame(4000) },
    navigate() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()) },
    reset() { reset.dispatchEvent(new Event('click')) }
  }
}

test('a route can start anywhere and carries the ball home before navigation', () => {
  const page = drawing()
  page.start({ x: 300, y: 100 })
  assert.equal(page.ball.getAttribute('cx'), '300')
  page.finish({ x: 527, y: 272 })
  assert.equal(page.destination, null)
  page.arrive()
  assert.equal(page.ball.getAttribute('cx'), '527')
  page.navigate()
  assert.equal(page.destination, '/sub/')
})

test('redrawing interrupts motion and clears a pending home jump; reset remains usable', () => {
  const page = drawing()
  page.start({ x: 300, y: 100 })
  page.finish({ x: 527, y: 272 })
  page.start({ x: -80, y: 400 })
  assert.equal(page.frames.size, 0)
  assert.equal(page.ball.getAttribute('cx'), '-80')
  page.finish({ x: 527, y: 272 })
  page.arrive()
  page.start({ x: 80, y: 50 })
  page.navigate()
  assert.equal(page.destination, null)
  page.finish({ x: 250, y: 200 })
  page.reset()
  assert.equal(page.frames.size, 0)
  assert.equal(page.route.getAttribute('d'), '')
  page.start({ x: 400, y: 70 })
  assert.equal(page.ball.getAttribute('cx'), '400')
})
