import { describe, it, expect } from 'vitest'
import { shouldPunchToTransparent } from './qrTransparency'

describe('shouldPunchToTransparent', () => {
  it('punches near-white pixels', () => {
    expect(shouldPunchToTransparent(255, 255, 255)).toBe(true)
    expect(shouldPunchToTransparent(250, 248, 252)).toBe(true)
  })

  it('keeps dark and brand-colored modules', () => {
    expect(shouldPunchToTransparent(0, 0, 0)).toBe(false)
    expect(shouldPunchToTransparent(0xde, 0xac, 0x4b)).toBe(false)
    expect(shouldPunchToTransparent(200, 200, 200)).toBe(false)
  })
})
