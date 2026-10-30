import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentTop } from './safeZone'
import { ensureFonts, fitText } from './text'
import { createRecordingContext } from './testContext'

const FONT = { size: 40, min: 20, weight: 600, family: 'Plus Jakarta Sans' }

describe('contentTop', () => {
  it('keeps the top 30 percent clear', () => {
    expect(contentTop(2532)).toBe(760)
    expect(contentTop(1920)).toBe(576)
  })
})

describe('fitText', () => {
  const ctx = () => createRecordingContext(1000, 2000)

  it('returns the text and starting size when it fits', () => {
    expect(fitText(ctx(), 'ABCD', 200, FONT)).toEqual({ text: 'ABCD', size: 40 })
  })

  it('shrinks the size, but not below the minimum, when it does not fit', () => {
    const fitted = fitText(ctx(), 'ABCDEFGHIJ', 150, FONT)
    expect(fitted.text).toBe('ABCDEFGHIJ')
    expect(fitted.size).toBeLessThan(40)
    expect(fitted.size).toBeGreaterThanOrEqual(20)
    expect(fitted.size * 0.6 * 10).toBeLessThanOrEqual(150)
  })

  it('clips with an ellipsis at the minimum size', () => {
    const c = ctx()
    const fitted = fitText(c, 'ABCDEFGHIJKLMNOP', 100, FONT)
    expect(fitted.size).toBe(20)
    expect(fitted.text.endsWith('…')).toBe(true)
    expect(fitted.text.length).toBeLessThan(16)
    c.font = `600 ${fitted.size}px x`
    expect(c.measureText(fitted.text).width).toBeLessThanOrEqual(100)
  })
})

describe('ensureFonts', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves when document.fonts is missing', async () => {
    vi.stubGlobal('document', {})
    await expect(ensureFonts()).resolves.toBeUndefined()
  })

  it('resolves when loading a font rejects', async () => {
    vi.stubGlobal('document', { fonts: { load: () => Promise.reject(new Error('no')) } })
    await expect(ensureFonts()).resolves.toBeUndefined()
  })
})
