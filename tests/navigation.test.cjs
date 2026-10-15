const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function flush() {
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve))
}

function navigationFixture({ math = true, analytics = false } = {}) {
  const timers = new Map()
  const ready = []
  const font = deferred()
  const observers = new Set()
  const animationFrame = callback => setImmediate(callback)
  let fontRequested = false
  let sequence = 0
  class Element extends EventTarget {
    constructor(attributes = {}) {
      super()
      this.attributes = new Map(Object.entries(attributes))
      this.style = {}
      this.children = []
      const classes = new Set()
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name)
      }
    }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    setAttribute(name, value) { this.attributes.set(name, value) }
    hasAttribute(name) { return this.attributes.has(name) }
    removeAttribute(name) { this.attributes.delete(name) }
    querySelectorAll(selector) { return selector === '.katex-html' ? this.children : [] }
    querySelector() { return null }
    append() {}
    appendChild(node) { this.children.push(node) }
    remove() { this.removed = true }
    cloneNode() { return new Element(Object.fromEntries(this.attributes)) }
    getBoundingClientRect() { return { left: 0, top: 100, width: 800 } }
    isEqualNode(other) { return JSON.stringify([...this.attributes]) === JSON.stringify([...other.attributes]) }
  }
  const location = {
    href: 'https://example.test/', origin: 'https://example.test',
    assign() { assert.fail('Unexpected full navigation') },
    replace() { assert.fail('Unexpected full navigation') }
  }
  const history = {
    state: null,
    replaceState(state, _, url) { this.state = state; location.href = String(url) },
    pushState(state, _, url) { this.state = state; location.href = String(url) }
  }
  const runtimeScript = Object.assign(new Element(), { textContent: 'runtime' })
  const bundleScript = new Element({ src: '/bundle.js' })
  const heading = Object.assign(new Element(), { focus() {} })
  const article = new Element()
  const shell = new Element()
  const countContainer = new Element()
  const countValue = Object.assign(new Element(), { textContent: '' })
  const analyticsScript = {
    src: '/stats.js', attributes: [{ name: 'src', value: '/stats.js' }],
    getAttribute: () => '/stats.js', textContent: ''
  }
  const document = Object.assign(new EventTarget(), {
    documentElement: new Element(), baseURI: location.href,
    createElement: () => new Element(),
    fonts: { load() { fontRequested = true; return font.promise } },
    createTreeWalker() {
      let read = false
      return { nextNode() {
        if (read) return null
        read = true
        return { textContent: 'x', parentElement: new Element() }
      } }
    }
  })
  const head = Object.assign(new Element(), {
    children: [],
    appendChild(node) { this.children.push(node) },
    querySelectorAll() { return this.children },
    querySelector() { return null }
  })
  function body() {
    return Object.assign(new Element(), {
      querySelector(selector) { return selector === '.app-scroll > article' ? article : null },
      querySelectorAll(selector) {
        if (selector !== '.katex' || !math) return []
        return [Object.assign(new Element(), { parentElement: new Element() })]
      },
      replaceWith(next) { document.body = next }
    })
  }
  document.head = head
  document.body = body()
  const originalBody = document.body
  document.getElementById = id => {
    if (!analytics || document.body === originalBody || countContainer.removed) return null
    if (id === 'busuanzi_container_page_pv') return countContainer
    if (id === 'busuanzi_value_page_pv') return countValue
    return null
  }
  document.querySelector = selector => {
    if (selector === '.app-shell') return shell
    if (selector === '[data-page-math]') return head.children.find(node => node.hasAttribute('data-page-math'))
    if (selector === 'script[data-yinyang-runtime]') return runtimeScript
    if (selector === 'script[data-yinyang-navigation]') return bundleScript
    if (selector === '.app-scroll > article') return article
    if (selector === '.app-scroll h1, .app-scroll h2') return heading
    return null
  }
  document.querySelectorAll = selector => selector === '.katex-html' && math ? [new Element()] : []
  const next = {
    body: body(), documentElement: { lang: 'zh' },
    head: {
      querySelector(selector) {
        if (selector === '[data-page-math]' && math) return new Element({ 'data-page-head': '', 'data-page-math': '', href: '/math.css' })
        if (selector === 'script[data-page-analytics]' && analytics) return analyticsScript
        return null
      },
      querySelectorAll: () => math ? [new Element({ 'data-page-head': '', 'data-page-math': '', href: '/math.css' })] : []
    },
    getElementById: () => new Element(),
    querySelector(selector) {
      if (selector === '.app-shell #appScroll') return shell
      return document.querySelector(selector)
    }
  }
  let restoredHash = null
  function createPage() {
    const cleanups = new Set()
    return {
      active: true, dispose() { this.active = false; cleanups.forEach(callback => callback()) }, listen() {},
      addCleanup(callback) { cleanups.add(callback); return () => cleanups.delete(callback) },
      requestAnimationFrame: animationFrame,
      onMotionEnd(node, options, callback) { callback() },
      scroll: {
        capture: () => ({ top: 0 }), onChange() {},
        element: () => ({ scrollTo() {} }), restore() {},
        target: hash => hash,
        scrollToElement(hash) { restoredHash = hash }
      }
    }
  }
  const lifecycle = { createPage, page: createPage(), mount() { return this.page } }
  const window = Object.assign(new EventTarget(), {
    yinyangRuntime: lifecycle, fetch: true, AbortController, scrollTo() {}
  })
  document.addEventListener('yinyang:page-ready', event => ready.push(event.detail.url))
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/navigation.js'), 'utf8'), {
    window, document, location, history, URL, AbortController,
    DOMParser: class { parseFromString() { return next } },
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: class {
      constructor(callback) { this.callback = callback }
      observe() { observers.add(this) }
      disconnect() { observers.delete(this) }
    },
    getComputedStyle: () => ({ fontStyle: 'normal', fontWeight: '400', fontSize: '16px', fontFamily: 'KaTeX_Math' }),
    fetch: async url => ({ ok: true, url, headers: { get: () => 'text/html' }, text: async () => '' }),
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options.detail } },
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: animationFrame
  })
  return {
    ready, font, article, shell, document, window, location, originalBody,
    publishCount(value) {
      if (countContainer.removed) return
      countValue.textContent = value
      observers.forEach(observer => observer.callback())
    },
    get stylesheet() { return head.children[0] },
    get fontRequested() { return fontRequested },
    get restoredHash() { return restoredHash },
    async navigate(href = '/math/') {
      await flush()
      ready.length = 0
      const link = Object.assign(new Element({ href }), {
        closest: selector => selector === 'a[href]' ? link : null
      })
      const event = new Event('click', { cancelable: true })
      Object.defineProperties(event, { button: { value: 0 }, target: { value: link } })
      document.dispatchEvent(event)
      await flush()
    },
    expire(delay) {
      for (const [id, timer] of [...timers]) {
        if (delay !== undefined && timer.delay !== delay) continue
        timers.delete(id)
        timer.callback()
      }
    }
  }
}

