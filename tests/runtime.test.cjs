const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { test } = require('node:test')

function createRuntime() {
  const timers = new Map()
  const frames = new Map()
  const errors = []
  let sequence = 0
  const context = {
    window: {}, console: { error: (...args) => errors.push(args) },
    setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id },
    cancelAnimationFrame: id => frames.delete(id)
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/page-runtime.js'), 'utf8'), context)
  return { page: context.window.yinyangRuntime.page, timers, frames, errors, context }
}

test('once and returned unsubscribe preserve native event behavior', () => {
  const { page } = createRuntime()
  const target = new EventTarget()
  let calls = 0
  page.listen(target, 'done', () => calls++, { once: true })
  target.dispatchEvent(new Event('done'))
  target.dispatchEvent(new Event('done'))
  assert.equal(calls, 1)
  const handler = () => calls++
  const stop = page.listen(target, 'change', handler)
  page.listen(target, 'change', handler)
  target.dispatchEvent(new Event('change'))
  assert.equal(calls, 2)
  stop()
  stop()
  target.dispatchEvent(new Event('change'))
  assert.equal(calls, 2)
})

test('leaving a page cancels scheduled work and guards late async callbacks', () => {
  const { page, timers, frames } = createRuntime()
  let calls = 0
  page.setTimeout(() => calls++, 10)
  page.requestAnimationFrame(() => calls++)
  const late = page.guard(() => calls++)
  page.dispose()
  late()
  page.setTimeout(() => calls++, 10)
  page.requestAnimationFrame(() => calls++)
  assert.equal(timers.size, 0)
  assert.equal(frames.size, 0)
  assert.equal(calls, 0)
})

test('a custom cleanup failure does not prevent later cleanup', () => {
  const { page, errors } = createRuntime()
  let released = false
  page.addCleanup(() => { throw new Error('custom integration') })
  page.addCleanup(() => { released = true })
  page.dispose()
  page.dispose()
  assert.equal(released, true)
  assert.equal(errors.length, 1)
})

test('motion completion ignores unrelated properties and cancels its fallback', () => {
  const { page, timers } = createRuntime()
  const target = new EventTarget()
  let completed = 0
  page.onMotionEnd(target, { property: 'opacity', timeout: 220 }, () => completed++)
  function end(propertyName) {
    const event = new Event('transitionend')
    event.propertyName = propertyName
    target.dispatchEvent(event)
  }
  end('transform')
  assert.equal(completed, 0)
  end('opacity')
  end('opacity')
  assert.equal(completed, 1)
  assert.equal(timers.size, 0)
})

test('completed once listeners release detached targets before page disposal', { skip: !global.gc }, async () => {
  const { page } = createRuntime()
  function attach() {
    const target = new EventTarget()
    page.listen(target, 'done', () => {}, { once: true })
    target.dispatchEvent(new Event('done'))
    return new WeakRef(target)
  }
  const reference = attach()
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setImmediate(resolve))
    global.gc()
  }
  assert.equal(reference.deref(), undefined)
  assert.equal(page.active, true)
})
