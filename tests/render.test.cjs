const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { test, before, after } = require('node:test')

const theme = path.resolve(__dirname, '..')
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yinyang-render-'))
const output = path.join(fixture, 'public')
function write(name, content) {
  const file = path.join(fixture, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
function html(name) { return fs.readFileSync(path.join(output, name), 'utf8') }

before(() => {
  write('config.toml', `baseURL = "https://example.org/sub/"
locale = "zh-cn"
title = "Fixture"
[taxonomies]
tag = "tags"
note_tag = "note_tags"
[permalinks.term]
tags = "/topics/:slug/"
note_tags = "/notes/tags/:slug/"
[permalinks.taxonomy]
note_tags = "/notes/tags/"
[params]
mainSections = ["posts"]
tableOfContents = true
favicon = "/logo.png"
[params.author]
name = "Fixture author"
[params.actions]
enabled = true
copyMarkdown = true
[params.aiLabel]
enabled = false
[markup.goldmark.renderer]
unsafe = true
[markup.goldmark.extensions.footnote]
enableAutoIDPrefix = true
[markup.goldmark.extensions.passthrough]
enable = true
[markup.goldmark.extensions.passthrough.delimiters]
block = [["$$", "$$"]]
inline = [["$", "$"]]
`)
  write('content/notes/_index.md', '---\ntitle: Notes\n---\n')
  for (let i = 1; i <= 31; i++) {
    const form = i === 2 ? '\n<label id="caption" for="email">Email</label><input id="email" name="email" aria-labelledby="caption external" aria-describedby="caption"><a name="legacy"></a><a href="#legacy">legacy target</a><a href="#appScroll">page target</a>\n' : ''
    write(`content/notes/2026-08/${String(i).padStart(3, '0')}.md`, `---\ndate: 2026-08-01T12:00:${String(i).padStart(2, '0')}+08:00\nnote_tags: [math]\n---\n\n## Same heading\n\nReference[^1].\n\n[^1]: Footnote ${i}\n\n${i === 1 ? '$x^2$' : ''}${form}`)
  }
  write('content/posts/old.md', '---\ntitle: old\ndate: 2026-08-01\nlastmod: 2026-08-02\ntoc: false\ntags: [topic]\nai: assisted\nalbum: ["/a.png", "https://cdn.example.org/b.png"]\n---\n\n## Heading\n\nBody\n')
  write('content/posts/new.md', '---\ntitle: new\ndate: 2026-08-01\ntoc: true\n---\n\n## Heading\n\nBody\n')
  execFileSync('hugo', ['-s', fixture, '--themesDir', path.dirname(theme), '--theme', path.basename(theme), '--destination', output, '--cacheDir', path.join(fixture, 'cache'), '--noBuildLock'], { stdio: 'pipe' })
})

after(() => {
  assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()))
  fs.rmSync(fixture, { recursive: true, force: true })
})

test('Notes and tag pagination load math styles for the displayed notes', () => {
  for (const route of ['notes', 'notes/tags/math']) {
    const first = html(`${route}/index.html`)
    const second = html(`${route}/page/2/index.html`)
    assert.equal(first.includes('class="katex"'), false)
    assert.equal(first.includes('@font-face'), false)
    assert.equal(second.includes('class="katex"'), true)
    assert.equal(second.includes('@font-face'), true)
  }
})

test('aggregated Notes preserve unique anchors, footnote targets and HTML references', () => {
  const page = html('notes/index.html')
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
  const names = [...page.matchAll(/<a\b[^>]*\bname="([^"]+)"/g)].map(match => match[1])
  for (const match of page.matchAll(/\bhref="#([^"]+)"/g)) assert.ok(ids.includes(match[1]) || names.includes(match[1]), `Unresolved fragment ${match[1]}`)
  const caption = page.match(/<label id="([^"]+)" for="([^"]+)"/)
  const input = page.match(/<input id="([^"]+)" name="([^"]+)" aria-labelledby="([^"]+)" aria-describedby="([^"]+)"/)
  assert.ok(caption && input)
  assert.equal(caption[2], input[1])
  assert.equal(input[2], 'email')
  assert.equal(input[3], `${caption[1]} external`)
  assert.equal(input[4], caption[1])
  assert.ok(page.includes('href="#appScroll"'))
  const detail = html('notes/2026-08/002/index.html')
  assert.ok(detail.includes('id="same-heading"'))
  assert.ok(detail.includes('id="email" name="email"'))
})

test('TOC and disabled AI settings retain their configuration contract', () => {
  const old = html('posts/old/index.html')
  assert.equal(old.includes('id="tocSidebar"'), false)
  assert.equal(old.includes('class="ai-label"'), false)
  assert.equal(old.includes('id="copy-markdown-btn"'), true)
  assert.equal(old.includes('id="edit-page-btn"'), false)
  assert.equal(html('posts/new/index.html').includes('id="tocSidebar"'), true)
})

test('metadata and links support subdirectory deployment and custom taxonomy URLs', () => {
  const post = html('posts/old/index.html')
  const images = [...post.matchAll(/property="og:image" content="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(images, ['https://example.org/sub/a.png', 'https://cdn.example.org/b.png'])
  assert.ok(post.includes('href="/sub/topics/topic/"'))
  assert.ok(post.includes('href="/sub/"'))
  const schema = JSON.parse(post.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])
  assert.equal(schema['@type'], 'BlogPosting')
  assert.equal(schema.mainEntityOfPage['@id'], 'https://example.org/sub/posts/old/')
  assert.ok(schema.dateModified.startsWith('2026-08-02'))
  const collection = JSON.parse(html('notes/index.html').match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])
  assert.equal(collection['@type'], 'CollectionPage')
})
