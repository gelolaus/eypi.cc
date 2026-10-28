// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDpCanvas } from './useDpCanvas'

function setup(enabled = true) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1200
  const api = useDpCanvas(ref(canvas), { isEnabled: () => enabled })
  return api
}

function key(k: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: k, cancelable: true, ...init })
  const spy = vi.spyOn(e, 'preventDefault')
  return { e, spy }
}

describe('useDpCanvas keyboard', () => {
  it('arrow keys nudge the offset', () => {
    const c = setup()
    for (const [k, x, y] of [['ArrowRight', 10, 0], ['ArrowDown', 10, 10], ['ArrowLeft', 0, 10], ['ArrowUp', 0, 0]] as const) {
      const { e, spy } = key(k)
      c.onKeydown(e)
      expect(spy).toHaveBeenCalled()
      expect([c.offsetX.value, c.offsetY.value]).toEqual([x, y])
    }
  })

  it('shift arrow nudges farther', () => {
    const c = setup()
    c.onKeydown(key('ArrowRight', { shiftKey: true }).e)
    expect(c.offsetX.value).toBe(40)
  })

  it('plus and minus change scale within limits', () => {
    const c = setup()
    c.onKeydown(key('+').e)
    expect(c.scale.value).toBeCloseTo(1.1)
    c.onKeydown(key('=').e)
    expect(c.scale.value).toBeCloseTo(1.21)
    c.onKeydown(key('-').e)
    expect(c.scale.value).toBeCloseTo(1.1)
    for (let i = 0; i < 60; i++) c.onKeydown(key('+').e)
    expect(c.scale.value).toBe(8)
    for (let i = 0; i < 80; i++) c.onKeydown(key('-').e)
    expect(c.scale.value).toBe(0.2)
  })

  it('zooms about the canvas centre', () => {
    const c = setup()
    c.nudge(100, 50)
    c.zoomBy(2)
    expect([c.offsetX.value, c.offsetY.value, c.scale.value]).toEqual([200, 100, 2])
  })

  it('unhandled keys are not prevented', () => {
    const c = setup()
    const { e, spy } = key('Tab')
    c.onKeydown(e)
    expect(spy).not.toHaveBeenCalled()
    expect(c.offsetX.value).toBe(0)
  })

  it('modifier combos are not prevented', () => {
    const c = setup()
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      for (const k of ['-', '+', '0', 'ArrowLeft']) {
        const { e, spy } = key(k, init)
        c.onKeydown(e)
        expect(spy).not.toHaveBeenCalled()
      }
    }
    expect(c.scale.value).toBe(1)
    expect(c.offsetX.value).toBe(0)
  })

  it('reset key centres and resets zoom', () => {
    const c = setup()
    c.nudge(30, 30)
    c.zoomBy(2)
    const { e, spy } = key('0')
    c.onKeydown(e)
    expect(spy).toHaveBeenCalled()
    expect([c.offsetX.value, c.offsetY.value, c.scale.value]).toEqual([0, 0, 1])
  })

  it('does nothing while disabled', () => {
    const c = setup(false)
    const { e, spy } = key('ArrowRight')
    c.onKeydown(e)
    expect(spy).not.toHaveBeenCalled()
    expect(c.offsetX.value).toBe(0)
  })
})
