;(function (runtime) {
  runtime.register('not-found', function (page) {
    var root = document.querySelector('[data-not-found]')
    if (!root) return
    var device = window.matchMedia('(max-width: 600px)').matches ? 'mobile' : 'desktop'
    var templates = Array.from(root.querySelectorAll('[data-nf-template]')).filter(function (template) {
      var devices = template.getAttribute('data-nf-devices') || ''
      return devices.split(/\s+/).indexOf(device) !== -1
    })
    if (!templates.length) {
      root.removeAttribute('data-nf-pending')
      return
    }
    var template = templates[Math.floor(Math.random() * templates.length)]
    page.notFoundReady = runtime.loadNotFound(page, template).then(function (assets) {
      if (!page.active) {
        if (assets) assets.stylesheet.remove()
        return
      }
      if (assets) {
        try { assets.scene.mount(page, root, template.getAttribute('data-nf-template'), assets.scene) } catch (error) {
          assets.stylesheet.remove()
          root.querySelector('.nf-scene').replaceChildren()
          delete page.notFound
        }
      }
      root.removeAttribute('data-nf-pending')
    })
  })
})(window.yinyangRuntime)
