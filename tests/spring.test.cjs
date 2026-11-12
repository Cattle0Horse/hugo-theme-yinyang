const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function fixture(options = {}) {
  let now = 0, sequence = 0, output = 0
  const frames = new Map()
  const context = {
    window: {}, console, performance: { now: () => now }, setTimeout, clearTimeout,
    requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id) }
  }
  for (const name of ['page-runtime.js', 'spring.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8'), context)
  }
  const lifecycle = context.window.yinyangRuntime, page = lifecycle.page
  const spring = lifecycle.createSpring(page, value => { output = value }, Object.assign({ mass: 1, stiffness: 280, dampingRatio: .82 }, options))
  return {
    spring, page, frames,
    get output() { return output },
    elapse(ms) { now += ms },
    advance(ms, hz = 60) {
      const end = now + ms
      while (now < end) {
        now = Math.min(end, now + 1000 / hz)
        for (const [id, callback] of [...frames]) if (frames.delete(id)) callback(now)
      }
    }
  }
}

test('release retains velocity while direct manipulation renders immediately', () => {
  const still = fixture(), moving = fixture()
  still.spring.hold(24, 0)
  moving.spring.hold(24, 240)
  assert.equal(moving.output, 24)
  assert.equal(moving.frames.size, 0)
  still.spring.release()
  moving.spring.release()
  still.advance(40)
  moving.advance(40)
  assert.ok(moving.output > still.output)
})

test('the same physical release has the same position and velocity at different refresh rates', () => {
  const states = [60, 120, 144].map(hz => {
    const f = fixture()
    f.spring.hold(32, 180)
    f.spring.release()
    f.advance(170, hz)
    return [f.spring.position, f.spring.velocity]
  })
  for (const state of states.slice(1)) {
    assert.ok(Math.abs(state[0] - states[0][0]) < 1e-8)
    assert.ok(Math.abs(state[1] - states[0][1]) < 1e-8)
  }
})

test('mass and stiffness control the rate of return', () => {
  const standard = fixture(), heavy = fixture({ mass: 2 }), stiff = fixture({ stiffness: 560 })
  for (const f of [standard, heavy, stiff]) { f.spring.hold(32); f.spring.release(); f.advance(70) }
  assert.ok(heavy.output > standard.output)
  assert.ok(stiff.output < standard.output)
})

test('impulses change velocity according to mass, leave the rendered position intact and share one frame', () => {
  const standard = fixture(), heavy = fixture({ mass: 2 })
  for (const f of [standard, heavy]) {
    f.spring.impulse(120)
    f.spring.impulse(120)
    assert.equal(f.output, 0)
    assert.equal(f.spring.position, 0)
    assert.equal(f.frames.size, 1)
  }
  assert.equal(standard.spring.velocity, 240)
  assert.equal(heavy.spring.velocity, 120)
  standard.spring.impulse(1000, 400)
  assert.equal(standard.spring.velocity, 400)
})

test('an impulse between frames samples the current trajectory across different refresh rates', () => {
  const states = [60, 120, 144].map(hz => {
    const f = fixture()
    f.spring.impulse(240)
    f.advance(40, hz)
    const painted = f.output
    f.elapse(7)
    f.spring.impulse(120)
    assert.equal(f.output, painted, 'input must leave rendering to the animation frame')
    assert.equal(f.frames.size, 1)
    f.advance(123, hz)
    return [f.spring.position, f.spring.velocity]
  })
  for (const state of states.slice(1)) {
    assert.ok(Math.abs(state[0] - states[0][0]) < 1e-8)
    assert.ok(Math.abs(state[1] - states[0][1]) < 1e-8)
  }
})

test('under, critical and overdamped motion all settle exactly and stop scheduling frames', () => {
  for (const dampingRatio of [.6, 1, 1.4]) {
    const f = fixture({ dampingRatio })
    f.spring.hold(-48, -180)
    f.spring.release()
    f.advance(4000)
    assert.equal(f.spring.position, 0)
    assert.equal(f.spring.velocity, 0)
    assert.equal(f.frames.size, 0)
  }
})

test('catching and disposing a release stops old frames from overwriting a new held position', () => {
  const f = fixture()
  f.spring.hold(32, 180)
  f.spring.release()
  f.advance(50)
  f.spring.hold(16)
  f.advance(200)
  assert.equal(f.output, 16)
  f.spring.release()
  f.page.dispose()
  const stopped = f.output
  f.advance(200)
  assert.equal(f.output, stopped)
  assert.equal(f.frames.size, 0)
})
