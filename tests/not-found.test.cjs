const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

async function experience({ width = 1280, available = ['cat'], random = 0, resourceFailure = null, stalled = false, waitForAssets = true } = {}) {
  let initialize
  let now = 0
  const animations = []
  const timers = new Map()
  const resources = []
  const initialized = []
  let version = ''
  let timerId = 0
  class Element extends EventTarget {
    constructor(parent = null) { super(); this.tagName = 'DIV'; this.parent = parent; this.children = []; this.attributes = {}; this.style = {} }
    setAttribute(key, value) { this.attributes[key] = value }
    getAttribute(key) { return this.attributes[key] ?? null }
    removeAttribute(key) { delete this.attributes[key] }
    set innerHTML(value) { this.children = [new Element(this)] }
    replaceChildren() { this.children = [] }
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
  scene.hidden = true
  const fallback = { hidden: false }
  const svg = new Element()
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return this } })
  svg.getScreenCTM = () => ({ inverse: () => ({}) })
  scene.querySelector = selector => selector === 'svg' ? svg : selector === '[data-nf-status]' ? { textContent: '' } : null
  const root = new Element()
  root.querySelectorAll = () => available.map(name => {
    const html = fs.readFileSync(path.join(__dirname, '../layouts/partials/not-found', name + '.html'), 'utf8')
    const devices = html.match(/\bdata-nf-devices="([^"]*)"/)?.[1] || ''
    const prefix = version ? version + '/' : ''
    const attributes = { 'data-nf-template': name, 'data-nf-devices': devices, 'data-nf-css': '/css/not-found/' + prefix + name + '.css', 'data-nf-js': '/js/not-found/' + prefix + name + '.js' }
    return {
      getAttribute: key => attributes[key] ?? null
    }
  })
  root.querySelector = selector => {
    if (selector === '.nf-scene') return scene
    if (selector === '.nf-fallback') return fallback
    return null
  }
  const window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: width <= 600 }) })
  function loadResource(node) {
    if (resourceFailure === node.tagName) { node.onerror?.(); return }
    if (node.tagName === 'SCRIPT') {
      const name = path.basename(node.src, '.js')
      window.yinyangRuntime.notFoundScenes[name] = { mount: context.mountScene, html: name, articles: [], initialize: () => initialized.push(name) }
    }
    node.onload?.()
  }
  const head = new Element()
  head.appendChild = node => {
    Element.prototype.appendChild.call(head, node)
    resources.push(node)
    if (!stalled) queueMicrotask(() => loadResource(node))
  }
  const context = {
    window, console, Math: Object.assign(Object.create(Math), { random: () => random }),
    document: {
      head, querySelector: () => root, createElementNS: () => new Element(),
      createElement: tag => Object.assign(new Element(), { tagName: tag.toUpperCase() })
    },
    performance: { now: () => now },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}
  }
  for (const filename of ['page-runtime.js', 'not-found-resources.js', 'not-found-scene.js', 'not-found.js']) {
    if (filename === 'not-found.js') context.window.yinyangRuntime.register = (name, callback) => { initialize = callback }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', filename), 'utf8'), context)
  }
  let page = context.window.yinyangRuntime.page
  initialize(page)
  if (waitForAssets) await page.notFoundReady
  return {
    get tools() { return page.notFound },
    get page() { return page },
    surface, piece, svg, scene, fallback, animations, timers, resources, initialized,
    get selected() { return root.attributes['data-nf-style'] },
    resize(value) { width = value; window.dispatchEvent(new Event('resize')) },
    advance: value => { now += value },
    loadResources() { resources.forEach(loadResource) },
    expire() { for (const [id, callback] of [...timers]) { if (timers.delete(id)) callback() } },
    async remount(revision = version, failure = null) {
      page.dispose()
      version = revision
      resourceFailure = failure
      page = window.yinyangRuntime.createPage()
      scene.hidden = true
      scene.children = []
      fallback.hidden = false
      root.removeAttribute('data-nf-style')
      initialize(page)
      await page.notFoundReady
    }
  }
}

test('mobile selection only draws from enabled scenes that support mobile, including the 600px boundary', async () => {
  const available = ['terminal', 'constellation', 'flashlight', 'cat', 'receipt']
  for (const width of [390, 600]) {
    for (const [random, expected] of [[0, 'cat'], [0.49, 'cat'], [0.5, 'receipt'], [0.99, 'receipt']]) {
      const result = await experience({ width, available, random })
      assert.equal(result.selected, expected)
      assert.equal(result.fallback.hidden, true)
      assert.equal(result.scene.hidden, false)
    }
  }
})

