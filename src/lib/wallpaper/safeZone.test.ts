import { describe, expect, it } from 'vitest'
import { contentBottom, contentTop, isLandscape, sizingUnit } from './safeZone'

describe('isLandscape', () => {
  it('is true only when the width is greater than the height', () => {
    expect(isLandscape(1920, 1080)).toBe(true)
    expect(isLandscape(1170, 2532)).toBe(false)
    expect(isLandscape(1000, 1000)).toBe(false)
  })
})

describe('contentTop', () => {
  it('keeps clear of the lock screen clock on a portrait wallpaper', () => {
    expect(contentTop(2532)).toBe(760)
    expect(contentTop(2532, 1170)).toBe(760)
  })

  it('starts near the top of a landscape wallpaper, which has no lock screen clock', () => {
    expect(contentTop(1080, 1920)).toBe(86)
  })
})

describe('sizingUnit', () => {
  it('is the width on a portrait wallpaper', () => {
    expect(sizingUnit(1170, 2532)).toBe(1170)
    expect(sizingUnit(1080, 1920)).toBe(1080)
  })

  it('follows the height on a landscape wallpaper so text keeps its proportions', () => {
    expect(sizingUnit(1920, 1080)).toBeCloseTo(496.8)
    expect(sizingUnit(3840, 2160)).toBeCloseTo(993.6)
  })
})

describe('contentBottom', () => {
  it('leaves a 4% margin', () => {
    expect(contentBottom(1000)).toBe(960)
  })
})
