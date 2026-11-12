const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function fixture({ scrollHeight = 1200, clientHeight = 800, wide = false } = {}) {
  let onScroll, onModeChange, sequence = 0, time = 0
  const timers = new Map(), frames = new Map()
  function element(properties = {}) {
    const classes = new Set(), styles = new Map()
    return Object.assign(new EventTarget(), {
      styles,
      classList: {
        contains: name => classes.has(name),
        add(...names) { names.forEach(name => classes.add(name)) },
        remove(...names) { names.forEach(name => classes.delete(name)) }
      },
      style: { setProperty(name, value) { styles.set(name, value) }, removeProperty(name) { styles.delete(name) } },
      getBoundingClientRect: () => ({ top: 0, bottom: clientHeight }),
      closest: () => null
    }, properties)
  }
  const shell = element(), app = element({ scrollTop: 0, scrollHeight, clientHeight })
  const html = element({ scrollHeight })
  const document = Object.assign(new EventTarget(), {
    documentElement: html, body: element(),
    getElementById: () => null,
    querySelector: selector => selector === '.app-main' ? shell : null
  })
  const window = new EventTarget()
  const context = {
    window, document, console, performance: { now: () => time },
    getComputedStyle: node => ({ overflowY: node.overflowY || 'visible', lineHeight: '20px', fontSize: '16px' }),
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: time + delay }); return id },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id },
    cancelAnimationFrame: id => frames.delete(id)
  }
  for (const name of ['page-runtime.js', 'spring.js', 'scroll-boundary.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8'), context)
  }
  const lifecycle = window.yinyangRuntime, page = lifecycle.page
  lifecycle.createScroll = () => ({
    isWide: () => wide, element: () => app,
    viewport: () => ({ top: 0, bottom: clientHeight, height: clientHeight }),
    position: () => ({ top: app.scrollTop, left: 0 }),
    onChange(callback) { onScroll = callback; return () => { onScroll = null } },
    onModeChange(callback) { onModeChange = callback; return () => { onModeChange = null } }
  })
  lifecycle.mount()
  function input(type, values = {}, target = app) {
    const event = new Event(type, { cancelable: true })
    Object.defineProperty(event, 'target', { value: target })
    Object.assign(event, values)
    document.dispatchEvent(event)
    return event
  }
  return {
    app, page, shell, element, timers, frames,
    get offset() { return page.scrollEffect.offset },
    wheel(deltaY, target, deltaMode = 0) { return input('wheel', { deltaY, deltaX: 0, deltaMode }, target) },
    compositorWheel(top, deltaY) {
      app.scrollTop = top
      input('wheel', { deltaY, deltaX: 0, deltaMode: 0 })
      onScroll()
    },
    cancel() { input('click') },
    touch(type, y = 0) { return input(type, { touches: [{ clientX: 20, clientY: y }] }) },
    scrollTo(top) { app.scrollTop = top; onScroll() },
    modeChange() { wide = !wide; onModeChange() },
    advance(ms) {
      const end = time + ms
      while (time < end) {
        time = Math.min(time + 16.67, end)
        for (const [id, timer] of [...timers]) if (timer.at <= time && timers.delete(id)) timer.callback()
        for (const [id, callback] of [...frames]) if (frames.delete(id)) callback(time)
      }
    }
  }
}

test('restoration and layout notifications never start boundary motion', () => {
  for (const wide of [false, true]) {
    const f = fixture({ wide })
    f.scrollTo(0)
    f.scrollTo(400)
    f.advance(1000)
    assert.equal(f.offset, 0)
    assert.equal(f.shell.styles.size, 0)
  }
})

test('outward input at either existing boundary pulls and returns without changing scroll coordinates', () => {
  for (const wide of [false, true]) {
    const f = fixture({ wide })
    for (const [top, delta, sign] of [[0, -80, 1], [400, 80, -1]]) {
      f.scrollTo(top)
      for (let i = 0; i < 2; i++) {
        f.wheel(delta)
        f.advance(50)
        assert.ok(f.offset * sign > 0 && Math.abs(f.offset) <= 72)
        assert.equal(f.app.scrollTop, top)
        f.advance(1000)
        assert.equal(f.offset, 0)
        assert.equal(f.shell.styles.size, 0)
      }
    }
  }
})

