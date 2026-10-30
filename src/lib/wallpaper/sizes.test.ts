import { describe, expect, it } from 'vitest'
import { clampSize, DEFAULT_SIZE, detectSize, PRESETS } from './sizes'

describe('DEFAULT_SIZE and PRESETS', () => {
  it('defaults to 1170 by 2532', () => {
    expect(DEFAULT_SIZE).toEqual({ width: 1170, height: 2532 })
  })

  it('lists portrait presets that are all inside the allowed size', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6)
    for (const preset of PRESETS) {
      expect(preset.height).toBeGreaterThan(preset.width)
      expect(clampSize(preset)).toEqual({ width: preset.width, height: preset.height })
    }
    expect(PRESETS.some((p) => p.width === 1170 && p.height === 2532)).toBe(true)
  })
})

describe('detectSize', () => {
  it('multiplies the screen size by the pixel ratio on a phone', () => {
    expect(detectSize({ screenWidth: 390, screenHeight: 844, pixelRatio: 3, coarsePointer: true })).toEqual({ width: 1170, height: 2532 })
  })

  it('swaps a landscape reading back to portrait', () => {
    expect(detectSize({ screenWidth: 844, screenHeight: 390, pixelRatio: 3, coarsePointer: true })).toEqual({ width: 1170, height: 2532 })
  })

  it('returns null on a desktop', () => {
    expect(detectSize({ screenWidth: 1920, screenHeight: 1080, pixelRatio: 1, coarsePointer: false })).toBeNull()
  })
})

describe('clampSize', () => {
  it('raises tiny sides to 320', () => {
    expect(clampSize({ width: 100, height: 100 })).toEqual({ width: 320, height: 320 })
  })

  it('caps each side at 4000 and the area at 16,000,000 pixels', () => {
    const size = clampSize({ width: 99999, height: 99999 })
    expect(size.width).toBeLessThanOrEqual(4000)
    expect(size.width * size.height).toBeLessThanOrEqual(16_000_000)
  })

  it('leaves a valid size alone and rounds fractions', () => {
    expect(clampSize({ width: 1080, height: 2400 })).toEqual({ width: 1080, height: 2400 })
    expect(clampSize({ width: 1080.4, height: 2399.6 })).toEqual({ width: 1080, height: 2400 })
  })

  it('falls back to the default for values that are not numbers', () => {
    expect(clampSize({ width: Number.NaN, height: Number.NaN })).toEqual(DEFAULT_SIZE)
  })
})
