const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

function fixture() {
  const runtime = {}
  const window = {
    innerWidth: 390, innerHeight: 844,
    yinyangRuntime: { register(name, initialize) { initialize(runtime) } }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/ui-helpers.js'), 'utf8'), {
    window, document: {}, getComputedStyle: node => ({ scale: String(node.scale) })
  })
  return { runtime, window }
}

function button(left = 200, top = 10) {
  return {
    scale: 1,
    getBoundingClientRect() {
      return { left: left + 22 * (1 - this.scale), top: top + 22 * (1 - this.scale), width: 44 * this.scale, height: 44 * this.scale }
    }
  }
}

function layer(width = 180, height = 44) {
  return { style: {}, offsetWidth: width, offsetHeight: height }
}

test('menu gaps stay stable while the trigger is pressed and the menu is entering', () => {
  const { runtime } = fixture()
  const trigger = button()
  const palette = layer()
  const navigation = layer(160, 240)
  // Translated/scaled visual bounds are deliberately not available on the layer.
  for (const scale of [1, .9, .82]) {
    trigger.scale = scale
    runtime.positionFloating(palette, trigger, 'start')
    runtime.positionFloating(navigation, trigger, 'end')
    assert.equal(parseFloat(palette.style.top) - 54, 8)
    assert.equal(parseFloat(navigation.style.top) - 54, 8)
    assert.equal(parseFloat(navigation.style.left) + 160, 244)
  }
})

test('tooltip arrows and menus keep the same visible gap above or below their triggers', () => {
  const { runtime } = fixture()
  for (const top of [10, 740]) {
    const trigger = button(200, top)
    const menu = layer(160, 100)
    const tooltip = layer(140, 28)
    const menuPlacement = runtime.positionFloating(menu, trigger, 'start')
    const tooltipPlacement = runtime.positionFloating(tooltip, trigger, 'center', 4)
    assert.equal(menuPlacement.below, top === 10)
    assert.equal(tooltipPlacement.below, top === 10)
    const gap = (node, arrow, below) => below
      ? parseFloat(node.style.top) - arrow - (top + 44)
      : top - (parseFloat(node.style.top) + node.offsetHeight + arrow)
    assert.equal(gap(menu, 0, menuPlacement.below), 8)
    assert.equal(gap(tooltip, 4, tooltipPlacement.below), 8)
  }
})

test('floating layers stay inside a narrow viewport while their arrow tracks the trigger', () => {
  const { runtime } = fixture()
  for (const left of [0, 340]) {
    const trigger = button(left)
    const tooltip = layer(160, 28)
    const placement = runtime.positionFloating(tooltip, trigger, 'center', 4)
    const x = parseFloat(tooltip.style.left)
    assert.ok(x >= 8 && x + tooltip.offsetWidth <= 382)
    assert.equal(x + placement.anchorX, left + 22)
  }
})