test('wheel notches start from rest and add momentum during recoil without jumping position', () => {
  const f = fixture({ wide: true })
  assert.equal(f.wheel(-120).defaultPrevented, false)
  assert.equal(f.offset, 0, 'wheel input must not directly assign a displacement')
  f.advance(50)
  assert.ok(f.offset > 0 && f.offset < 20)
  f.advance(70)
  const returning = f.offset
  f.wheel(-120)
  assert.ok(Math.abs(f.offset - returning) < 1e-8)
  f.advance(1000)
  assert.equal(f.offset, 0)
})

test('crossing an edge uses only the unconsumed part of the wheel input, once', () => {
  const crossing = fixture({ wide: true }), overflow = fixture({ wide: true })
  crossing.scrollTo(290)
  crossing.wheel(120)
  assert.equal(crossing.offset, 0)
  crossing.scrollTo(400)
  overflow.scrollTo(400)
  overflow.wheel(10)
  for (const elapsed of [32, 48, 80]) {
    crossing.advance(elapsed)
    overflow.advance(elapsed)
    assert.ok(Math.abs(crossing.offset - overflow.offset) < 1e-8)
    crossing.scrollTo(400)
  }
})

test('multiple wheel events before native scrolling catches up share the remaining scroll distance', () => {
  const burst = fixture(), overflow = fixture()
  burst.scrollTo(300)
  burst.wheel(60)
  burst.wheel(60)
  burst.scrollTo(400)
  overflow.scrollTo(400)
  overflow.wheel(20)
  burst.advance(80)
  overflow.advance(80)
  assert.ok(Math.abs(burst.offset - overflow.offset) < 1e-8)
})

test('passive wheel delivery after compositor scrolling still subtracts travel consumed by that event', () => {
  for (const delta of [100, 120]) {
    const crossing = fixture({ wide: true }), overflow = fixture({ wide: true })
    crossing.scrollTo(300)
    crossing.compositorWheel(400, delta)
    overflow.scrollTo(400)
    if (delta > 100) overflow.wheel(delta - 100)
    crossing.advance(80)
    overflow.advance(80)
    assert.ok(Math.abs(crossing.offset - overflow.offset) < 1e-8)
  }
})

test('equivalent pixel, line, and page inputs produce the same boundary response', () => {
  const inputs = [[-120, 0], [-6, 1], [-.15, 2]].map(([delta, mode]) => {
    const f = fixture()
    f.wheel(delta, undefined, mode)
    return f
  })
  for (const elapsed of [32, 48, 160]) {
    inputs.forEach(f => f.advance(elapsed))
    for (const f of inputs.slice(1)) assert.ok(Math.abs(f.offset - inputs[0].offset) < 1e-8)
  }
})

test('a decaying continuous wheel tail does not keep pushing the page outward', () => {
  const tail = fixture(), single = fixture()
  single.wheel(-80)
  for (const delta of [-80, -40, -20, -10, -5, -2, -1]) {
    tail.wheel(delta)
    tail.advance(16)
    single.advance(16)
  }
  assert.ok(Math.abs(tail.offset - single.offset) < 1e-8)
  tail.advance(1000)
  assert.equal(tail.offset, 0)
})

test('same-frame wheel grouping is independent of the number of events', () => {
  const one = fixture(), grouped = fixture()
  one.wheel(-120)
  for (let i = 0; i < 3; i++) grouped.wheel(-40)
  one.advance(80)
  grouped.advance(80)
  assert.ok(Math.abs(one.offset - grouped.offset) < 1e-8)
})

test('a renewed push after a wheel tail resumes feedback from the current motion', () => {
  const pushed = fixture(), tail = fixture()
  for (const delta of [-80, -40, -20]) {
    for (const f of [pushed, tail]) { f.wheel(delta); f.advance(16) }
  }
  const position = pushed.offset
  pushed.wheel(-80)
  assert.equal(pushed.offset, position)
  pushed.advance(32)
  tail.advance(32)
  assert.ok(pushed.offset > tail.offset)
})

