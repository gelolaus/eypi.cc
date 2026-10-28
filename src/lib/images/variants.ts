// Lazy-only module: load via dynamic import from upload code, never from the entry bundle.
import { IMAGE_PROFILES, type ImageProfile } from './profiles'

export const WEBP_QUALITY = 0.86
const FALLBACK_QUALITY = 0.86
const PLACEHOLDER_WIDTH = 16
const PLACEHOLDER_MAX_CHARS = 1200
const PLACEHOLDER_MAX_HEIGHT = 32

export type ImageFormat = 'webp' | 'jpeg' | 'png'

export type ImageMeta = {
  w: number
  h: number
  fmt: ImageFormat
  widths: number[]
  ph: string
}

export type Variant = { width: number; dataUrl: string }

/** The slice of a 2D context this module uses (real or fake). */
export interface Surface2D {
  drawImage(image: unknown, dx: number, dy: number, dw: number, dh: number): void
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> }
  imageSmoothingQuality?: string
  imageSmoothingEnabled?: boolean
}

export interface DrawSurface {
  width: number
  height: number
  ctx: Surface2D
  /** Real canvases encode themselves; injected encoders may ignore this. */
  native?: unknown
}

export type Encoder = (surface: DrawSurface, type: string, quality: number) => Promise<Blob | null>

export interface BitmapLike {
  width: number
  height: number
  close?: () => void
}

export interface VariantDeps {
  encode?: Encoder
  loadBitmap?: (file: Blob) => Promise<BitmapLike>
  createSurface?: (w: number, h: number) => DrawSurface
}

/** Widths strictly below the source width; never upscale. */
export function planWidths(sourceWidth: number, profile: readonly number[]): number[] {
  return profile.filter((w) => w < sourceWidth).sort((a, b) => a - b)
}

const defaultLoadBitmap = async (file: Blob): Promise<BitmapLike> => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(file)
  }
}

const defaultCreateSurface = (w: number, h: number): DrawSurface => {
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = canvas.getContext('2d') as Surface2D | null
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { width: w, height: h, ctx, native: canvas }
}

const defaultEncode: Encoder = (surface, type, quality) => {
  const canvas = surface.native as OffscreenCanvas | HTMLCanvasElement
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${blob.type};base64,${btoa(bin)}`
}

function hasAlpha(surface: DrawSurface): boolean {
  const { data } = surface.ctx.getImageData(0, 0, surface.width, surface.height)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

function formatOf(type: string): ImageFormat | null {
  if (type === 'image/webp') return 'webp'
  if (type === 'image/jpeg') return 'jpeg'
  if (type === 'image/png') return 'png'
  return null
}

class FormatMismatch extends Error {}

/**
 * WebP first. Safari ignores toBlob('image/webp') and returns PNG, so when the
 * blob is not WebP: JPEG for opaque images, PNG for images with alpha.
 * `force` pins the output format (used to keep one format across a set).
 */
async function encodeBest(
  encode: Encoder,
  surface: DrawSurface,
  alpha: boolean,
  quality: number,
  force?: ImageFormat,
): Promise<{ blob: Blob; fmt: ImageFormat }> {
  if (!force || force === 'webp') {
    const webp = await encode(surface, 'image/webp', quality)
    if (webp && webp.type === 'image/webp') return { blob: webp, fmt: 'webp' }
    if (force === 'webp') throw new FormatMismatch('webp not encoded')
  }
  const type = force ? `image/${force}` : alpha ? 'image/png' : 'image/jpeg'
  const blob = await encode(surface, type, Math.min(quality, FALLBACK_QUALITY))
  const out = blob && formatOf(blob.type)
  if (!blob || !out) throw new Error('image encoding failed')
  return { blob, fmt: out }
}

/** Placeholder never aborts an upload: shrink and retry, finally degrade to ''. */
async function makePlaceholder(
  bitmap: BitmapLike,
  createSurface: (w: number, h: number) => DrawSurface,
  encode: Encoder,
): Promise<{ ph: string; fmt: ImageFormat | null; alpha: boolean }> {
  const attempts = [
    { w: PLACEHOLDER_WIDTH, q: 0.5 },
    { w: PLACEHOLDER_WIDTH, q: 0.3 },
    { w: 8, q: 0.3 },
    { w: 4, q: 0.2 },
  ]
  let alpha = false
  let fmt: ImageFormat | null = null
  for (const [i, { w, q }] of attempts.entries()) {
    try {
      const ratio = bitmap.height / bitmap.width
      const h = Math.min(PLACEHOLDER_MAX_HEIGHT, Math.max(w === PLACEHOLDER_WIDTH ? 4 : 1, Math.round(ratio * w)))
      const surface = createSurface(w, h)
      surface.ctx.drawImage(bitmap, 0, 0, w, h)
      if (i === 0) alpha = hasAlpha(surface)
      const out = await encodeBest(encode, surface, alpha, q)
      fmt ??= out.fmt
      const url = await blobToDataUrl(out.blob)
      if (url.length <= PLACEHOLDER_MAX_CHARS) return { ph: url, fmt: out.fmt, alpha }
    } catch {
      // try the next, smaller attempt
    }
  }
  return { ph: '', fmt, alpha }
}

export async function makeVariants(
  file: Blob,
  profile: ImageProfile,
  deps: VariantDeps = {},
): Promise<{ meta: ImageMeta; variants: Variant[] }> {
  const encode = deps.encode ?? defaultEncode
  const loadBitmap = deps.loadBitmap ?? defaultLoadBitmap
  const createSurface = deps.createSurface ?? defaultCreateSurface

  const bitmap = await loadBitmap(file)
  try {
    const w = bitmap.width
    const h = bitmap.height
    const placeholder = await makePlaceholder(bitmap, createSurface, encode)
    const { alpha } = placeholder

    const widths = planWidths(w, IMAGE_PROFILES[profile])
    const surfaces = widths.map((width) => {
      const height = Math.max(1, Math.round((h / w) * width))
      const surface = createSurface(width, height)
      surface.ctx.drawImage(bitmap, 0, 0, width, height)
      return surface
    })

    const encodeSet = async (force?: ImageFormat) => {
      const blobs: Blob[] = []
      let fmt = force
      for (const surface of surfaces) {
        const out = await encodeBest(encode, surface, alpha, WEBP_QUALITY, fmt)
        fmt ??= out.fmt
        if (out.fmt !== fmt) throw new FormatMismatch('mixed formats')
        blobs.push(out.blob)
      }
      return { blobs, fmt }
    }

    let set: { blobs: Blob[]; fmt: ImageFormat | undefined }
    try {
      set = await encodeSet()
    } catch (e) {
      if (!(e instanceof FormatMismatch)) throw e
      set = await encodeSet(alpha ? 'png' : 'jpeg')
    }

    const variants: Variant[] = []
    for (const [i, blob] of set.blobs.entries()) {
      variants.push({ width: widths[i], dataUrl: await blobToDataUrl(blob) })
    }
    const fmt: ImageFormat = set.fmt ?? placeholder.fmt ?? 'webp'
    return { meta: { w, h, fmt, widths, ph: placeholder.ph }, variants }
  } finally {
    bitmap.close?.()
  }
}
