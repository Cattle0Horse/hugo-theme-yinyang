const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function fixture(reduced = false) {
  const listeners = new Map(), timers = new Map(), cleanups = [], animations = []
  const attributes = () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v } })
  const numbers = Object.assign(attributes(), { dataset: { codeToggle: 'numbers' } })
  const wrap = Object.assign(attributes(), { dataset: { codeToggle: 'wrap' } })
  const classes = new Set()
  function animate(frames) {
    if (frames[0].opacity !== undefined) this.opacity = frames[0].opacity
    const motion = { cancelled: false, cancel() { this.cancelled = true } }
    animations.push(motion)
    return motion
  }
  const content = { opacity: 1, animate }
  const viewport = { scrollLeft: 70, animate, getBoundingClientRect: () => ({ height: wrapper.dataset.wrap === 'true' ? 120 : 60 }), querySelector: () => content }
  const wrapper = {
    dataset: { lineNumbers: 'false', wrap: 'false' }, style: { setProperty() {} },
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
    querySelector: () => viewport,
    querySelectorAll: s => s === '[data-code-toggle]' ? [numbers, wrap] : []
  }
  const runtime = {
    config: {}, tooltip: { update(button) { runtime.visibleTooltip = button.attrs['data-tooltip'] } },
    listen: (button, event, fn) => listeners.set(button, fn),
    addCleanup: fn => cleanups.push(fn), guard: fn => fn,
    setTimeout: fn => { const id = Symbol(); timers.set(id, fn); return id }, clearTimeout: id => timers.delete(id)
  }
  const context = {
    window: { matchMedia: () => ({ matches: reduced }), yinyangRuntime: { register(name, fn) { fn(runtime) } } },
    document: { querySelectorAll: s => s === '.code-block-wrapper' ? [wrapper] : [] }
  }
  for (const file of ['ui-helpers.js', 'code-toolbar.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context)
  return { runtime, wrapper, viewport, content, animations, timers, classes, numbers, wrap, click: b => listeners.get(b)(), dispose: () => cleanups.forEach(fn => fn()) }
}

test('code toggles update the action label, visible tooltip and pressed state in both directions', () => {
  const f = fixture()
  for (const [button, key] of [[f.numbers, 'lineNumbers'], [f.wrap, 'wrap']]) {
    const initialLabel = button.attrs['aria-label']
    f.click(button)
    assert.equal(f.wrapper.dataset[key], 'true')
    assert.equal(button.attrs['aria-pressed'], 'true')
    assert.notEqual(button.attrs['aria-label'], initialLabel)
    assert.equal(f.runtime.visibleTooltip, button.attrs['aria-label'])
    f.click(button)
    assert.equal(f.wrapper.dataset[key], 'false')
    assert.equal(button.attrs['aria-label'], initialLabel)
    assert.equal(f.runtime.visibleTooltip, initialLabel)
  }
  f.dispose()
})

test('repeated wrapping cancels prior motion, and leaving releases animations and fallback timers', () => {
  const f = fixture()
  f.click(f.wrap)
  assert.equal(f.viewport.scrollLeft, 0)
  const previous = f.animations.slice()
  assert.ok(previous.length > 0)
  f.click(f.wrap)
  assert.ok(previous.every(a => a.cancelled))
  assert.equal(f.wrapper.dataset.wrap, 'false')
  f.dispose()
  assert.ok(f.animations.every(a => a.cancelled))
  assert.equal(f.timers.size, 0)
  assert.equal(f.classes.size, 0)
})

test('reduced motion preserves immediate wrap changes without creating animations', () => {
  const f = fixture(true)
  f.click(f.wrap)
  assert.equal(f.wrapper.dataset.wrap, 'true')
  assert.equal(f.animations.length, 0)
  assert.equal(f.timers.size, 0)
})

test('wrapping keeps the code fully opaque, including when a transition is interrupted', () => {
  const f = fixture()
  for (let i = 0; i < 4; i++) {
    f.click(f.wrap)
    assert.equal(f.content.opacity, 1)
  }
  f.dispose()
})
