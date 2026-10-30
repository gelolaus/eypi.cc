import { describe, expect, it } from 'vitest'
import { THEMES, contrastRatio, readableOn } from './themes'
import type { ThemeName } from './types'

const names = Object.keys(THEMES) as ThemeName[]

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(Math.abs(contrastRatio('#000000', '#ffffff') - 21)).toBeLessThan(0.01)
  })
})

describe('readableOn', () => {
  it('picks white on APC blue', () => {
    expect(readableOn('#35438c')).toBe('#ffffff')
  })

  it('picks black on APC gold', () => {
    expect(readableOn('#deac4b')).toBe('#000000')
  })
})

describe('the APC theme', () => {
  it('has blocks that stand out from the blue background and from each other', () => {
    const { bg, blocks } = THEMES.apc
    for (const block of blocks) expect(contrastRatio(block, bg)).toBeGreaterThanOrEqual(3)
    expect(new Set(blocks).size).toBe(blocks.length)
  })

  it('keeps the gold accent readable on the blue', () => {
    expect(contrastRatio(THEMES.apc.accent, THEMES.apc.bg)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('THEMES', () => {
  it.each(names)('%s has five blocks and readable text', (name) => {
    const theme = THEMES[name]
    expect(theme.blocks).toHaveLength(5)
    expect(contrastRatio(theme.text, theme.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(theme.muted, theme.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(names)('%s has readable text on every block', (name) => {
    for (const block of THEMES[name].blocks) {
      expect(contrastRatio(readableOn(block), block)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
