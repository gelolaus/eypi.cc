import { ApiError } from './errors'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export type PutImageInput = {
  prefix: string
  id: string
  bytes: Uint8Array
  allowed: readonly ImageFormat[]
  maxBytes: number
  requireSquare?: boolean
  minSize?: number
}

export type StoredImage = {
  key: string
  width: number
  height: number
}

type ImageSize = {
  width: number
  height: number
}

export type ImageMeta = {
  w: number
  h: number
  fmt: ImageFormat
  widths: number[]
  ph: string
}

type MediaBucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  delete(key: string): Promise<unknown>
}

const EXTENSION: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

const CONTENT_TYPE: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function invalidImage(): ApiError {
  return new ApiError(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

function readPng(bytes: Uint8Array): ImageSize | null {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null
  if (bytes.length < 24) return null
  const ihdr = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (ihdr !== 'IHDR') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < 1 || height < 1) return null
  return { width, height }
}

function readJpeg(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (bytes[offset] === 0xff) {
      offset += 1
      if (offset >= bytes.length) return null
    }
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) return null
    if (marker >= 0xd0 && marker <= 0xd7) continue
    if (offset + 1 >= bytes.length) return null
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1]
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isStartOfFrame) {
      if (segmentLength < 7) return null
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (width < 1 || height < 1) return null
      return { width, height }
    }
    offset += segmentLength
  }
  return null
}

function u24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16)
}

function readWebp(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 16) return null
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return null
  const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
  if (format !== 'WEBP') return null
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (chunk === 'VP8X') {
    if (bytes.length < 30) return null
    const width = 1 + u24(bytes, 24)
    const height = 1 + u24(bytes, 27)
    if (width < 1 || height < 1) return null
    return { width, height }
  }
  if (chunk === 'VP8L') {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null
    const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0
    const width = (bits & 0x3fff) + 1
    const height = ((bits >>> 14) & 0x3fff) + 1
    if (width < 1 || height < 1) return null
    return { width, height }
  }
  if (chunk === 'VP8 ') {
    if (bytes.length < 30) return null
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
    if (width < 1 || height < 1) return null
    return { width, height }
  }
  return null
}

export function sniff(bytes: Uint8Array): { format: ImageFormat; width: number; height: number } | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    const size = readPng(bytes)
    return size ? { format: 'png', ...size } : null
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const size = readJpeg(bytes)
    return size ? { format: 'jpeg', ...size } : null
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) {
    const size = readWebp(bytes)
    return size ? { format: 'webp', ...size } : null
  }
  return null
}

async function sha8(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy))
  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex.slice(0, 8)
}

export async function putImage(
  env: { MEDIA: MediaBucket },
  input: PutImageInput,
): Promise<StoredImage> {
  const { prefix, id, bytes, allowed, maxBytes, requireSquare, minSize } = input
  if (bytes.byteLength > maxBytes || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiError(422, 'file_too_large', 'That image is too large.')
  }

  const image = sniff(bytes)
  if (!image || !allowed.includes(image.format)) throw invalidImage()
  if (requireSquare && image.width !== image.height) {
    throw new ApiError(422, 'not_square', 'Use a square image.')
  }
  if (minSize !== undefined && (image.width < minSize || image.height < minSize)) {
    throw new ApiError(422, 'too_small', 'That image is too small.')
  }

  const key = `${prefix}/${id}-${await sha8(bytes)}.${EXTENSION[image.format]}`
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: CONTENT_TYPE[image.format] },
  })
  return { key, width: image.width, height: image.height }
}

export async function deleteObject(env: { MEDIA: MediaBucket }, key: string): Promise<void> {
  await env.MEDIA.delete(key)
}

/** `{originalKeyWithoutExt}-{width}.{webp|jpg|png}`. */
export function variantKey(originalKey: string, width: number, fmt: ImageFormat): string {
  const slash = originalKey.lastIndexOf('/')
  const dot = originalKey.lastIndexOf('.')
  const base = dot > slash ? originalKey.slice(0, dot) : originalKey
  return `${base}-${width}.${EXTENSION[fmt]}`
}

/** Writes one variant beside its original. The caller has already validated the bytes. */
export async function putVariant(
  env: { MEDIA: MediaBucket },
  input: { originalKey: string; width: number; fmt: ImageFormat; bytes: Uint8Array },
): Promise<string> {
  const key = variantKey(input.originalKey, input.width, input.fmt)
  await env.MEDIA.put(key, input.bytes, { httpMetadata: { contentType: CONTENT_TYPE[input.fmt] } })
  return key
}

/** Keys of every variant a meta describes. */
export function variantKeys(originalKey: string, meta: Pick<ImageMeta, 'fmt' | 'widths'> | null | undefined): string[] {
  if (!meta) return []
  return meta.widths.map((width) => variantKey(originalKey, width, meta.fmt))
}

/** Deletes the original and the variants its meta lists. Variant failures never block the original. */
export async function deleteWithVariants(
  env: { MEDIA: MediaBucket },
  key: string,
  meta?: Pick<ImageMeta, 'fmt' | 'widths'> | null,
): Promise<void> {
  await Promise.all(variantKeys(key, meta).map(async (variant) => {
    try {
      await env.MEDIA.delete(variant)
    } catch {
      // A leftover variant is harmless; the original must still go.
    }
  }))
  await env.MEDIA.delete(key)
}

/** Reads a stored meta column. Anything that is not a well-formed meta reads as null. */
export function parseImageMeta(raw: unknown): ImageMeta | null {
  if (typeof raw !== 'string' || !raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const meta = value as Record<string, unknown>
  const fmt = meta.fmt
  if (fmt !== 'webp' && fmt !== 'jpeg' && fmt !== 'png') return null
  const inRange = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= max
  if (!inRange(meta.w, 20000) || !inRange(meta.h, 20000)) return null
  if (!Array.isArray(meta.widths) || meta.widths.length > 4 || !meta.widths.every((n) => inRange(n, 1920))) return null
  if (meta.ph !== undefined && meta.ph !== '' && !(typeof meta.ph === 'string' && meta.ph.startsWith('data:image/'))) return null
  return {
    w: meta.w as number,
    h: meta.h as number,
    fmt,
    widths: meta.widths as number[],
    ph: typeof meta.ph === 'string' ? meta.ph : '',
  }
}

export function mediaUrl(key: string): string {
  return `/media/${key}`
}
