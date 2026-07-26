import { describe, it, expect } from 'vitest'
import { qrLogoTargetSize } from './qrLogoSize'

describe('qrLogoTargetSize', () => {
  it('leaves small images unchanged', () => {
    expect(qrLogoTargetSize(200, 100, 384)).toEqual({ width: 200, height: 100 })
  })

  it('scales down large images to fit max edge', () => {
    expect(qrLogoTargetSize(1920, 1920, 384)).toEqual({ width: 384, height: 384 })
    expect(qrLogoTargetSize(1920, 960, 384)).toEqual({ width: 384, height: 192 })
  })

  it('never returns zero dimensions', () => {
    expect(qrLogoTargetSize(1, 5000, 384)).toEqual({ width: 1, height: 384 })
  })
})
