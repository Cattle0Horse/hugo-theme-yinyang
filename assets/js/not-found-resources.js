;(function (runtime) {
  var scenes = runtime.notFoundScenes = {}
  var scripts = new Map()

  function loadScript(name, src) {
    if (scripts.has(src)) return scripts.get(src)
    var previous = scenes[name]
    var request = new Promise(function (resolve) {
      var script = document.createElement('script')
      var timer = setTimeout(finish, 8000)
      function finish() {
        clearTimeout(timer)
        script.onload = script.onerror = null
        script.remove()
        var scene = scenes[name] !== previous ? scenes[name] : null
        if (!scene) scripts.delete(src)
        resolve(scene)
      }
      script.src = src
      script.onload = script.onerror = finish
      document.head.appendChild(script)
    })
    scripts.set(src, request)
    return request
  }

  runtime.loadNotFound = function (page, template) {
    var name = template.getAttribute('data-nf-template')
    var css = template.getAttribute('data-nf-css')
    var src = template.getAttribute('data-nf-js')
    if (!css || !src) return Promise.resolve(null)
    return new Promise(function (resolve) {
      var stylesheet = document.createElement('link')
      var scene = null
      var styled = false
      var finished = false
      var timer = page.setTimeout(finish, 8000)
      var stopCleanup = page.addCleanup(finish)
      function finish() {
        if (finished) return
        finished = true
        page.clearTimeout(timer)
        stopCleanup()
        stylesheet.onload = stylesheet.onerror = null
        if (!page.active || !styled || !scene) {
          stylesheet.remove()
          resolve(null)
          return
        }
        resolve({ scene: scene, stylesheet: stylesheet })
      }
      stylesheet.rel = 'stylesheet'
      stylesheet.href = css
      stylesheet.setAttribute('data-page-head', '')
      stylesheet.onload = function () { styled = true; if (scene) finish() }
      stylesheet.onerror = finish
      loadScript(name, src).then(function (loaded) {
        scene = loaded
        if (!scene || styled) finish()
      })
      document.head.appendChild(stylesheet)
    })
  }
})(window.yinyangRuntime)
