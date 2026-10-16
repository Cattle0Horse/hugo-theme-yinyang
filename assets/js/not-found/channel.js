function initialize(page) {
  var tools = page.notFound
  if (!tools || !tools.scene.querySelector('[data-nf-scene="channel"]')) return
  var tuner = tools.find('input')
  var station = tools.find('.nf-station')
  var radio = tools.find('.nf-radio-field')
  var frequencyLabel = tools.find('.nf-frequency')
  var knob = tools.find('.nf-knob')
  var needle = tools.find('.nf-tuner-needle')
  var home = tools.find('.nf-channel-home')
  var stations = tools.articles.slice(0, 5)
  tools.say('转动频率，听听别的故事。')
  function tune() {
    var frequency = Number(tuner.value)
    frequencyLabel.textContent = frequency.toFixed(1) + ' MHz'
    knob.style.transform = 'rotate(' + ((frequency - 98) * 14) + 'deg)'
    needle.style.transform = 'translateX(' + ((frequency - 98) * 10) + 'px)'
    if (frequency >= 107.4) {
      radio.classList.remove('nf-noise')
      station.hidden = true
      home.classList.add('nf-channel-tuned-home')
      tools.say('到家频道，随时欢迎回来。')
      return
    }
    home.classList.remove('nf-channel-tuned-home')
    var stationIndex = Math.round((frequency - 90) / 4)
    var clear = stationIndex >= 0 && stationIndex < stations.length && Math.abs(frequency - (90 + stationIndex * 4)) <= .6
    radio.classList.toggle('nf-noise', !clear)
    station.hidden = !clear
    if (clear) {
      station.textContent = '♫ ' + stations[stationIndex].title + ' ↗'
      station.href = stations[stationIndex].url
      tools.say('信号清晰。有一个故事在等你。')
    } else tools.say(stations.length ? '沙沙……再往旁边调一点。' : '电台还没有故事，先回家看看吧。')
  }
  tools.listen(tuner, 'input', tune)
  // The illustration's dial is draggable; the native range also supports keyboard input.
  tools.drag(knob, function () {}, function (p) {
    var angle = Math.atan2(p.x - 453, 226 - p.y) * 180 / Math.PI
    tuner.value = Math.max(88, Math.min(108, 98 + angle / 14))
    tune()
  }, function () {})
  tune()
}