test('continuous strong wheel input stays within the desktop excursion and settles after release', () => {
  const f = fixture()
  for (let i = 0; i < 100; i++) {
    f.wheel(-120)
    f.advance(16)
    assert.ok(f.offset > 0 && f.offset < 24)
  }
  f.advance(1000)
  assert.equal(f.offset, 0)
  assert.equal(f.frames.size, 0)
})

test('moving away from the edge immediately restores native scrolling', () => {
  const f = fixture()
  f.wheel(-120)
  f.advance(50)
  assert.ok(f.offset > 0)
  assert.equal(f.wheel(60).defaultPrevented, false)
  assert.equal(f.offset, 0)
  f.scrollTo(60)
  f.advance(100)
  assert.equal(f.offset, 0)
})

test('cancelling navigation input drops an edge response that native scrolling has not reached', () => {
  const f = fixture()
  f.scrollTo(290)
  f.wheel(120)
  f.cancel()
  f.scrollTo(400)
  f.advance(160)
  assert.equal(f.offset, 0)
})

test('a held touch follows the gesture, reverses cleanly and returns on release', () => {
  const f = fixture()
  f.touch('touchstart', 100)
  assert.equal(f.touch('touchmove', 140).defaultPrevented, true)
  assert.ok(f.offset > 0)
  const held = f.offset
  assert.equal(f.frames.size, 0, 'drag input must render directly without chasing a spring target')
  f.advance(50)
  assert.equal(f.offset, held, 'holding still must not cause the page to catch up later')
  f.touch('touchmove', 120)
  assert.ok(f.offset > 0 && f.offset < held, 'reversal should follow the finger before reaching rest')
  f.touch('touchmove', 80)
  assert.equal(f.offset, 0)
  f.scrollTo(400)
  f.advance(100)
  assert.ok(f.offset < 0)
  f.touch('touchend')
  f.advance(1000)
  assert.equal(f.offset, 0)
})

test('drag resistance grows progressively and interrupted rebounds can be caught without a jump', () => {
  const f = fixture()
  f.touch('touchstart', 100)
  f.advance(20)
  f.touch('touchmove', 140)
  const first = f.offset
  f.advance(20)
  f.touch('touchmove', 180)
  assert.ok(f.offset - first < first)
  f.touch('touchend')
  f.advance(100)
  const returning = f.offset
  f.touch('touchstart', 180)
  assert.equal(f.offset, returning)
  assert.equal(f.frames.size, 0)
  f.advance(100)
  assert.equal(f.offset, returning)
  f.touch('touchmove', 200)
  assert.ok(f.offset > returning)
})

test('normal scrolling stays native until it actually reaches an edge', () => {
  const f = fixture()
  f.scrollTo(200)
  f.touch('touchstart', 100)
  assert.equal(f.touch('touchmove', 60).defaultPrevented, false)
  assert.equal(f.offset, 0)
})

test('arriving at an edge during touch inertia returns even after the finger has lifted', () => {
  const f = fixture()
  f.scrollTo(200)
  f.touch('touchstart', 150)
  f.touch('touchmove', 100)
  f.touch('touchend')
  f.scrollTo(400)
  f.advance(50)
  assert.ok(f.offset < 0)
  f.advance(1000)
  assert.equal(f.offset, 0)
})

test('nested scrolling and pages without overflow do not pull the page', () => {
  const f = fixture()
  f.wheel(-80, f.element({ scrollHeight: 500, clientHeight: 200, overflowY: 'auto' }))
  f.advance(100)
  assert.equal(f.offset, 0)
  const short = fixture({ scrollHeight: 700 })
  short.wheel(-80)
  short.advance(100)
  assert.equal(short.offset, 0)
})

test('mode changes and leaving cancel offsets, pending frames and release timers', () => {
  const f = fixture()
  f.wheel(-80)
  f.advance(50)
  f.modeChange()
  assert.equal(f.offset, 0)
  assert.equal(f.frames.size, 0)
  f.wheel(-80)
  f.advance(50)
  f.page.dispose()
  assert.equal(f.shell.styles.size, 0)
  assert.equal(f.frames.size, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(f.page.scrollEffect, undefined)
})
