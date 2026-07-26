import { describe, it, expect } from 'vitest'
import { qrLogoLayout } from './qrLogoLayout'

describe('qrLogoLayout', () => {
  it('centers the logo box inside the QR canvas', () => {
    expect(qrLogoLayout(240)).toEqual({
      logoSize: 67,
      pad: 10,
      x: 87,
      y: 87,
      clearX: 77,
      clearY: 77,
      clearSize: 87,
    })
  })

  it('scales layout with canvas size', () => {
    const layout = qrLogoLayout(1920)
    expect(layout.logoSize).toBe(538)
    expect(layout.x + layout.logoSize / 2).toBeCloseTo(960, 0)
  })
})
