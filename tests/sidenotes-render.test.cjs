const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

test('minified Post and Notes output preserves crossing sidenotes, links, page resources and raw source', t => {
  const theme = path.resolve(__dirname, '..')
  const temp = fs.realpathSync(os.tmpdir())
  const site = fs.mkdtempSync(path.join(temp, 'yinyang-sidenotes-'))
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(site)), temp)
    fs.rmSync(site, { recursive: true, force: true })
  })
  function write(name, source) {
    const file = path.join(site, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, source)
  }
  function output(name) {
    return fs.readFileSync(path.join(site, 'public', name), 'utf8')
  }
  write('hugo.toml', `baseURL = "https://example.org/sub/"
title = "Fixture"
[outputs]
page = ["HTML", "Markdown"]
[params]
mainSections = ["posts"]
tableOfContents = true
[markup.goldmark.extensions.passthrough]
enable = true
[markup.goldmark.extensions.passthrough.delimiters]
inline = [["$", "$"]]
[markup.goldmark.renderer]
unsafe = false
`)
  write('layouts/shortcodes/fixture.html', '<span data-fixture>Shortcode output</span>')
  const body = [
    '## Target',
    '',
    '<!-- sidenote:1 -->**First** [over<!-- sidenote:2 -->lap](#target)<!-- /sidenote:1 --> tail<!-- /sidenote:2 -->.',
    '',
    'Ordinary footnote[^ref] and {{< fixture >}}.',
    '',
    'See [中文](#中文).',
    '',
    '## 中文',
    '',
    '[^ref]: Ordinary definition.',
    '',
    '`<!-- sidenote:72 -->`',
    '',
    '```markdown',
    '<!-- sidenote:73 -->',
    '```',
    '',
    '<!-- sidenote:1',
    '### Target',
    '',
    'Supplement **bold** and $x^2$.',
    '',
    '![Diagram](./diagram.svg)',
    '-->',
    '',
    '<!-- sidenote:2',
    'Second supplement.',
    '-->',
    '',
    'Keep <!-- sidenote:90 -->unclosed text.',
    '',
    'Keep <!-- sidenote:91 -->duplicate<!-- sidenote:91 --> marker text<!-- /sidenote:91 -->.',
    '',
    '<!-- sidenote:90',
    'Unclosed supplement.',
    '-->',
    '',
    '<!-- sidenote:91',
    'Duplicate supplement.',
    '-->',
    ''
  ].join('\n')
  const post = '---\ntitle: Post\ndate: 2026-08-01\n---\n\n' + body
  write('content/notes/_index.md', '---\ntitle: Notes\n---\n')
  for (const [route, source] of [['posts/sample', post], ['notes/first', post], ['notes/second', post]]) {
    write('content/' + route + '/index.md', source)
    write('content/' + route + '/diagram.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path d="M0 0h40v20H0z"/></svg>')
  }
  const result = spawnSync('hugo', ['-s', site, '--themesDir', path.dirname(theme), '--theme', path.basename(theme),
    '--cacheDir', path.join(site, 'cache'), '--noBuildLock', '--minify'], { encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  const buildLog = result.stdout + result.stderr
  assert.doesNotMatch(buildLog, /sidenote:(?:72|73) requires/)
  assert.match(buildLog, /\/posts\/sample: sidenote:90 requires/)
  assert.match(buildLog, /\/posts\/sample: sidenote:91 requires/)
  for (const route of ['posts/sample', 'notes/first', 'notes/second']) {
    const html = output(route + '/index.html')
    const start = id => new RegExp('data-sidenote-start=(?:"' + id + '"|' + id + ')[ >]')
    const end = id => new RegExp('data-sidenote-end=(?:"' + id + '"|' + id + ')[ >]')
    const positions = [start(1), start(2), end(1), end(2)].map(marker => html.search(marker))
    assert.ok(positions[0] >= 0 && positions.every((position, index) => index === 0 || position > positions[index - 1]),
      html.match(/<h2[^>]*id="?target[\s\S]{0,500}/)?.[0])
    assert.match(html, /<strong>First<\/strong>/)
    assert.match(html, /<a href=(?:"#target"|#target)>over<span[^>]*data-sidenote-start=(?:"2"|2)><\/span>lap<\/a>/)
    assert.match(html, /Supplement <strong>bold<\/strong>/)
    assert.match(html, /id=(?:"sidenote-1-target"|sidenote-1-target)[ >]/)
    assert.ok(html.includes('/sub/' + route + '/diagram.svg'))
    assert.match(html, /data-page-math/)
    assert.match(html, /data-fixture[^>]*>Shortcode output/)
    assert.match(html, /role=(?:"doc-noteref"|doc-noteref)/)
    assert.doesNotMatch(html, /data-sidenote-start=(?:"7[23]"|7[23])[ >]/)
    assert.match(html, /Keep unclosed text\./)
    assert.match(html, /Keep duplicate marker text\./)
    assert.doesNotMatch(html, /Unclosed supplement\.|Duplicate supplement\./)
    assert.deepEqual(output(route + '/index.md'), post)
  }
  const timeline = output('notes/index.html')
  assert.equal((timeline.match(/data-sidenote=(?:"1"|1)[ >]/g) || []).length, 2)
  assert.match(timeline, /href=(?:"#note-[a-f\d]+-target"|#note-[a-f\d]+-target)/)
  assert.match(timeline, /href=(?:"#note-[a-f\d]+-中文"|#note-[a-f\d]+-中文)/)
  assert.match(timeline, /data-page-math/)
})