test('navigation retains the current document and URL until formula CSS and fonts are ready', async () => {
  const fixture = navigationFixture()
  await fixture.navigate('/math/#chemistry')
  assert.deepEqual(fixture.ready, [])
  assert.equal(fixture.document.body, fixture.originalBody)
  assert.equal(fixture.location.href, 'https://example.test/')
  assert.equal(fixture.fontRequested, false)
  fixture.stylesheet.sheet = {}
  fixture.stylesheet.dispatchEvent(new Event('load'))
  await flush()
  assert.equal(fixture.fontRequested, true)
  assert.equal(fixture.document.body, fixture.originalBody)
  assert.equal(fixture.location.href, 'https://example.test/')
  assert.deepEqual(fixture.ready, [])
  fixture.font.resolve([])
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/math/#chemistry'])
  assert.equal(fixture.restoredHash, '#chemistry')
  assert.notEqual(fixture.document.body, fixture.originalBody)
  assert.equal(fixture.shell.hasAttribute('aria-busy'), false)
})

test('math stylesheet failure and stalled font downloads do not leave an empty article', async () => {
  for (const failure of ['stylesheet', 'stylesheet-timeout', 'font-timeout']) {
    const fixture = navigationFixture()
    await fixture.navigate()
    if (failure === 'stylesheet') fixture.stylesheet.dispatchEvent(new Event('error'))
    else if (failure === 'font-timeout') {
      fixture.stylesheet.sheet = {}
      fixture.stylesheet.dispatchEvent(new Event('load'))
      await flush()
      fixture.expire()
    }
    else fixture.expire()
    await flush()
    assert.deepEqual(fixture.ready, ['https://example.test/math/'])
    assert.notEqual(fixture.document.body, fixture.originalBody)
    assert.equal(fixture.shell.hasAttribute('aria-busy'), false)
  }
})

test('pages without formulas do not wait for font downloads', async () => {
  const fixture = navigationFixture({ math: false })
  await fixture.navigate()
  assert.deepEqual(fixture.ready, ['https://example.test/math/'])
  assert.equal(fixture.fontRequested, false)
})

test('an action on the current page cancels preparation and prevents a late navigation', async () => {
  const fixture = navigationFixture()
  await fixture.navigate()
  const stylesheet = fixture.stylesheet
  fixture.window.yinyangNavigation.pushHash('#current-section')
  stylesheet.dispatchEvent(new Event('load'))
  fixture.font.resolve([])
  await flush()
  assert.equal(fixture.document.body, fixture.originalBody)
  assert.equal(fixture.location.href, 'https://example.test/#current-section')
  assert.equal(fixture.fontRequested, false)
})

test('the new view becomes ready with its reading count', async () => {
  const fixture = navigationFixture({ math: false, analytics: true })
  await fixture.navigate()
  assert.deepEqual(fixture.ready, [], 'Loading the statistics script is not the same as receiving the count')
  fixture.publishCount('42')
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/math/'])
  assert.equal(fixture.document.getElementById('busuanzi_value_page_pv').textContent, '42')
})

test('unavailable statistics do not block the new view or pop into it after the timeout', async () => {
  const fixture = navigationFixture({ math: false, analytics: true })
  await fixture.navigate()
  fixture.expire()
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/math/'])
  fixture.publishCount('42')
  assert.equal(fixture.document.getElementById('busuanzi_container_page_pv'), null)
})

test('an anchor action during the statistics wait reveals the article and retains the requested destination', async () => {
  const fixture = navigationFixture({ math: false, analytics: true })
  await fixture.navigate()
  fixture.window.yinyangNavigation.pushHash('#current-section')
  await flush()
  assert.equal(fixture.article.classList.contains('page-preparing'), false)
  fixture.publishCount('42')
  await flush()
  assert.equal(fixture.restoredHash, '#current-section')
  assert.deepEqual(fixture.ready, ['https://example.test/math/#current-section'])
})
