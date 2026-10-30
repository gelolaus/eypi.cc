import { describe, expect, it } from 'vitest'
import { clampSize, DEFAULT_SIZE, detectSize, PRESETS } from './sizes'

describe('PRESETS sizes', () => {
  it('has one entry per pixel size so the size select can show the chosen one', () => {
    const sizes = PRESETS.map((p) => `${p.width}x${p.height}`)
    expect(new Set(sizes).size).toBe(sizes.length)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })
})

describe('DEFAULT_SIZE and PRESETS', () => {
  it('defaults to 1170 by 2532', () => {
    expect(DEFAULT_SIZE).toEqual({ width: 1170, height: 2532 })
  })

  it('lists phone and desktop presets that are all inside the allowed size', () => {
    const phones = PRESETS.filter((p) => p.height > p.width)
    const desktops = PRESETS.filter((p) => p.width > p.height)
    expect(phones.length).toBeGreaterThanOrEqual(6)
    expect(desktops.length).toBeGreaterThanOrEqual(5)
    expect(phones.length + desktops.length).toBe(PRESETS.length)
    for (const preset of PRESETS) expect(clampSize(preset)).toEqual({ width: preset.width, height: preset.height })
    expect(PRESETS.some((p) => p.width === 1170 && p.height === 2532)).toBe(true)
    for (const [width, height] of [[1920, 1080], [2560, 1440], [3840, 2160], [1366, 768]]) {
      expect(PRESETS.some((p) => p.width === width && p.height === height)).toBe(true)
    }
  })
})

describe('detectSize', () => {
  it('multiplies the screen size by the pixel ratio on a phone', () => {
    expect(detectSize({ screenWidth: 390, screenHeight: 844, pixelRatio: 3, coarsePointer: true })).toEqual({ width: 1170, height: 2532 })
  })

  it('swaps a landscape reading back to portrait', () => {
    expect(detectSize({ screenWidth: 844, screenHeight: 390, pixelRatio: 3, coarsePointer: true })).toEqual({ width: 1170, height: 2532 })
  })

  it('uses the screen as it is on a desktop or laptop', () => {
    expect(detectSize({ screenWidth: 1920, screenHeight: 1080, pixelRatio: 1, coarsePointer: false })).toEqual({ width: 1920, height: 1080 })
    expect(detectSize({ screenWidth: 1440, screenHeight: 900, pixelRatio: 2, coarsePointer: false })).toEqual({ width: 2880, height: 1800 })
    expect(detectSize({ screenWidth: 1536, screenHeight: 864, pixelRatio: 1.25, coarsePointer: false })).toEqual({ width: 1920, height: 1080 })
  })

  it('keeps the shape of a big desktop screen when it is capped', () => {
    expect(detectSize({ screenWidth: 5120, screenHeight: 2880, pixelRatio: 1, coarsePointer: false })).toEqual({ width: 4000, height: 2250 })
  })

  it('falls back to the default when the screen size is unknown', () => {
    expect(detectSize({ screenWidth: 0, screenHeight: 0, pixelRatio: 1, coarsePointer: false })).toBeNull()
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
