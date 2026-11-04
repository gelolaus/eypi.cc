import { describe, expect, it } from 'vitest'
import { ALPHA_CUTOFF, findTransparentRegions } from './detectWindows'

const W = 100
const H = 180

function opaque(width = W, height = H, alpha = 255) {
  const buf = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = 10
    buf[i * 4 + 1] = 20
    buf[i * 4 + 2] = 30
    buf[i * 4 + 3] = alpha
  }
  return buf
}

function cut(buf: Uint8ClampedArray, width: number, x: number, y: number, w: number, h: number, alpha = 0) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) buf[(yy * width + xx) * 4 + 3] = alpha
  }
}

describe('findTransparentRegions', () => {
  it('finds 3 separate windows', () => {
    const buf = opaque()
    cut(buf, W, 10, 10, 80, 40)
    cut(buf, W, 10, 70, 80, 40)
    cut(buf, W, 10, 130, 80, 40)
    expect(findTransparentRegions(buf, W, H)).toEqual([
      { x: 10, y: 10, w: 80, h: 40 },
      { x: 10, y: 70, w: 80, h: 40 },
      { x: 10, y: 130, w: 80, h: 40 },
    ])
  })

  it('finds 2 windows when two are merged by a transparent bridge', () => {
    const buf = opaque()
    cut(buf, W, 10, 10, 80, 40)
    cut(buf, W, 10, 70, 80, 40)
    cut(buf, W, 40, 50, 10, 20)
    cut(buf, W, 10, 130, 80, 40)
    const found = findTransparentRegions(buf, W, H)
    expect(found).toHaveLength(2)
    expect(found[0]).toEqual({ x: 10, y: 10, w: 80, h: 100 })
  })

  it('finds 4 windows', () => {
    const buf = opaque()
    cut(buf, W, 10, 5, 80, 30)
    cut(buf, W, 10, 50, 80, 30)
    cut(buf, W, 10, 95, 80, 30)
    cut(buf, W, 10, 140, 80, 30)
    expect(findTransparentRegions(buf, W, H)).toHaveLength(4)
  })

  it('ignores a speck under 1% of the area', () => {
    const buf = opaque()
    cut(buf, W, 10, 10, 80, 40)
    cut(buf, W, 5, 100, 5, 5)
    expect(findTransparentRegions(buf, W, H)).toEqual([{ x: 10, y: 10, w: 80, h: 40 }])
  })

  it('ignores a soft shadow whose alpha is at or above the cutoff', () => {
    const buf = opaque()
    cut(buf, W, 10, 10, 80, 40)
    cut(buf, W, 10, 70, 80, 40, ALPHA_CUTOFF)
    expect(findTransparentRegions(buf, W, H)).toEqual([{ x: 10, y: 10, w: 80, h: 40 }])
  })

  it('uses the bounding box of a window with rounded corners', () => {
    const buf = opaque()
    cut(buf, W, 10, 10, 80, 40)
    for (const [x, y] of [[10, 10], [89, 10], [10, 49], [89, 49]]) buf[(y * W + x) * 4 + 3] = 255
    expect(findTransparentRegions(buf, W, H)).toEqual([{ x: 10, y: 10, w: 80, h: 40 }])
  })

  it('counts a transparent outer margin as a region', () => {
    const buf = opaque()
    cut(buf, W, 0, 0, W, 10)
    cut(buf, W, 10, 40, 80, 40)
    const found = findTransparentRegions(buf, W, H)
    expect(found).toHaveLength(2)
    expect(found[0]).toEqual({ x: 0, y: 0, w: W, h: 10 })
  })

  it('returns windows sorted top to bottom', () => {
    const buf = opaque()
    cut(buf, W, 10, 130, 80, 40)
    cut(buf, W, 10, 10, 80, 40)
    cut(buf, W, 10, 70, 80, 40)
    expect(findTransparentRegions(buf, W, H).map((r) => r.y)).toEqual([10, 70, 130])
  })

  it('handles a fully opaque image', () => {
    expect(findTransparentRegions(opaque(), W, H)).toEqual([])
  })

  it('handles a fully transparent image', () => {
    expect(findTransparentRegions(opaque(W, H, 0), W, H)).toEqual([{ x: 0, y: 0, w: W, h: H }])
  })

  it('handles a full-size 1080x1920 transparent image quickly', () => {
    const found = findTransparentRegions(opaque(1080, 1920, 0), 1080, 1920)
    expect(found).toEqual([{ x: 0, y: 0, w: 1080, h: 1920 }])
  })
})
