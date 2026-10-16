function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="terminal"]')) return
  var find = tools.find
  var listen = tools.listen
  var openArticle = tools.openArticle
  var articles = tools.articles
  var hint = "路径不存在，好奇心仍可执行。"
  tools.say(hint)
  var input = find('input')
  var output = find('.nf-terminal-output')
  function line(text, article) {
    var node = document.createElement(article ? 'a' : 'p')
    node.textContent = text
    if (article) node.href = article.url
    output.appendChild(node)
    while (output.children.length > 12) output.firstElementChild.remove()
    output.scrollTop = output.scrollHeight
  }
  listen(find('form'), 'submit', function (event) {
    event.preventDefault()
    var entered = input.value.trim()
    input.value = ''
    if (!entered) return
    var words = entered.split(/\s+/)
    var command = words.shift().toLowerCase()
    if (command === 'clear') { output.replaceChildren(); return }
    line('❯ ' + entered)
    if (command === 'home') find('.nf-terminal-home').click()
    else if (command === 'cd') {
      if (words.length > 1) line('cd: too many arguments')
      else if (!words.length || ['~', '~/', '/'].includes(words[0])) find('.nf-terminal-home').click()
      else line('cd: no such directory: ' + words[0])
    } else if (command === 'pwd') line(new URL(find('.nf-terminal-home').href, location.href).pathname)
    else if (command === 'help') line('cd / cd ~ 回家 · pwd 当前目录\nls 文章列表 · clear 清屏\nhome 回家 · random 随机文章')
    else if (command === 'ls') {
      if (!articles.length) line('这里还没有文章，试试 home。')
      articles.slice(0, 4).forEach(function (article) { line('↗ ' + article.title, article) })
    } else if (command === 'random') {
      if (articles.length) openArticle(articles[Math.floor(Math.random() * articles.length)])
      else line('还没有文章可以探索，试试 home。')
    } else if (command === 'sudo') line('好奇心不需要管理员权限。')
    else if (command === '404') line('你找到了：没找到。')
    else line('command not found，试试 help。')
  })
}
