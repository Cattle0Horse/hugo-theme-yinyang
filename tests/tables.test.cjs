const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function createFixture() {
  const listeners = []
  const cleanups = []
  const bound = []
  const classes = new Set()
  const button = { dataset: {}, setAttribute(name, value) { this[name] = value } }
  const region = {
    scrollWidth: 120, clientWidth: 100, setAttribute() {}, removeAttribute() {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) }
  }
  const hint = { hidden: true }
  const tools = { querySelector: selector => selector === '[data-copy-table]' ? button : null }
  const wrapper = { querySelector(selector) {
    return selector === '.table-scroll' ? region : selector === '.table-scroll-hint' ? hint : null
  } }
  const table = {
    rows: [
      { cells: [{ textContent: ' Name | first ', getAttribute: () => 'text-align: left' }, { textContent: 'Value\nwith spaces', getAttribute: () => 'text-align: center' }] },
      { cells: [{ textContent: 'A', getAttribute: () => '' }, { textContent: '', getAttribute: () => '' }] }
    ],
    querySelector: selector => selector === '.table-tools' ? tools : null,
    closest: selector => selector === '.highlight' ? null : wrapper
  }
  const runtime = {
    config: {},
    bindCopyButton: (target, text, options) => bound.push({ target, text, options }),
    listen: (target, type, handler) => listeners.push({ target, type, handler }),
    addCleanup: callback => cleanups.push(callback)
  }
  let initialize
  const context = {
    window: { yinyangRuntime: { register(name, callback) { initialize = callback; callback(runtime) } } },
    document: { querySelectorAll: () => [table] }
  }
  for (const file of ['ui-helpers.js', 'tables.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context)
  }
  const click = listeners.find(listener => listener.target === context.document && listener.type === 'click').handler
  return {
    button, bound, initialize, runtime,
    click: inside => click({ target: { closest: selector => inside && selector === '.table-scroll' ? region : null } }),
    isActive: () => classes.has('is-floating-actions-active'),
    dispose: () => cleanups.forEach(callback => callback())
  }
}

test('table copy serializes cells and alignment as Markdown', () => {
  const fixture = createFixture()
  assert.equal(fixture.bound.length, 1)
  assert.equal(fixture.bound[0].text, '| Name \\| first | Value with spaces |\n| :--- | :---: |\n| A |  |')
  assert.equal(fixture.bound[0].options.defaultLabel, '复制表格')
})

test('tapping a table reveals its actions until the next outside tap or page disposal', () => {
  const fixture = createFixture()
  fixture.click(true)
  assert.equal(fixture.isActive(), true)
  fixture.click(false)
  assert.equal(fixture.isActive(), false)
  fixture.click(true)
  fixture.dispose()
  assert.equal(fixture.isActive(), false)
})

test('table copy controls are not rebound when initialization sees the same table again', () => {
  const fixture = createFixture()
  fixture.initialize(fixture.runtime)
  assert.equal(fixture.button.dataset.tableCopyBound, 'true')
  assert.equal(fixture.bound.length, 1)
})
