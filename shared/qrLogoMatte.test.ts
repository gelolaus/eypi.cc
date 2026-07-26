import { describe, it, expect } from 'vitest'
import {
  colorsClose,
  knockOutEdgeConnectedBackground,
  shouldSampleAsBackgroundCorner,
} from './qrLogoMatte'

describe('colorsClose', () => {
  it('matches near-identical colors', () => {
    expect(colorsClose(0, 0, 0, 5, 5, 5, 24)).toBe(true)
    expect(colorsClose(255, 255, 255, 250, 252, 248, 24)).toBe(true)
  })

  it('rejects distant colors', () => {
    expect(colorsClose(0, 0, 0, 255, 255, 255, 24)).toBe(false)
    expect(colorsClose(0xde, 0xac, 0x4b, 0, 0, 0, 24)).toBe(false)
  })
})

describe('shouldSampleAsBackgroundCorner', () => {
  it('ignores transparent corners', () => {
    expect(shouldSampleAsBackgroundCorner(0)).toBe(false)
    expect(shouldSampleAsBackgroundCorner(10)).toBe(false)
  })

  it('uses opaque corners', () => {
    expect(shouldSampleAsBackgroundCorner(255)).toBe(true)
    expect(shouldSampleAsBackgroundCorner(200)).toBe(true)
  })
})

describe('knockOutEdgeConnectedBackground', () => {
  it('removes edge-connected white but keeps enclosed white', () => {
    // 5x5: white border, black ring, white center pixel
    const w = 5
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
        const innerRing = x === 1 || y === 1 || x === w - 2 || y === h - 2
        if (edge) {
          data[i] = data[i + 1] = data[i + 2] = 255
        } else if (innerRing) {
          data[i] = data[i + 1] = data[i + 2] = 0
        } else {
          data[i] = data[i + 1] = data[i + 2] = 255
        }
        data[i + 3] = 255
      }
    }

    knockOutEdgeConnectedBackground(data, w, h)

    // corner was white edge → transparent
    expect(data[3]).toBe(0)
    // center white enclosed by black → still opaque
    const center = (2 * w + 2) * 4
    expect(data[center + 3]).toBe(255)
    expect(data[center]).toBe(255)
  })
})