test('desktop selection includes its exclusive scenes and shared scenes above 600px', async () => {
  const available = ['terminal', 'constellation', 'flashlight', 'cat', 'receipt']
  for (const width of [601, 1280]) {
    for (const [random, expected] of [[0, 'terminal'], [0.2, 'constellation'], [0.4, 'flashlight'], [0.6, 'cat'], [0.8, 'receipt']]) {
      assert.equal((await experience({ width, available, random })).selected, expected)
    }
  }
})

test('a mobile device with only desktop scenes enabled retains the ordinary 404', async () => {
  for (const available of [['terminal'], ['flashlight', 'constellation', 'terminal']]) {
    const result = await experience({ width: 390, available })
    assert.equal(result.selected, undefined)
    assert.equal(result.tools, undefined)
    assert.equal(result.fallback.hidden, false)
    assert.equal(result.scene.hidden, true)
  }
})

test('a single compatible scene stays selected on both devices and resizing preserves the active scene', async () => {
  for (const width of [390, 1280]) {
    assert.equal((await experience({ width, available: ['cat'], random: 0.99 })).selected, 'cat')
  }
  const result = await experience({ width: 1280, available: ['terminal', 'cat'] })
  assert.equal(result.selected, 'terminal')
  result.resize(390)
  assert.equal(result.selected, 'terminal')
  assert.equal(result.scene.children.length, 1)
})

test('only the selected compatible scene requests resources, and an empty pool requests none', async () => {
  const result = await experience({ width: 390, available: ['terminal', 'cat', 'receipt'] })
  assert.deepEqual(result.resources.map(node => node.src || node.href).sort(), ['/css/not-found/cat.css', '/js/not-found/cat.js'])
  assert.deepEqual(result.initialized, ['cat'])
  const fallback = await experience({ width: 390, available: ['terminal'] })
  assert.equal(fallback.resources.length, 0)
})

test('revisiting a scene reuses its script and initializes the new page once', async () => {
  const result = await experience()
  await result.remount()
  assert.equal(result.resources.filter(node => node.tagName === 'SCRIPT').length, 1)
  assert.deepEqual(result.initialized, ['cat', 'cat'])
  assert.equal(result.selected, 'cat')
})

test('a new scene asset URL loads the matching version instead of reusing its earlier script', async () => {
  const result = await experience()
  await result.remount('updated')
  const urls = result.resources.filter(node => node.tagName === 'SCRIPT').map(node => node.src)
  assert.deepEqual(urls, ['/js/not-found/cat.js', '/js/not-found/updated/cat.js'])
  await result.remount('')
  assert.equal(result.resources.filter(node => node.tagName === 'SCRIPT').length, 2)
  assert.deepEqual(result.initialized, ['cat', 'cat', 'cat'])
})

test('a failed updated scene does not initialize the previously cached version', async () => {
  const result = await experience()
  await result.remount('updated', 'SCRIPT')
  assert.equal(result.selected, undefined)
  assert.equal(result.fallback.hidden, false)
  assert.deepEqual(result.initialized, ['cat'])
})

test('a failed scene stylesheet or script leaves the ordinary 404 visible and releases the stylesheet', async () => {
  for (const resourceFailure of ['LINK', 'SCRIPT']) {
    const result = await experience({ resourceFailure })
    assert.equal(result.selected, undefined)
    assert.equal(result.fallback.hidden, false)
    assert.equal(result.scene.hidden, true)
    assert.equal(result.initialized.length, 0)
    assert.ok(!result.resources.find(node => node.tagName === 'LINK').parent.children.length)
  }
})

test('stalled scene resources settle on the ordinary 404 after the deadline', async () => {
  const result = await experience({ stalled: true, waitForAssets: false })
  result.expire()
  await result.page.notFoundReady
  assert.equal(result.selected, undefined)
  assert.equal(result.fallback.hidden, false)
  assert.equal(result.scene.hidden, true)
  assert.equal(result.timers.size, 0)
})

test('leaving before scene resources arrive prevents late initialization', async () => {
  const result = await experience({ stalled: true, waitForAssets: false })
  result.page.dispose()
  await result.page.notFoundReady
  result.loadResources()
  await Promise.resolve()
  assert.equal(result.initialized.length, 0)
  assert.equal(result.selected, undefined)
  assert.equal(result.scene.hidden, true)
  assert.equal(result.timers.size, 0)
})

test('releasing a dragged item preserves its result when the browser clicks the containing surface', async () => {
  const { tools, surface, piece, advance } = await experience()
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

test('leaving a 404 during an effect cancels animations, removes particles and blocks late completion', async () => {
  const { tools, page, piece, svg, animations, timers } = await experience()
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

test('window-wide dragging receives document events while the SVG owns pointer capture', async () => {
  const { tools, page, piece } = await experience()
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
