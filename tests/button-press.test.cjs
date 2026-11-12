const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function fixture() {
  let time = 0
  let sequence = 0
  const timers = new Map()
  const document = new EventTarget()
  const window = new EventTarget()
  const context = {
    document, window, performance: { now: () => time }, console,
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: time + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame() {}, cancelAnimationFrame() {}
  }
  for (const name of ['page-runtime.js', 'button-press.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8'), context)
  }
  const lifecycle = window.yinyangRuntime
  const page = lifecycle.page
  lifecycle.createScroll = () => ({})
  document.getElementById = () => null
  lifecycle.mount()
  const button = () => {
    const classes = new Set()
    return {
      disabled: false,
      classList: { add(name) { classes.add(name) }, remove(name) { classes.delete(name) } },
      // is-pressed is the DOM/CSS boundary for the visual feedback; the browser
      // check verifies its scale, while these tests exercise its input lifetime.
      get pressing() { return classes.has('is-pressed') },
      getAttribute() { return null },
      closest() { return this }
    }
  }
  return {
    page, document, button, timers,
    advance(elapsed) {
      time += elapsed
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time && timers.delete(id)) timer.callback()
      }
    },
    pointer(node, type, values = {}) {
      const event = new Event(type, { cancelable: true })
      Object.defineProperty(event, 'target', { value: node })
      Object.assign(event, { pointerType: 'touch', isPrimary: true, button: 0, pointerId: 1, clientX: 20, clientY: 20 }, values)
      document.dispatchEvent(event)
      return event
    }
  }
}

test('the first short touch stays visible through release without consuming the tap', () => {
  const f = fixture(), button = f.button()
  assert.equal(f.pointer(button, 'pointerdown').defaultPrevented, false)
  assert.equal(button.pressing, true)
  f.advance(15)
  f.pointer(button, 'pointerup')
  assert.equal(button.pressing, true)
  f.advance(100)
  assert.equal(button.pressing, false)
  assert.equal(f.timers.size, 0)
})

test('scrolling, cancellation and disposal release touches instead of leaving a stuck press', () => {
  for (const cancel of ['move', 'cancel', 'scroll', 'dispose']) {
    const f = fixture(), button = f.button()
    f.pointer(button, 'pointerdown')
    if (cancel === 'move') f.pointer(button, 'pointermove', { clientY: 50 })
    else if (cancel === 'cancel') f.pointer(button, 'pointercancel')
    else if (cancel === 'scroll') f.document.dispatchEvent(new Event('scroll'))
    else { f.pointer(button, 'pointerup'); f.page.dispose() }
    assert.equal(button.pressing, false, cancel)
    assert.equal(f.timers.size, 0, cancel)
  }
})

test('a second touch replaces the first release timer and a long press releases immediately', () => {
  const f = fixture(), first = f.button(), second = f.button()
  f.pointer(first, 'pointerdown')
  f.pointer(first, 'pointerup')
  f.advance(30)
  f.pointer(second, 'pointerdown', { pointerId: 2 })
  f.advance(80)
  assert.equal(first.pressing, false)
  assert.equal(second.pressing, true)
  f.advance(100)
  f.pointer(second, 'pointerup', { pointerId: 2 })
  assert.equal(second.pressing, false)
  assert.equal(f.timers.size, 0)
})

test('disabled buttons and mouse clicks keep their native behavior', () => {
  const f = fixture(), button = f.button()
  button.disabled = true
  f.pointer(button, 'pointerdown')
  assert.equal(button.pressing, false)
  button.disabled = false
  f.pointer(button, 'pointerdown', { pointerType: 'mouse' })
  assert.equal(button.pressing, false)
})
