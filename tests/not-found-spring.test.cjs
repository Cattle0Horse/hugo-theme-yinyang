const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function springFixture() {
  let id = 0
  let now = 0
  const frames = new Map()
  const cleanups = []
  const classes = new Set()
  function element() {
    return {
      children: [],
      style: {},
      classList: { add(name) { classes.add(name) }, remove(name) { classes.delete(name) } },
      querySelector(selector) {
        if (selector === '[data-nf-status]') return { textContent: '' }
        if (selector === 'svg') return svg
        return null
      },
      set innerHTML(value) { this.children = [] },
      setAttribute() {},
      remove() {}
    }
  }
  const svg = { createSVGPoint() { return {} } }
  const scene = element()
  const fallback = { hidden: false }
  const root = {
    querySelector(selector) {
      if (selector === '.nf-scene') return scene
      if (selector === '.nf-fallback') return fallback
      return null
    },
    setAttribute() {}
  }
  const page = {
    active: true,
    requestAnimationFrame(callback) { const key = ++id; frames.set(key, callback); return key },
    cancelAnimationFrame(key) { frames.delete(key) },
    setTimeout(callback) { const key = ++id; cleanups.push(() => clearTimeout(key)); return key },
    clearTimeout() {},
    addCleanup(callback) { cleanups.push(callback) },
    listen() { return () => {} }
  }
  const context = {
    window: {},
    document: { createElement() { return element() }, createElementNS() { return element() } },
    performance: { now: () => now }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/not-found-scene.js'), 'utf8'), context)
  context.mountScene(page, root, 'spring', { html: '', articles: [], initialize() {} })
  function step(delta = 16.67) {
    now += delta
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(callback => callback(now))
  }
  return {
    page,
    frames,
    step,
    dispose() { cleanups.forEach(callback => callback()) }
  }
}

test('spring motion converges to the target and preserves a bounded overshoot', () => {
  const fixture = springFixture()
  let value = { x: 0 }
  let maximum = value.x
  const cancel = fixture.page.notFound.springTo(
    () => value,
    next => { value = Object.assign({}, next); maximum = Math.max(maximum, value.x) },
    { x: 100 },
    { stiffness: .18, damping: .6, threshold: .05, speedThreshold: .01 }
  )
  for (let i = 0; i < 240 && fixture.frames.size; i++) fixture.step()
  assert.equal(value.x, 100)
  assert.ok(maximum < 115)
  cancel()
})

test('spring cancellation and page disposal prevent late writes', () => {
  const fixture = springFixture()
  let value = { x: 0 }
  const cancel = fixture.page.notFound.springTo(
    () => value,
    next => { value = Object.assign({}, next) },
    { x: 100 },
    { stiffness: .18, damping: .6 }
  )
  fixture.step()
  cancel()
  const stopped = value.x
  fixture.step(1000)
  assert.equal(value.x, stopped)

  value = { x: 0 }
  fixture.page.notFound.springTo(
    () => value,
    next => { value = Object.assign({}, next) },
    { x: 100 },
    { stiffness: .18, damping: .78 }
  )
  fixture.dispose()
  assert.equal(fixture.frames.size, 0)
})
