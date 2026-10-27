// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { IMAGE_PROFILES } from './profiles'
import {
  makeVariants,
  planWidths,
  WEBP_QUALITY,
  type DrawSurface,
  type Encoder,
  type VariantDeps,
} from './variants'

function deps(opts: { alpha?: boolean; encode: Encoder; w?: number; h?: number }): VariantDeps {
  return {
    loadBitmap: async () => ({ width: opts.w ?? 1000, height: opts.h ?? 500 }),
    createSurface: (width, height): DrawSurface => ({
      width,
      height,
      ctx: {
        drawImage: () => {},
        getImageData: (_x, _y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4).fill(255)
          if (opts.alpha) data[3] = 0
          return { data }
        },
      },
    }),
    encode: opts.encode,
  }
}

const blobOf = (type: string) => new Blob([new Uint8Array(40)], { type })

describe('planWidths', () => {
  it('keeps only widths strictly below the source', () => {
    expect(planWidths(1000, [256, 512, 1024])).toEqual([256, 512])
    expect(planWidths(512, [256, 512, 1024])).toEqual([256])
    expect(planWidths(100, [256, 512])).toEqual([])
  })
})

describe('makeVariants', () => {
  it('encodes webp at 0.86', async () => {
    const encode = vi.fn<Encoder>(async (_s, type) => blobOf(type))
    const out = await makeVariants(new Blob(['x']), 'frame', deps({ encode }))
    expect(out.meta.fmt).toBe('webp')
    expect(out.meta.widths).toEqual([256, 512])
    expect(out.meta).toMatchObject({ w: 1000, h: 500 })
    expect(out.variants.map((v) => v.width)).toEqual([256, 512])
    expect(out.variants[0].dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
    expect(WEBP_QUALITY).toBe(0.86)
    const variantCalls = encode.mock.calls.filter(([s]) => s.width > 16)
    expect(variantCalls.length).toBe(2)
    for (const [, type, q] of variantCalls) {
      expect(type).toBe('image/webp')
      expect(q).toBe(0.86)
    }
  })

  it('falls back when webp is not encoded (opaque -> jpeg)', async () => {
    const encode: Encoder = async (_s, type) => blobOf(type === 'image/webp' ? 'image/png' : type)
    const out = await makeVariants(new Blob(['x']), 'frame', deps({ encode }))
    expect(out.meta.fmt).toBe('jpeg')
    expect(out.variants.every((v) => v.dataUrl.startsWith('data:image/jpeg;'))).toBe(true)
  })

  it('falls back when webp is not encoded (alpha stays png)', async () => {
    const encode: Encoder = async (_s, type) => blobOf(type === 'image/webp' ? 'image/png' : type)
    const out = await makeVariants(new Blob(['x']), 'frame', deps({ encode, alpha: true }))
    expect(out.meta.fmt).toBe('png')
    expect(out.variants.every((v) => v.dataUrl.startsWith('data:image/png;'))).toBe(true)
  })

  it('makes a small 16px placeholder', async () => {
    const widths: number[] = []
    const encode: Encoder = async (s, type) => {
      widths.push(s.width)
      return blobOf(type)
    }
    const out = await makeVariants(new Blob(['x']), 'orgLogo', deps({ encode, w: 50 }))
    expect(widths).toEqual([16])
    expect(out.variants).toEqual([])
    expect(out.meta.widths).toEqual([])
    expect(out.meta.ph.startsWith('data:image/')).toBe(true)
    expect(out.meta.ph.length).toBeLessThanOrEqual(1200)
  })

  it('shrinks an oversized placeholder and never throws', async () => {
    const encode: Encoder = async (s, type) =>
      new Blob([new Uint8Array(s.width >= 16 ? 5000 : 30)], { type: type === 'image/webp' ? 'image/webp' : type })
    const out = await makeVariants(new Blob(['x']), 'orgLogo', deps({ encode, w: 500 }))
    expect(out.meta.ph.length).toBeLessThanOrEqual(1200)
    expect(out.meta.ph.length).toBeGreaterThan(0)
  })

  it('degrades to an empty placeholder when nothing fits', async () => {
    const encode: Encoder = async (s, type) =>
      s.width <= 16 ? new Blob([new Uint8Array(5000)], { type }) : blobOf(type)
    const out = await makeVariants(new Blob(['x']), 'orgLogo', deps({ encode, w: 500 }))
    expect(out.meta.ph).toBe('')
    expect(out.variants.length).toBe(3)
  })

  it('clamps placeholder height for tall sources', async () => {
    const heights: number[] = []
    const encode: Encoder = async (s, type) => {
      if (s.width === 16) heights.push(s.height)
      return blobOf(type)
    }
    await makeVariants(new Blob(['x']), 'frame', deps({ encode, w: 100, h: 1000 }))
    expect(heights[0]).toBeLessThanOrEqual(32)
  })

  it('passes quality to the jpeg fallback for the placeholder', async () => {
    const calls: [string, number][] = []
    const encode: Encoder = async (s, type, q) => {
      if (s.width === 16) calls.push([type, q])
      return blobOf(type === 'image/webp' ? 'image/png' : type)
    }
    await makeVariants(new Blob(['x']), 'frame', deps({ encode }))
    expect(calls.find(([t]) => t === 'image/jpeg')?.[1]).toBeLessThanOrEqual(0.5)
  })

  it('keeps one format when a later webp encode returns null', async () => {
    let n = 0
    const encode: Encoder = async (s, type) => {
      if (s.width > 16 && type === 'image/webp' && ++n === 2) return null
      return blobOf(type)
    }
    const out = await makeVariants(new Blob(['x']), 'frame', deps({ encode }))
    expect(out.meta.fmt).toBe('jpeg')
    expect(out.variants.every((v) => v.dataUrl.startsWith('data:image/jpeg;'))).toBe(true)
  })

  it('exposes profiles', () => {
    expect(IMAGE_PROFILES.qrLogo).toEqual([512])
  })
})
