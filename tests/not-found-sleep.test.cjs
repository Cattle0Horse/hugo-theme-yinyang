const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function sleepingFace() {
  let initialize
  let now = 0
  let feedback = ''
  let timerId = 0
  const timers = new Map()
  const motions = []
  const document = new EventTarget()
  const play = new EventTarget()
  const home = new EventTarget()
  const classes = new Set()
  play.classList = {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    contains: name => classes.has(name)
  }
  play.setAttribute = () => {}
  const elements = { '.nf-play': play, '.nf-sleep-face': {}, '.nf-sleep-home': home, '.nf-eye-open': {}, '.nf-dreams': {} }
  const context = {
    window: { yinyangRuntime: { register(name, callback) { initialize = callback } }, matchMedia: () => ({ matches: false }) },
    document, performance: { now: () => now }, getComputedStyle: () => ({ transform: 'none', scale: '1 1' })
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/not-found/sleep.js'), 'utf8'), context)
  initialize({
    clearTimeout: id => timers.delete(id), setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
    notFound: {
      scene: { querySelector: () => ({}) }, find: selector => elements[selector],
      listen: (node, type, handler) => node.addEventListener(type, handler),
      activate: (node, handler) => node.addEventListener('click', handler),
      say(text) { feedback = text }, emit() {}, follow() {},
      animate(node, frames, options, callback) {
        const motion = { callback, cancelled: false }
        motions.push(motion)
        return () => { motion.cancelled = true }
      }
    }
  })
  return {
    get awake() { return classes.has('nf-awake') },
    get feedback() { return feedback },
    move(x, y, elapsed = 16) {
      now += elapsed
      const event = new Event('pointermove')
      Object.assign(event, { clientX: x, clientY: y })
      document.dispatchEvent(event)
    },
    click() { play.dispatchEvent(new Event('click')) },
    startNap() {
      document.dispatchEvent(new Event('pointerleave'))
      now += 1800
      const pending = [...timers.values()]
      timers.clear()
      pending.forEach(callback => callback())
    },
    finishMotion() {
      while (motions.length) {
        const motion = motions.shift()
        if (!motion.cancelled && motion.callback) motion.callback()
      }
    }
  }
}

test('minor pointer jitter leaves the face asleep until the pointer travels a meaningful distance', () => {
  const face = sleepingFace()
  assert.equal(face.awake, false)
  for (let i = 0; i < 40; i++) face.move(100 + i % 4, 200 + i % 3)
  assert.equal(face.awake, false)
  face.move(150, 200)
  assert.equal(face.awake, true)
})

test('clicking wakes the face without requiring pointer travel', () => {
  const face = sleepingFace()
  face.click()
  assert.equal(face.awake, true)
})

test('waking by pointer motion replaces the feedback from sleeping', () => {
  const face = sleepingFace()
  face.move(100, 100)
  face.move(150, 100)
  face.startNap()
  face.finishMotion()
  assert.equal(face.awake, false)
  const asleepFeedback = face.feedback
  face.move(152, 100)
  assert.equal(face.feedback, asleepFeedback)
  face.move(200, 100)
  assert.equal(face.awake, true)
  assert.notEqual(face.feedback, asleepFeedback)
})

test('waking during the closing animation prevents late sleep feedback', () => {
  const face = sleepingFace()
  face.move(100, 100)
  face.move(150, 100)
  face.startNap()
  face.move(210, 100)
  const awakeFeedback = face.feedback
  face.finishMotion()
  assert.equal(face.awake, true)
  assert.equal(face.feedback, awakeFeedback)
})
