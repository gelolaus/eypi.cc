import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { deleteObject, mediaUrl, putImage } from './media'
import { createTestApp } from '../test/createTestApp'

const THREE_MB = 3 * 1024 * 1024

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0,
    0x00, 0x0b,
    0x08,
    0x00, 0x00,
    0x00, 0x00,
    0x01,
    0x01, 0x11, 0x00,
    0xff, 0xd9,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint16(7, height)
  view.setUint16(9, width)
  return bytes
}

function webp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  bytes.set([
    0x52, 0x49, 0x46, 0x46, 22, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00,
  ])
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  bytes[24] = widthMinusOne & 0xff
  bytes[25] = (widthMinusOne >> 8) & 0xff
  bytes[26] = (widthMinusOne >> 16) & 0xff
  bytes[27] = heightMinusOne & 0xff
  bytes[28] = (heightMinusOne >> 8) & 0xff
  bytes[29] = (heightMinusOne >> 16) & 0xff
  return bytes
}

async function sha8(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 8)
}

async function storedKeys(env: { MEDIA: { list: () => Promise<{ objects: { key: string }[] }> } }): Promise<string[]> {
  const listed = await env.MEDIA.list()
  return listed.objects.map((object) => object.key)
}

describe('putImage', () => {
  it('rejects an SVG renamed to png with invalid_image and stores nothing', async () => {
    const { env } = await createTestApp()
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')

    const error = await putImage(env, {
      prefix: 'frames/camp',
      id: 'frame-1',
      bytes: svg,
      allowed: ['png'],
      maxBytes: THREE_MB,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'invalid_image' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('rejects a 3.1 MB PNG with file_too_large and stores nothing', async () => {
    const { env } = await createTestApp()
    const bytes = new Uint8Array(Math.ceil(3.1 * 1024 * 1024))
    bytes.set(png(32, 32))

    const error = await putImage(env, {
      prefix: 'frames/camp',
      id: 'frame-1',
      bytes,
      allowed: ['png'],
      maxBytes: THREE_MB,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'file_too_large' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('rejects a PNG over 3 MB even when maxBytes is higher', async () => {
    const { env } = await createTestApp()
    const bytes = new Uint8Array(THREE_MB + 1)
    bytes.set(png(8, 8))

    const error = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'logo',
      bytes,
      allowed: ['png', 'jpeg', 'webp'],
      maxBytes: 10 * 1024 * 1024,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'file_too_large' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('rejects a non-square image when requireSquare is set and stores nothing', async () => {
    const { env } = await createTestApp()

    const error = await putImage(env, {
      prefix: 'frames/camp',
      id: 'frame-1',
      bytes: png(20, 10),
      allowed: ['png'],
      maxBytes: THREE_MB,
      requireSquare: true,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'not_square' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('rejects an image smaller than minSize', async () => {
    const { env } = await createTestApp()

    const error = await putImage(env, {
      prefix: 'frames/camp',
      id: 'frame-1',
      bytes: png(100, 100),
      allowed: ['png'],
      maxBytes: THREE_MB,
      requireSquare: true,
      minSize: 1080,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'too_small' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('rejects a JPEG when only PNG is allowed', async () => {
    const { env } = await createTestApp()

    const error = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'logo',
      bytes: jpeg(12, 12),
      allowed: ['png'],
      maxBytes: THREE_MB,
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'invalid_image' })
    expect(await storedKeys(env)).toEqual([])
  })

  it('stores a square PNG under a hashed key and returns its dimensions', async () => {
    const { env } = await createTestApp()
    const bytes = png(1080, 1080)

    const stored = await putImage(env, {
      prefix: 'frames/camp',
      id: 'frame-1',
      bytes,
      allowed: ['png', 'jpeg', 'webp'],
      maxBytes: THREE_MB,
      requireSquare: true,
      minSize: 1080,
    })

    expect(stored).toEqual({
      key: `frames/camp/frame-1-${await sha8(bytes)}.png`,
      width: 1080,
      height: 1080,
    })
    expect(mediaUrl(stored.key)).toBe(`/media/${stored.key}`)
    const object = await env.MEDIA.get(stored.key)
    expect(object?.httpMetadata?.contentType).toBe('image/png')
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(bytes)
  })

  it('reads dimensions from lossless and lossy WebP payloads', async () => {
    const { env } = await createTestApp()
    const lossless = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 17, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c, 5, 0x00, 0x00, 0x00,
      0x2f, 0x01, 0x80, 0x00, 0x00,
    ])
    const lossy = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 22, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20, 10, 0x00, 0x00, 0x00,
      0x10, 0x00, 0x00,
      0x9d, 0x01, 0x2a,
      0x02, 0x00,
      0x03, 0x00,
    ])

    const losslessStored = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'lossless',
      bytes: lossless,
      allowed: ['webp'],
      maxBytes: THREE_MB,
    })
    const lossyStored = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'lossy',
      bytes: lossy,
      allowed: ['webp'],
      maxBytes: THREE_MB,
    })

    expect(losslessStored.width).toBe(2)
    expect(losslessStored.height).toBe(3)
    expect(losslessStored.key).toBe(`orgs/org-1/lossless-${await sha8(lossless)}.webp`)
    expect(lossyStored.width).toBe(2)
    expect(lossyStored.height).toBe(3)
    expect(lossyStored.key).toBe(`orgs/org-1/lossy-${await sha8(lossy)}.webp`)
  })

  it('stores JPEG and WebP with jpg and webp extensions', async () => {
    const { env } = await createTestApp()
    const jpegBytes = jpeg(4, 9)
    const webpBytes = webp(6, 6)

    const jpegStored = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'banner',
      bytes: jpegBytes,
      allowed: ['jpeg', 'webp'],
      maxBytes: THREE_MB,
    })
    const webpStored = await putImage(env, {
      prefix: 'orgs/org-1',
      id: 'logo',
      bytes: webpBytes,
      allowed: ['jpeg', 'webp'],
      maxBytes: THREE_MB,
      requireSquare: true,
    })

    expect(jpegStored).toEqual({
      key: `orgs/org-1/banner-${await sha8(jpegBytes)}.jpg`,
      width: 4,
      height: 9,
    })
    expect(webpStored).toEqual({
      key: `orgs/org-1/logo-${await sha8(webpBytes)}.webp`,
      width: 6,
      height: 6,
    })
    expect((await env.MEDIA.get(jpegStored.key))?.httpMetadata?.contentType).toBe('image/jpeg')
    expect((await env.MEDIA.get(webpStored.key))?.httpMetadata?.contentType).toBe('image/webp')
  })

  it('accepts a PNG that is exactly 3 MB', async () => {
    const { env } = await createTestApp()
    const bytes = new Uint8Array(THREE_MB)
    bytes.set(png(2, 2))

    const stored = await putImage(env, {
      prefix: 'qr-logos',
      id: 'link-1',
      bytes,
      allowed: ['png'],
      maxBytes: THREE_MB,
    })

    expect(stored.key).toBe(`qr-logos/link-1-${await sha8(bytes)}.png`)
    expect(stored.width).toBe(2)
    expect(stored.height).toBe(2)
    expect((await env.MEDIA.get(stored.key))?.size).toBe(THREE_MB)
  })

  it('deleteObject removes the stored image', async () => {
    const { env } = await createTestApp()
    const bytes = png(8, 8)
    const stored = await putImage(env, {
      prefix: 'qr-logos',
      id: 'link-1',
      bytes,
      allowed: ['png'],
      maxBytes: THREE_MB,
    })

    await deleteObject(env, stored.key)

    expect(await env.MEDIA.get(stored.key)).toBeNull()
  })
})
