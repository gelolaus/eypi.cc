import { describe, expect, it } from 'vitest'
import { contentBottom } from './safeZone'
import { createRecordingContext } from './testContext'
import { THEMES } from './themes'
import { drawWatermark } from './watermark'

function draw(width: number, height: number, logo: unknown) {
  const ctx = createRecordingContext(width, height)
  drawWatermark(ctx as unknown as CanvasRenderingContext2D, width, height, THEMES.dark, logo as CanvasImageSource | null)
  const text = (label: string) => ctx.calls.find((c) => c.op === 'fillText' && c.text === label)
  return { ctx, made: text('Made with'), eypi: text('Eypi'), logoCall: ctx.calls.find((c) => c.op === 'drawImage') }
}

describe('drawWatermark', () => {
  it.each<[number, number]>([[1170, 2532], [1080, 1920], [1920, 1080], [3840, 2160]])('puts the Eypi logo between "Made with" and "Eypi" in the bottom margin at %i x %i', (width, height) => {
    const { made, eypi, logoCall } = draw(width, height, {})
    expect(made).toBeDefined()
    expect(eypi).toBeDefined()
    expect(logoCall).toBeDefined()
    expect(made!.x).toBeLessThan(logoCall!.x)
    expect(logoCall!.x).toBeLessThan(eypi!.x)
    for (const call of [made!, eypi!, logoCall!]) {
      expect(call.y).toBeGreaterThanOrEqual(contentBottom(height))
      expect(call.y).toBeLessThanOrEqual(height)
    }
  })

  it('is centred on the screen', () => {
    const { made, eypi } = draw(1170, 2532, {})
    expect(made!.x).toBeGreaterThan(1170 * 0.25)
    expect(eypi!.x).toBeLessThan(1170 * 0.75)
  })

  it('draws the words alone when the logo could not be loaded', () => {
    const { made, eypi, logoCall } = draw(1170, 2532, null)
    expect(made).toBeDefined()
    expect(eypi).toBeDefined()
    expect(logoCall).toBeUndefined()
  })
})
