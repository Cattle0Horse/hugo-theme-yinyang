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

function navigationFixture({ math = true, analytics = false, leaving404 = false, oldStyles = false, target404 = false, withFooter = false, sharedTransition = false, transitionFails = false } = {}) {
  const timers = new Map()
  const ready = []
  const font = deferred()
  const scene = deferred()
  const observers = new Set()
  const motions = []
  const initializers = []
  const sharedFinished = deferred()
  let sharedStarted = false
  let sharedSkipped = false
  const animationFrame = callback => setImmediate(callback)
  let fontRequested = false
  let sequence = 0
  class Element extends EventTarget {
    constructor(attributes = {}, tagName = 'DIV') {
      super()
      this.tagName = tagName
      this.attributes = new Map(Object.entries(attributes))
      this.style = {}
      this.children = []
      this.scrollLeft = 0
      this.scrollTop = 0
      const classes = new Set((attributes.class || '').split(/\s+/))
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name)
      }
    }
    get type() { return this.getAttribute('type') || '' }
    get nextElementSibling() {
      if (!this.parentNode) return null
      const siblings = this.parentNode.children
      return siblings[siblings.indexOf(this) + 1] || null
    }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    contains(node) { return this === node || this.children.some(child => child.contains(node)) }
    scrollTo(options) { this.scrollLeft = options.left; this.scrollTop = options.top }
    setAttribute(name, value) { this.attributes.set(name, value) }
    hasAttribute(name) { return this.attributes.has(name) }
    removeAttribute(name) { this.attributes.delete(name) }
    querySelectorAll(selector) {
      if (selector === '.katex-html') return this.children
      return this.children.flatMap(node => {
        let matches
        if (selector === '*') matches = true
        else if (selector.startsWith('#')) matches = node.getAttribute('id') === selector.slice(1)
        else if (selector.startsWith('.')) matches = node.classList.contains(selector.slice(1))
        else if (/^\[[\w-]+\]$/.test(selector)) matches = node.hasAttribute(selector.slice(1, -1))
        else matches = node.tagName.toLowerCase() === selector
        return [...(matches ? [node] : []), ...node.querySelectorAll(selector)]
      })
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
    append() {}
    appendChild(node) { this.children.push(node); node.parentNode = this }
    remove() {
      this.removed = true
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this)
    }
    cloneNode(deep) {
      const clone = new Element(Object.fromEntries(this.attributes), this.tagName)
      clone.textContent = this.textContent
      if (this.content) clone.content = this.content.cloneNode(true)
      if (deep) this.children.forEach(node => clone.appendChild(node.cloneNode(true)))
      return clone
    }
    getBoundingClientRect() { return { left: 0, top: 100, bottom: 200, width: 800 } }
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
  const originalFooter = withFooter ? Object.assign(new Element({}, 'FOOTER'), { textContent: 'Previous footer' }) : null
  const footer = withFooter ? Object.assign(new Element({}, 'FOOTER'), { textContent: 'New footer' }) : null
  const shell = new Element()
  const countContainer = new Element()
  const countValue = Object.assign(new Element(), { textContent: '' })
  const analyticsScript = {
    src: '/stats.js', attributes: [{ name: 'src', value: '/stats.js' }],
    getAttribute: () => '/stats.js', textContent: ''
  }
  const document = Object.assign(new EventTarget(), {
    documentElement: new Element(), baseURI: location.href,
    createElement: tag => new Element({}, tag.toUpperCase()),
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
  const head = new Element()
  const previousStyle = new Element({ 'data-page-head': '' }, 'STYLE')
  const previousStylesheet = new Element({ 'data-page-head': '', rel: 'stylesheet', href: '/old.css' }, 'LINK')
  const previousTitle = new Element({ 'data-page-head': '' }, 'TITLE')
  if (oldStyles) [previousStyle, previousStylesheet, previousTitle].forEach(node => head.appendChild(node))
  function body(content, footer) {
    const node = Object.assign(new Element(), {
      querySelector(selector) {
        return selector === '.app-scroll > article' ? content : Element.prototype.querySelector.call(this, selector)
      },
      querySelectorAll(selector) {
        if (selector === '.katex' && math) return [Object.assign(new Element(), { parentElement: new Element() })]
        return Element.prototype.querySelectorAll.call(this, selector)
      },
      replaceWith(next) { document.body = next }
    })
    const scroll = new Element({ class: 'app-scroll' })
    scroll.appendChild(content)
    if (footer) scroll.appendChild(footer)
    node.appendChild(scroll)
    return node
  }
  const originalArticle = new Element(leaving404 ? { 'data-not-found': '' } : {})
  const sharedTargets = []
  if (sharedTransition) {
    article.setAttribute('data-transition-page', '/post/')
    for (const kind of ['title', 'time']) {
      const attributes = { ['data-transition-' + kind]: '/post/' }
      originalArticle.appendChild(new Element(attributes))
      const target = new Element(attributes)
      article.appendChild(target)
      sharedTargets.push(target)
    }
  }
  if (leaving404) {
    const template = new Element({ 'data-nf-template': 'cat', 'data-nf-devices': 'mobile desktop' }, 'TEMPLATE')
    for (const node of [template, new Element({ class: 'nf-scene' }), new Element({ class: 'nf-fallback' })]) originalArticle.appendChild(node)
  }
  document.head = head
  document.body = body(originalArticle, originalFooter)
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
    if (selector === '.app-scroll > article') return document.body.querySelector(selector)
    if (selector === '.app-scroll h1, .app-scroll h2') return heading
    return document.body.querySelector(selector)
  }
  document.querySelectorAll = selector => selector === '.katex-html' && math ? [new Element()] : []
  const next = {
    body: body(article, footer), documentElement: { lang: 'zh' },
    head: {
      querySelector(selector) {
        if (selector === '[data-page-math]' && math) return new Element({ 'data-page-head': '', 'data-page-math': '', href: '/math.css' }, 'LINK')
        if (selector === 'script[data-page-analytics]' && analytics) return analyticsScript
        return null
      },
      querySelectorAll: () => math ? [new Element({ 'data-page-head': '', 'data-page-math': '', href: '/math.css' }, 'LINK')] : []
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
      active: true, dispose() { this.active = false; cleanups.forEach(callback => callback()) },
      listen(target, type, handler, options) {
        target.addEventListener(type, handler, options)
        const stop = () => target.removeEventListener(type, handler, options)
        cleanups.add(stop)
        return () => { stop(); cleanups.delete(stop) }
      },
      guard(callback) { return (...args) => { if (this.active) return callback(...args) } },
      addCleanup(callback) { cleanups.add(callback); return () => cleanups.delete(callback) },
      requestAnimationFrame: animationFrame,
      onMotionEnd(node, options, callback) { motions.push(callback) },
      scroll: {
        capture: () => ({ top: 0 }), onChange() {},
        viewport: () => ({ top: 0, bottom: 800 }),
        element: () => ({ scrollTo() {} }), restore() {},
        target: hash => hash,
        scrollToElement(hash) { restoredHash = hash }
      }
    }
  }
  const lifecycle = {
    createPage, page: createPage(), loadNotFound: () => Promise.resolve(null),
    register(name, initialize) { initializers.push(initialize) },
    mount() {
      initializers.forEach(initialize => initialize(this.page))
      if (target404 && document.body !== originalBody) this.page.notFoundReady = scene.promise
      return this.page
    }
  }
  const window = Object.assign(new EventTarget(), {
    yinyangRuntime: lifecycle, fetch: true, AbortController, scrollTo() {}, matchMedia: () => ({ matches: false })
  })
  if (sharedTransition) document.startViewTransition = update => {
    if (transitionFails) throw new Error('Transition unavailable')
    sharedStarted = true
    const updateCallbackDone = Promise.resolve().then(update)
    return {
      updateCallbackDone, ready: updateCallbackDone, finished: sharedFinished.promise,
      skipTransition() { sharedSkipped = true; sharedFinished.resolve() }
    }
  }
  document.addEventListener('yinyang:page-ready', event => ready.push(event.detail.url))
  const context = {
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
  }
  for (const filename of ['not-found.js', 'navigation.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js', filename), 'utf8'), context)
  }
  return {
    ready, font, scene, article, shell, document, window, location, originalBody, lifecycle,
    previousStyle, previousStylesheet, previousTitle,
    sharedTargets, sharedFinished,
    get sharedStarted() { return sharedStarted },
    get sharedSkipped() { return sharedSkipped },
    finishTransition() { motions.splice(0).forEach(callback => callback()) },
    publishCount(value) {
      if (countContainer.removed) return
      countValue.textContent = value
      observers.forEach(observer => observer.callback())
    },
    get stylesheet() { return head.querySelector('[data-page-math]') },
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

test('the outgoing view retains its footer through the statistics wait and fade', async () => {
  const fixture = navigationFixture({ math: false, analytics: true, withFooter: true })
  await fixture.navigate('/post/')
  const cover = fixture.document.body.children.find(node => node.className === 'navigation-outgoing')
  assert.equal(cover.querySelector('footer').textContent, 'Previous footer')
  fixture.publishCount('42')
  await flush()
  assert.equal(cover.removed, undefined)
  fixture.finishTransition()
  assert.equal(cover.removed, true)
  assert.equal(fixture.document.body.querySelector('footer').textContent, 'New footer')
})

test('the outgoing view retains nested horizontal and vertical scroll positions', async () => {
  const fixture = navigationFixture({ math: false, analytics: true })
  const original = fixture.originalBody.querySelector('.app-scroll > article')
  original.scrollLeft = 17
  const region = new original.constructor({ class: 'table-scroll' })
  region.scrollLeft = 180
  region.scrollTop = 32
  original.appendChild(region)
  await fixture.navigate('/post/')
  const cover = fixture.document.body.children.find(node => node.className === 'navigation-outgoing')
  const copy = cover.querySelector('.table-scroll')
  assert.equal(cover.children[0].scrollLeft, 17)
  assert.equal(copy.scrollLeft, 180)
  assert.equal(copy.scrollTop, 32)
  fixture.expire()
  await flush()
  fixture.finishTransition()
  assert.equal(cover.removed, true)
})

test('reading input finishes the entrance immediately and releases the outgoing page resources', async () => {
  for (const type of ['pointerdown', 'wheel', 'touchmove', 'keydown']) {
    const fixture = navigationFixture({ math: false, oldStyles: true })
    await fixture.navigate('/post/')
    const cover = fixture.document.body.children.find(node => node.className === 'navigation-outgoing')
    assert.equal(cover.removed, undefined)
    assert.equal(fixture.previousStylesheet.removed, undefined)
    assert.deepEqual(fixture.ready, ['https://example.test/post/'])
    fixture.document.dispatchEvent(new Event(type))
    assert.equal(cover.removed, true)
    assert.equal(fixture.previousStylesheet.removed, true)
    fixture.finishTransition()
    assert.deepEqual(fixture.ready, ['https://example.test/post/'])
  }
})

test('shared element capture starts only after formula and visible reading count preparation', async () => {
  const fixture = navigationFixture({ sharedTransition: true, analytics: true, oldStyles: true })
  await fixture.navigate('/post/')
  assert.equal(fixture.sharedStarted, false)
  assert.equal(fixture.document.body, fixture.originalBody)
  fixture.stylesheet.dispatchEvent(new Event('load'))
  fixture.font.resolve([])
  await flush()
  assert.equal(fixture.sharedStarted, false)
  fixture.publishCount('42')
  await flush()
  assert.equal(fixture.sharedStarted, true)
  assert.deepEqual(fixture.ready, ['https://example.test/post/'])
  fixture.sharedFinished.resolve()
  await flush()
  assert.equal(fixture.sharedTargets.every(node => !node.style.viewTransitionName), true)
  assert.equal(fixture.document.documentElement.classList.contains('navigation-sharing'), false)
  fixture.finishTransition()
  assert.equal(fixture.previousStylesheet.removed, true)
})

test('reading input skips shared snapshots and leaves the destination immediately usable', async () => {
  const fixture = navigationFixture({ math: false, sharedTransition: true, oldStyles: true })
  await fixture.navigate('/post/')
  assert.equal(fixture.sharedStarted, true)
  fixture.document.dispatchEvent(new Event('wheel'))
  await flush()
  assert.equal(fixture.sharedSkipped, true)
  assert.equal(fixture.sharedTargets.every(node => !node.style.viewTransitionName), true)
  assert.equal(fixture.previousStylesheet.removed, true)
  assert.equal(fixture.location.href, 'https://example.test/post/')
})

test('a browser that rejects shared capture still completes navigation and releases resources', async () => {
  const fixture = navigationFixture({ math: false, sharedTransition: true, transitionFails: true, oldStyles: true })
  await fixture.navigate('/post/')
  assert.deepEqual(fixture.ready, ['https://example.test/post/'])
  assert.equal(fixture.sharedTargets.every(node => !node.style.viewTransitionName), true)
  assert.equal(fixture.document.documentElement.classList.contains('navigation-sharing'), false)
  fixture.finishTransition()
  assert.equal(fixture.previousStylesheet.removed, true)
})

test('an anchor action reveals the new footer and removes its outgoing copy immediately', async () => {
  const fixture = navigationFixture({ math: false, analytics: true, withFooter: true })
  await fixture.navigate('/post/')
  const cover = fixture.document.body.children.find(node => node.className === 'navigation-outgoing')
  fixture.window.yinyangNavigation.pushHash('#section')
  assert.equal(cover.removed, true)
  assert.equal(fixture.article.classList.contains('page-preparing'), false)
  assert.equal(fixture.document.body.querySelector('footer').textContent, 'New footer')
  fixture.publishCount('42')
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/post/#section'])
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

test('leaving a 404 mounts the destination without reinitializing the outgoing scene', async () => {
  const fixture = navigationFixture({ math: false, leaving404: true })
  await fixture.navigate('/home/')
  assert.deepEqual(fixture.ready, ['https://example.test/home/'])
  assert.notEqual(fixture.document.body, fixture.originalBody)
  assert.equal(fixture.lifecycle.page.notFound, undefined)
})

test('entering a 404 waits for its scene before restoring reading and announcing readiness', async () => {
  const fixture = navigationFixture({ math: false, target404: true })
  await fixture.navigate('/missing/')
  assert.deepEqual(fixture.ready, [])
  fixture.scene.resolve()
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/missing/'])
})

test('an anchor selected while a 404 scene loads retains its destination', async () => {
  const fixture = navigationFixture({ math: false, target404: true })
  await fixture.navigate('/missing/')
  fixture.window.yinyangNavigation.pushHash('#section')
  fixture.scene.resolve()
  await flush()
  assert.equal(fixture.restoredHash, '#section')
  assert.deepEqual(fixture.ready, ['https://example.test/missing/#section'])
})

test('outgoing styles survive the statistics wait and fade, while old metadata is removed immediately', async () => {
  const fixture = navigationFixture({ math: false, analytics: true, oldStyles: true })
  await fixture.navigate('/plain/')
  assert.ok(fixture.document.head.children.includes(fixture.previousStyle))
  assert.ok(fixture.document.head.children.includes(fixture.previousStylesheet))
  assert.equal(fixture.previousTitle.removed, true)
  fixture.publishCount('42')
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/plain/'])
  assert.ok(fixture.document.head.children.includes(fixture.previousStyle))
  assert.ok(fixture.document.head.children.includes(fixture.previousStylesheet))
  fixture.finishTransition()
  assert.equal(fixture.previousStyle.removed, true)
  assert.equal(fixture.previousStylesheet.removed, true)
})

test('revealing the destination during initialization also releases outgoing styles', async () => {
  const fixture = navigationFixture({ math: false, analytics: true, oldStyles: true })
  await fixture.navigate('/plain/')
  fixture.window.yinyangNavigation.pushHash('#section')
  assert.equal(fixture.previousStyle.removed, true)
  assert.equal(fixture.previousStylesheet.removed, true)
  fixture.publishCount('42')
  await flush()
  assert.deepEqual(fixture.ready, ['https://example.test/plain/#section'])
})

test('disposing a destination during its fade releases outgoing styles', async () => {
  const fixture = navigationFixture({ math: false, oldStyles: true })
  await fixture.navigate('/plain/')
  fixture.lifecycle.page.dispose()
  assert.equal(fixture.previousStyle.removed, true)
  assert.equal(fixture.previousStylesheet.removed, true)
  fixture.finishTransition()
})

test('navigation without a fade removes obsolete styles at commit', async () => {
  const fixture = navigationFixture({ math: false, oldStyles: true })
  await fixture.navigate('/plain/#section')
  assert.deepEqual(fixture.ready, ['https://example.test/plain/#section'])
  assert.equal(fixture.previousStyle.removed, true)
  assert.equal(fixture.previousStylesheet.removed, true)
})
