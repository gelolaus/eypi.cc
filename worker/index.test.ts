/// <reference types="@cloudflare/workers-types" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeLinkKvEntry } from '../shared/linksKv'
import worker, { type Env } from './index'

const logLinkClick = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../shared/linkAnalytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/linkAnalytics')>()
  return { ...actual, logLinkClick }
})

const DESTINATION = 'https://example.com/dest'
const SLUG = 'abc'

function ctx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext
}

function makeEnv(entries: Record<string, string>, fetchAsset: Fetcher['fetch']): Env {
  return {
    ASSETS: { fetch: fetchAsset },
    LINKS_KV: {
      get: async (key: string) => entries[key] ?? null,
    },
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
  } as unknown as Env
}

function slugEntry(): string {
  return encodeLinkKvEntry({ id: 'link-1', url: DESTINATION })
}

describe('edge short-link redirect', () => {
  beforeEach(() => {
    logLinkClick.mockClear()
  })

  it('redirects a navigation request for a KV slug with 302 and a private cache header', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      makeEnv({ [SLUG]: slugEntry() }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(DESTINATION)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(logLinkClick).toHaveBeenCalledOnce()
  })

  it('returns 302 for HEAD and does not log the click', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, { method: 'HEAD' }),
      makeEnv({ [SLUG]: slugEntry() }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(DESTINATION)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('serves a reserved slug from ASSETS even when KV has that slug', async () => {
    const fetchAsset = vi.fn(async () => new Response('app-shell', { status: 200 }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/links', {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      makeEnv({ links: slugEntry() }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('app-shell')
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('serves /assets/x.js from ASSETS', async () => {
    const fetchAsset = vi.fn(async (request: RequestInfo | URL) => {
      const url = request instanceof Request ? request.url : String(request)
      return new Response(url, { status: 200 })
    })
    const request = new Request('https://eypi.cc/assets/x.js')
    const response = await worker.fetch(request, makeEnv({}, fetchAsset), ctx())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('https://eypi.cc/assets/x.js')
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(fetchAsset).toHaveBeenCalledWith(request)
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('sends an expired link to /expired and does not log', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      makeEnv({
        [SLUG]: JSON.stringify({ v: 2, id: 'link-1', url: DESTINATION, exp: 1 }),
      }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/expired')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('sends a protected link to /unlock/abc and does not log', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      makeEnv({
        [SLUG]: JSON.stringify({ v: 2, id: 'link-1', url: DESTINATION, pw: 1 }),
      }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/unlock/abc')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('strips src=qr from the destination and records source qr', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: { 'Sec-Fetch-Mode': 'navigate', 'User-Agent': 'Mozilla/5.0 Chrome/121.0.0.0' },
      }),
      makeEnv({
        [SLUG]: JSON.stringify({
          v: 2,
          id: 'link-1',
          url: 'https://example.com/dest?src=qr',
        }),
      }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://example.com/dest')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(logLinkClick).toHaveBeenCalledOnce()
    expect(logLinkClick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ linkId: 'link-1', source: 'qr' }),
    )
  })

  it('does not log a click from a bot user agent', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: {
          'Sec-Fetch-Mode': 'navigate',
          'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)',
        },
      }),
      makeEnv({ [SLUG]: slugEntry() }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(DESTINATION)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(logLinkClick).not.toHaveBeenCalled()
  })
})

function mediaEnv(
  objects: Record<string, Uint8Array>,
  fetchAsset: Fetcher['fetch'],
  get: (key: string) => Promise<{ body: Uint8Array } | null> = async (key) => {
    const body = objects[key]
    if (!body) return null
    return { body }
  },
): Env {
  return {
    ...makeEnv({}, fetchAsset),
    MEDIA: { get },
  } as unknown as Env
}

describe('public media route', () => {
  it('refuses /media/templates/x.docx with 404 and does not read the bucket or the app shell', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const get = vi.fn(async () => ({ body: new Uint8Array([1, 2, 3]) }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/media/templates/x.docx'),
      mediaEnv({ 'templates/x.docx': new Uint8Array([1, 2, 3]) }, fetchAsset, get),
      ctx(),
    )

    expect(response.status).toBe(404)
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('serves frames, orgs, and qr logos with an immutable cache', async () => {
    const frames = new Uint8Array([9, 8, 7])
    const logo = new Uint8Array([4, 5])
    const qr = new Uint8Array([6])
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const env = mediaEnv({
      'frames/camp/a.png': frames,
      'orgs/org-1/logo.webp': logo,
      'qr-logos/link-1.png': qr,
    }, fetchAsset)

    const frameResponse = await worker.fetch(
      new Request('https://eypi.cc/media/frames/camp/a.png'),
      env,
      ctx(),
    )
    const logoResponse = await worker.fetch(
      new Request('https://eypi.cc/media/orgs/org-1/logo.webp'),
      env,
      ctx(),
    )
    const qrResponse = await worker.fetch(
      new Request('https://eypi.cc/media/qr-logos/link-1.png'),
      env,
      ctx(),
    )

    expect(frameResponse.status).toBe(200)
    expect(frameResponse.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(frameResponse.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await frameResponse.arrayBuffer())).toEqual(frames)
    expect(logoResponse.headers.get('Content-Type')).toBe('image/webp')
    expect(new Uint8Array(await logoResponse.arrayBuffer())).toEqual(logo)
    expect(qrResponse.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await qrResponse.arrayBuffer())).toEqual(qr)
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('returns 404 when a public media object is missing', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/media/frames/missing.png'),
      mediaEnv({}, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).not.toBe('public, max-age=31536000, immutable')
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('returns 200 with an empty body for HEAD on a public object', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/media/frames/camp/a.png', { method: 'HEAD' }),
      mediaEnv({ 'frames/camp/a.png': new Uint8Array([1, 2, 3, 4]) }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0))
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('redirects retired password routes to /login with 301', async () => {
    const fetchAsset = vi.fn(async () => new Response('app-shell', { status: 200 }))
    const env = makeEnv({ verify: slugEntry(), 'reset-password': slugEntry() }, fetchAsset)

    for (const path of ['/verify', '/reset-password']) {
      const response = await worker.fetch(new Request(`https://eypi.cc${path}`), env, ctx())
      expect(response.status).toBe(301)
      expect(response.headers.get('Location')).toBe('/login')
    }

    expect(fetchAsset).not.toHaveBeenCalled()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('still serves the reserved /media slug from the app shell', async () => {
    const fetchAsset = vi.fn(async () => new Response('app-shell', { status: 200 }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/media'),
      mediaEnv({}, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('app-shell')
    expect(fetchAsset).toHaveBeenCalledOnce()
  })
})
