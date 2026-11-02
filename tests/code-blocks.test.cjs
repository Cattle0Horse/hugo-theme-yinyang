const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { test } = require('node:test')

test('code defaults render before JavaScript and explicit fence line numbers override either default', () => {
  const theme = path.resolve(__dirname, '..')
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yinyang-code-'))
  try {
    fs.mkdirSync(path.join(fixture, 'content/posts'), { recursive: true })
    const fence = (options = '') => '```go ' + options + '\npackage main\nfunc main() {}\n```\n\n'
    fs.writeFileSync(path.join(fixture, 'content/posts/code.md'),
      '---\ntitle: Code\n---\n\n' + fence() + fence('{linenos=false}') + fence('{linenos=table hl_lines=[2]}') +
      '```\n<plain> & text\n```\n')
    for (const setting of [undefined, false, true]) {
      const enabled = setting === true
      fs.writeFileSync(path.join(fixture, 'hugo.toml'), 'baseURL = "https://example.org/"\n' + (setting === undefined ? '' : `
[params.codeBlock]
lineNumbers = ${enabled}
wrap = ${enabled}
`))
      execFileSync('hugo', ['-s', fixture, '--themesDir', path.dirname(theme), '--theme', path.basename(theme), '--noBuildLock'], { stdio: 'pipe' })
      const html = fs.readFileSync(path.join(fixture, 'public/posts/code/index.html'), 'utf8')
      const states = [...html.matchAll(/data-line-numbers="(true|false)" data-wrap="(true|false)"/g)]
        .map(m => [m[1] === 'true', m[2] === 'true'])
      assert.deepEqual(states, [[enabled, enabled], [false, enabled], [true, enabled], [enabled, enabled]])
      const buttons = [...html.matchAll(/data-code-toggle="(numbers|wrap)"[^>]*aria-pressed="(true|false)"/g)]
        .map(m => m[2] === 'true')
      assert.deepEqual(buttons, states.flat())
      assert.match(html, /&lt;plain&gt;/)
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})
