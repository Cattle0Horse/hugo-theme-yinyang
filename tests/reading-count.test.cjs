const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

function fixture(initialCount = '') {
  const initializers = []
  const observers = []
  const classes = new Set()
  const value = { textContent: initialCount }
  const container = {
    isConnected: true,
    classList: { add(name) { classes.add(name) } }
  }
  const runtime = {
    register(name, initialize) { initializers.push(initialize) },
    requestAnimationFrame(callback) { setImmediate(callback) },
    addCleanup() {}
  }
  const context = {
    window: { yinyangRuntime: runtime, MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
    } },
    MutationObserver: null,
    document: {
      getElementById(id) {
        return id === 'busuanzi_container_page_pv' ? container : value
      }
    }
  }
  context.MutationObserver = context.window.MutationObserver
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/reading-count.js'), 'utf8'), context)
  initializers[0](runtime)
  return {
    value,
    classes,
    publish(text) {
      value.textContent = text
      observers.forEach(observer => observer.callback())
    }
  }
}

test('initial and asynchronously returned reading counts fade in after the current page is mounted', async () => {
  for (const initialCount of ['', '42']) {
    const state = fixture(initialCount)
    assert.equal(state.classes.has('is-visible'), false)
    if (!initialCount) state.publish('42')
    assert.equal(state.classes.has('is-visible'), false)
    await flush()
    assert.equal(state.classes.has('is-visible'), true)
  }
})
