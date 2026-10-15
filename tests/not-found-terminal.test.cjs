const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function terminal() {
  let initialize
  let destination = null
  const input = { value: '' }
  const output = {
    children: [],
    appendChild(node) { this.children.push(node) },
    replaceChildren() { this.children = [] }
  }
  const form = new EventTarget()
  const home = { href: 'https://example.test/sub/', click() { destination = this.href } }
  const elements = { input, form, '.nf-terminal-output': output, '.nf-terminal-home': home }
  const context = {
    window: { yinyangRuntime: { register(name, callback) { initialize = callback } } },
    document: { createElement: () => ({ textContent: '' }) },
    URL, location: { href: 'https://example.test/sub/missing/' }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/not-found/terminal.js'), 'utf8'), context)
  initialize({ notFound: {
    scene: { querySelector: () => ({}) }, find: name => elements[name],
    listen: (node, type, listener) => node.addEventListener(type, listener),
    say() {}, openArticle(article) { destination = article.url }, articles: []
  } })
  return {
    output,
    get destination() { return destination },
    submit(text) { input.value = text; form.dispatchEvent(new Event('submit', { cancelable: true })) }
  }
}

test('terminal cd accepts default home, tilde and surrounding or separating whitespace', () => {
  for (const text of ['cd', ' cd ~ ', '\tcd\t~/  ', '  cd   /\t']) {
    const shell = terminal()
    shell.submit(text)
    assert.equal(shell.destination, 'https://example.test/sub/', text)
  }
})

test('terminal reports its site directory and rejects unknown directories without navigating', () => {
  const shell = terminal()
  shell.submit('  pwd  ')
  assert.equal(shell.output.children.at(-1).textContent, '/sub/')
  shell.submit('cd /missing')
  assert.equal(shell.destination, null)
  assert.match(shell.output.children.at(-1).textContent, /no such directory.*\/missing/)
  shell.submit('cd ~ extra')
  assert.equal(shell.destination, null)
  assert.match(shell.output.children.at(-1).textContent, /too many arguments/)
  shell.submit(' clear ')
  assert.equal(shell.output.children.length, 0)
  shell.submit(' \t ')
  assert.equal(shell.output.children.length, 0)
})
