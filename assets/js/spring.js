;(function () {
  // Solve m*x'' + c*x' + k*x = 0 in real seconds. Sampling the closed-form
  // solution keeps release motion identical at 60, 120, and 144 Hz.
  window.yinyangRuntime.createSpring = function (page, render, options) {
    var frequency = Math.sqrt(options.stiffness / options.mass)
    var ratio = options.dampingRatio
    var position = 0
    var velocity = 0
    var frame = 0
    var start = 0
    var x = 0
    var v = 0
    function cancel() { page.cancelAnimationFrame(frame); frame = 0 }
    function hold(value, speed) {
      cancel()
      position = value
      velocity = speed || 0
      render(position)
    }
    function reset() { hold(0, 0) }
    function sample(time) {
      var t = Math.max(0, (time - start) / 1000)
      var decay = frequency * ratio
      if (ratio < 1) {
        var damped = frequency * Math.sqrt(1 - ratio * ratio)
        var exponential = Math.exp(-decay * t)
        var cosine = Math.cos(damped * t)
        var sine = Math.sin(damped * t)
        position = exponential * (x * cosine + (v + decay * x) / damped * sine)
        velocity = exponential * (v * cosine - (decay * v + frequency * frequency * x) / damped * sine)
      } else if (ratio === 1) {
        var coefficient = v + frequency * x
        var exponential = Math.exp(-frequency * t)
        position = exponential * (x + coefficient * t)
        velocity = exponential * (v - frequency * coefficient * t)
      } else {
        var root = frequency * Math.sqrt(ratio * ratio - 1)
        var slow = -decay + root
        var fast = -decay - root
        var a = (v - fast * x) / (slow - fast)
        var b = x - a
        position = a * Math.exp(slow * t) + b * Math.exp(fast * t)
        velocity = a * slow * Math.exp(slow * t) + b * fast * Math.exp(fast * t)
      }
    }
    function tick(time) {
      frame = 0
      sample(time)
      if (Math.abs(position) < .05 && Math.abs(velocity) < 3) { reset(); return }
      render(position)
      frame = page.requestAnimationFrame(tick)
    }
    function startMotion(time) {
      start = time
      x = position
      v = velocity
      if (!frame && (position || velocity)) frame = page.requestAnimationFrame(tick)
    }
    function release(speed) {
      var now = performance.now()
      if (frame) sample(now)
      cancel()
      if (speed != null) velocity = speed
      startMotion(now)
    }
    function impulse(momentum, maxSpeed) {
      var now = performance.now()
      if (frame) sample(now)
      velocity += momentum / options.mass
      if (maxSpeed != null) velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity))
      startMotion(now)
    }
    page.addCleanup(cancel)
    return { get position() { return position }, get velocity() { return velocity }, hold: hold, release: release, impulse: impulse, reset: reset }
  }
})()
