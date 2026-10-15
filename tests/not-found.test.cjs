const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function experience() {
  let initialize
  let now = 0
  const animations = []
  const timers = new Map()
  let timerId = 0
  class Element extends EventTarget {
    constructor(parent = null) { super(); this.tagName = 'DIV'; this.parent = parent; this.children = []; this.attributes = {}; this.style = {} }
    setAttribute(key, value) { this.attributes[key] = value }
    appendChild(child) { child.parent = this; this.children.push(child) }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1) }
    contains(node) { return node === this || !!(node.parent && this.contains(node.parent)) }
    closest() { return surface }
    setPointerCapture(id) { this.pointer = id }
    hasPointerCapture(id) { return this.pointer === id }
    releasePointerCapture() { this.pointer = null }
    animate() {
      const animation = new EventTarget()
      animation.playState = 'running'
      animation.cancel = () => { animation.playState = 'idle' }
      animations.push(animation)
      return animation
    }
  }
  const surface = new Element()
  const piece = new Element(surface)
  const scene = new Element()
  const svg = new Element()
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return this } })
  svg.getScreenCTM = () => ({ inverse: () => ({}) })
  scene.querySelector = selector => selector === 'svg' ? svg : selector === '[data-nf-status]' ? { textContent: '' } : null
  const root = new Element()
  root.querySelectorAll = () => [{ getAttribute: () => 'cat', content: { cloneNode: () => new Element() } }]
  root.querySelector = selector => selector === '.nf-scene' ? scene : selector === '#nf-pages' ? { textContent: '[]' } : {}
  const context = {
    window: {}, console,
    document: { querySelector: () => root, createElementNS: () => new Element() },
    performance: { now: () => now },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}
  }
  for (const filename of ['page-runtime.js', 'not-found.js']) {
    if (filename === 'not-found.js') context.window.yinyangRuntime.register = (name, callback) => { initialize = callback }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', filename), 'utf8'), context)
  }
  const page = context.window.yinyangRuntime.page
  initialize(page)
  return { tools: page.notFound, page, surface, piece, svg, animations, timers, advance: value => { now += value } }
}

test('releasing a dragged item preserves its result when the browser clicks the containing surface', () => {
  const { tools, surface, piece, advance } = experience()
  let pushed = false
  tools.activate(surface, () => { pushed = !pushed })
  tools.drag(piece, () => {}, () => {}, () => { pushed = true })
  function pointer(type, x) {
    const event = new Event(type)
    Object.assign(event, { isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: 0 })
    piece.dispatchEvent(event)
  }
  pointer('pointerdown', 0)
  advance(20)
  pointer('pointermove', 80)
  pointer('pointerup', 80)
  surface.dispatchEvent(new Event('click'))
  assert.equal(pushed, true)
  advance(500)
  surface.dispatchEvent(new Event('click'))
  assert.equal(pushed, false)
})

test('leaving a 404 during an effect cancels animations, removes particles and blocks late completion', () => {
  const { tools, page, piece, svg, animations, timers } = experience()
  let completed = false
  tools.animate(piece, [], { duration: 900 }, () => { completed = true })
  tools.emit(200, 128, 4)
  assert.ok(svg.children.length > 0)
  page.dispose()
  for (const animation of animations) {
    assert.equal(animation.playState, 'idle')
    animation.dispatchEvent(new Event('finish'))
  }
  assert.equal(svg.children.length, 0)
  assert.equal(timers.size, 0)
  assert.equal(completed, false)
})

test('window-wide dragging receives document events while the SVG owns pointer capture', () => {
  const { tools, page, piece } = experience()
  const events = new EventTarget()
  let endpoint = null
  tools.drag(events, () => {}, () => {}, point => { endpoint = [point.x, point.y] }, { captureTarget: piece })
  function pointer(type, x, y) {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { isPrimary: true, button: 0, pointerId: 7, clientX: x, clientY: y })
    events.dispatchEvent(event)
  }
  pointer('pointerdown', 95, 85)
  assert.equal(piece.hasPointerCapture(7), true)
  pointer('pointermove', -200, 900)
  pointer('pointerup', -200, 900)
  assert.deepEqual(endpoint, [-200, 900])
  assert.equal(piece.hasPointerCapture(7), false)
  pointer('pointerdown', 95, 85)
  page.dispose()
  assert.equal(piece.hasPointerCapture(7), false)
})
