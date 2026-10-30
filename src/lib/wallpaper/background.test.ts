import { afterEach, describe, expect, it, vi } from 'vitest'
import { coverRect, drawBackground, isSmallerThan, loadPhoto } from './background'
import { createRecordingContext } from './testContext'
import { THEMES } from './themes'

describe('coverRect', () => {
  it('crops the width of a landscape photo, centred', () => {
    const r = coverRect(4000, 3000, 1080, 2400)
    expect(r.sw / r.sh).toBeCloseTo(1080 / 2400)
    expect(r.sh).toBe(3000)
    expect(r.sx).toBeCloseTo((4000 - r.sw) / 2)
    expect(r.sy).toBe(0)
  })

  it('crops the height of a tall photo, centred', () => {
    const r = coverRect(1000, 3000, 1080, 2400)
    expect(r.sw / r.sh).toBeCloseTo(1080 / 2400)
    expect(r.sw).toBe(1000)
    expect(r.sy).toBeCloseTo((3000 - r.sh) / 2)
    expect(r.sx).toBe(0)
  })
})

describe('isSmallerThan', () => {
  it('is true when the photo has to be enlarged to cover the output', () => {
    expect(isSmallerThan({ width: 800, height: 600 }, 1080, 2400)).toBe(true)
    expect(isSmallerThan({ width: 1000, height: 2000 }, 1080, 2400)).toBe(true)
  })

  it('is false when the photo covers the output size', () => {
    expect(isSmallerThan({ width: 3000, height: 4000 }, 1080, 2400)).toBe(false)
    expect(isSmallerThan({ width: 4000, height: 3000 }, 1080, 2400)).toBe(false)
  })
})

describe('loadPhoto', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('decodes again at 4096 on the longest side when the photo is bigger', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ width: 6000, height: 8000 })
      .mockResolvedValueOnce({ width: 3072, height: 4096 })
    vi.stubGlobal('createImageBitmap', create)
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
    const bitmap = await loadPhoto(file)
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][1]).toMatchObject({ resizeWidth: 3072, resizeHeight: 4096, imageOrientation: 'from-image' })
    expect(bitmap.height).toBe(4096)
  })

  it('keeps a photo that is already small enough', async () => {
    const create = vi.fn().mockResolvedValue({ width: 1000, height: 2000 })
    vi.stubGlobal('createImageBitmap', create)
    await loadPhoto(new File(['x'], 'p.png', { type: 'image/png' }))
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('says the photo could not be read when decoding fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('out of memory')))
    await expect(loadPhoto(new File(['x'], 'p.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Could not read that photo. Try a smaller image.')
  })

  it('rejects a file that is not an image', async () => {
    await expect(loadPhoto(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image file.')
  })
})

describe('drawBackground', () => {
  const overlayAlphas = (dim: number) => {
    const ctx = createRecordingContext(1080, 2400)
    const alphas: number[] = []
    const fillRect = ctx.fillRect
    ctx.fillRect = (x, y, w, h) => {
      alphas.push(ctx.globalAlpha)
      fillRect(x, y, w, h)
    }
    drawBackground(ctx as unknown as CanvasRenderingContext2D, 1080, 2400, THEMES.dark, { width: 3000, height: 4000 } as ImageBitmap, dim)
    return alphas
  }

  it('fills the theme background once when there is no photo', () => {
    const ctx = createRecordingContext(1080, 2400)
    drawBackground(ctx as unknown as CanvasRenderingContext2D, 1080, 2400, THEMES.dark, null, 0.5)
    expect(ctx.calls).toEqual([{ op: 'fillRect', x: 0, y: 0, w: 1080, h: 2400 }])
    expect(ctx.fillStyle).toBe(THEMES.dark.bg)
  })

  it('draws the photo and then a dim overlay capped at 0.8', () => {
    expect(overlayAlphas(2)).toEqual([1, 0.8])
  })

  it('draws no dimming for a negative level', () => {
    expect(overlayAlphas(-1)).toEqual([1, 0])
  })
})
