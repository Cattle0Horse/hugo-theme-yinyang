const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

test('a navigation snapshot preserves reading while a breakpoint transfer is pending', () => {
  const frames = new Map()
  let sequence = 0
  const wide = Object.assign(new EventTarget(), { matches: true })
  const window = Object.assign(new EventTarget(), {
    innerHeight: 900, scrollY: 1000, scrollX: 0,
    matchMedia: () => wide,
    scrollTo(options) { this.scrollY = options.top; this.scrollX = options.left || 0 }
  })
  const app = Object.assign(new EventTarget(), {
    scrollTop: 0, scrollLeft: 0, scrollHeight: 2400, clientHeight: 800,
    getBoundingClientRect: () => ({ top: 0, bottom: 800 }),
    scrollTo(options) { this.scrollTop = options.top; this.scrollLeft = options.left || 0 },
    contains: node => node === heading
  })
  const heading = {
    parentElement: app,
    closest() { return this },
    getBoundingClientRect() {
      // Reflow adds 300px above the same heading in the narrower layout.
      const top = wide.matches ? 1064 - window.scrollY : 1364 - app.scrollTop
      return { top, height: 40 }
    }
  }
  app.children = [heading]
  const document = {
    documentElement: { scrollHeight: 2400, classList: { contains: () => false } },
    getElementById: () => app,
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, width: 700 }) }),
    elementFromPoint(x, y) {
      const top = heading.getBoundingClientRect().top
      return y >= top && y < top + 40 ? heading : null
    }
  }
  const context = {
    window, document, console,
    setTimeout, clearTimeout,
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id },
    cancelAnimationFrame: id => frames.delete(id)
  }
  for (const file of ['page-runtime.js', 'scroll.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context)
  }
  const page = window.yinyangRuntime.page
  const scroll = window.yinyangRuntime.createScroll(page)
  const reading = scroll.capture()
  assert.equal(reading.anchorTop, 64)
  wide.matches = false
  assert.equal(scroll.capture().anchorTop, 64, 'CSS reflow before the mode event must not replace the anchor')
  wide.dispatchEvent(new Event('change'))
  assert.equal(scroll.capture().top, 1000, 'navigation before the transfer frame must retain the prior snapshot')
  while (frames.size) {
    const callbacks = Array.from(frames.values())
    frames.clear()
    callbacks.forEach(callback => callback())
  }
  assert.equal(app.scrollTop, 1300)
  assert.equal(heading.getBoundingClientRect().top, 64)
  assert.equal(scroll.capture().wide, false)
  page.dispose()
})
