/// <reference types="@cloudflare/workers-types" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeLinkKvEntry } from '../shared/linksKv'
import worker, { type Env } from './index'

const logLinkClick = vi.hoisted(() => vi.fn(async () => {}))
const execute = vi.hoisted(() => vi.fn(async (query?: { sql?: string; args?: unknown[] }) => {
  void query
  return { rows: [] as Array<Record<string, unknown>> }
}))
const createClient = vi.hoisted(() => vi.fn(() => ({
  execute,
  close() {},
})))

vi.mock('../shared/linkAnalytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/linkAnalytics')>()
  return { ...actual, logLinkClick }
})

vi.mock('@libsql/client/web', () => ({
  createClient,
}))

// Node Vitest has no Workers HTMLRewriter. This covers the handlers the frame
// preview uses: replace `<title>` text and append HTML at the end of `<head>`.
class SharePreviewHTMLRewriter {
  private rules: Array<{
    selector: string
    element?: (element: {
      setInnerContent: (content: string) => void
      append: (content: string, options?: { html?: boolean }) => void
    }) => void
  }> = []

  on(
    selector: string,
    handlers: {
      element?: (element: {
        setInnerContent: (content: string) => void
        append: (content: string, options?: { html?: boolean }) => void
      }) => void
    },
  ): this {
    this.rules.push({ selector, element: handlers.element })
    return this
  }

  transform(response: Response): Response {
    const rules = this.rules
    const headers = new Headers(response.headers)
    headers.delete('Content-Length')
    const stream = new ReadableStream({
      async start(controller) {
        let html = await response.text()
        for (const rule of rules) {
          if (rule.selector === 'title') {
            rule.element?.({
              setInnerContent(content: string) {
                const text = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${text}</title>`)
              },
              append() {},
            })
          }
          if (rule.selector === 'head') {
            rule.element?.({
              setInnerContent() {},
              append(content: string) {
                html = html.replace(/<\/head>/i, `${content}</head>`)
              },
            })
          }
        }
        controller.enqueue(new TextEncoder().encode(html))
        controller.close()
      },
    })
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

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

  it.each(['/@vite/client', '/@id/__x00__plugin-vue:export-helper', '/@fs/C:/app/src/main.ts'])(
    'passes the vite dev path %s through to ASSETS without a 404',
    async (path) => {
      const fetchAsset = vi.fn(async () => new Response('vite-module', { status: 200 }))
      const request = new Request(`https://eypi.cc${path}`)
      const response = await worker.fetch(request, makeEnv({}, fetchAsset), ctx())

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('vite-module')
      expect(fetchAsset).toHaveBeenCalledWith(request)
    },
  )

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

  it('records source qr from the request src and keeps the destination intact', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}?src=qr`, {
        headers: { 'Sec-Fetch-Mode': 'navigate', 'User-Agent': 'Mozilla/5.0 Chrome/121.0.0.0' },
      }),
      makeEnv({ [SLUG]: slugEntry() }, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(DESTINATION)
    expect(logLinkClick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ linkId: 'link-1', source: 'qr' }),
    )
  })

  it('records device, browser and source app from the user agent', async () => {
    await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: {
          'Sec-Fetch-Mode': 'navigate',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0.0.38.108]',
        },
      }),
      makeEnv({ [SLUG]: slugEntry() }, vi.fn(async () => new Response('asset'))),
      ctx(),
    )

    expect(logLinkClick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ device: 'mobile', browser: 'Safari', app: 'messenger' }),
    )
  })

  it('ignores src=qr on the stored destination and keeps it', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset', { status: 200 }))
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}`, {
        headers: { 'Sec-Fetch-Mode': 'navigate', 'User-Agent': 'Mozilla/5.0 Chrome/121.0.0.0' },
      }),
      makeEnv({
        [SLUG]: JSON.stringify({ v: 2, id: 'link-1', url: 'https://example.com/dest?src=qr' }),
      }, fetchAsset),
      ctx(),
    )

    expect(response.headers.get('Location')).toBe('https://example.com/dest?src=qr')
    expect(logLinkClick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ linkId: 'link-1', source: 'direct' }),
    )
  })

  it('carries src=qr to the unlock page for protected links', async () => {
    const response = await worker.fetch(
      new Request(`https://eypi.cc/${SLUG}?src=qr`, { headers: { 'Sec-Fetch-Mode': 'navigate' } }),
      makeEnv({ [SLUG]: JSON.stringify({ v: 2, id: 'link-1', url: DESTINATION, pw: 1 }) }, vi.fn(async () => new Response('asset'))),
      ctx(),
    )
    expect(response.headers.get('Location')).toBe('/unlock/abc?src=qr')
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
    expect(frameResponse.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(frameResponse.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('serves event covers and their variants publicly, but not other prefixes', async () => {
    const cover = new Uint8Array([1, 2, 3])
    const env = mediaEnv({
      'events/ev-1/cover-0123abcd.png': cover,
      'events/ev-1/cover-0123abcd-640.webp': new Uint8Array([4]),
      'private/ev-1/cover.png': new Uint8Array([5]),
    }, vi.fn(async () => new Response('asset')))
    const hit = await worker.fetch(new Request('https://eypi.cc/media/events/ev-1/cover-0123abcd.png'), env, ctx())
    expect(hit.status).toBe(200)
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await hit.arrayBuffer())).toEqual(cover)
    const variant = await worker.fetch(new Request('https://eypi.cc/media/events/ev-1/cover-0123abcd-640.webp'), env, ctx())
    expect(variant.headers.get('Content-Type')).toBe('image/webp')
    const traversal = await worker.fetch(new Request('https://eypi.cc/media/events/../private/ev-1/cover.png'), env, ctx())
    expect(traversal.status).not.toBe(200)
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

  describe('edge cache', () => {
    class MediaMemoryCache {
      store = new Map<string, Response>()
      async match(request: Request): Promise<Response | undefined> {
        return this.store.get(request.url)?.clone()
      }
      async put(request: Request, response: Response): Promise<void> {
        this.store.set(request.url, response)
      }
    }

    function etagEnv(get: ReturnType<typeof vi.fn>): Env {
      return { ...makeEnv({}, vi.fn()), MEDIA: { get } } as unknown as Env
    }

    function waitingCtx(): { context: ExecutionContext; settle: () => Promise<void> } {
      const pending: Promise<unknown>[] = []
      return {
        context: {
          waitUntil(promise: Promise<unknown>) {
            pending.push(promise)
          },
          passThroughOnException() {},
        } as unknown as ExecutionContext,
        settle: async () => {
          await Promise.all(pending)
        },
      }
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('second request is served from cache without R2', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const get = vi.fn(async () => ({
        body: new Uint8Array([1, 2, 3]),
        httpEtag: '"abc"',
        httpMetadata: { contentType: 'image/png' },
      }))
      const env = etagEnv(get)
      const first = waitingCtx()

      const one = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png'), env, first.context)
      expect(one.headers.get('ETag')).toBe('"abc"')
      await one.arrayBuffer()
      await first.settle()

      const two = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png'), env, ctx())
      expect(two.status).toBe(200)
      expect(two.headers.get('ETag')).toBe('"abc"')
      expect(two.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
      expect(new Uint8Array(await two.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
      expect(get).toHaveBeenCalledTimes(1)
    })

    it('bounds the stored edge copy to one day while serving the immutable browser header', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const get = vi.fn(async () => ({ body: new Uint8Array([1]), httpEtag: '"abc"' }))
      const env = etagEnv(get)
      const first = waitingCtx()

      const miss = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png'), env, first.context)
      expect(miss.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
      await miss.arrayBuffer()
      await first.settle()

      const stored = cache.store.get('https://eypi.cc/media/frames/camp/a.png')
      expect(stored?.headers.get('Cache-Control')).toBe('public, max-age=86400')

      const hit = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png'), env, ctx())
      expect(hit.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')

      const revalidated = await worker.fetch(
        new Request('https://eypi.cc/media/frames/camp/a.png', { headers: { 'If-None-Match': '"abc"' } }),
        env,
        ctx(),
      )
      expect(revalidated.status).toBe(304)
      expect(revalidated.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    })

    it('ignores the query string in the cache key', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const get = vi.fn(async () => ({ body: new Uint8Array([1]), httpEtag: '"abc"' }))
      const env = etagEnv(get)
      const first = waitingCtx()
      const one = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png?x=1'), env, first.context)
      await one.arrayBuffer()
      await first.settle()
      expect([...cache.store.keys()]).toEqual(['https://eypi.cc/media/frames/camp/a.png'])
      await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png?x=2'), env, ctx())
      expect(get).toHaveBeenCalledTimes(1)
    })

    it('matches If-None-Match star and comma lists', async () => {
      vi.stubGlobal('caches', { default: new MediaMemoryCache() })
      const env = etagEnv(vi.fn(async () => ({ body: new Uint8Array([1]), httpEtag: '"abc"' })))
      for (const value of ['*', '"zzz", "abc"', 'W/"abc"']) {
        const response = await worker.fetch(
          new Request('https://eypi.cc/media/frames/camp/a.png', { headers: { 'If-None-Match': value } }),
          env,
          ctx(),
        )
        expect(response.status).toBe(304)
      }
    })

    it('falls back to R2 when cache.match throws', async () => {
      vi.stubGlobal('caches', {
        default: {
          match: async () => {
            throw new Error('boom')
          },
          put: async () => {},
        },
      })
      const get = vi.fn(async () => ({ body: new Uint8Array([7]), httpEtag: '"abc"' }))
      const response = await worker.fetch(new Request('https://eypi.cc/media/frames/camp/a.png'), etagEnv(get), ctx())
      expect(response.status).toBe(200)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([7]))
      expect(get).toHaveBeenCalledTimes(1)
    })

    it('responds 304 to a matching If-None-Match', async () => {
      vi.stubGlobal('caches', { default: new MediaMemoryCache() })
      const get = vi.fn(async () => ({ body: new Uint8Array([1]), httpEtag: '"abc"' }))
      const env = etagEnv(get)

      const response = await worker.fetch(
        new Request('https://eypi.cc/media/frames/camp/a.png', { headers: { 'If-None-Match': '"abc"' } }),
        env,
        ctx(),
      )
      expect(response.status).toBe(304)
      expect(response.headers.get('ETag')).toBe('"abc"')
      expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0))

      const stale = await worker.fetch(
        new Request('https://eypi.cc/media/frames/camp/a.png', { headers: { 'If-None-Match': '"zzz"' } }),
        env,
        ctx(),
      )
      expect(stale.status).toBe(200)
    })

    it('HEAD has no body and is never written to the cache', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const get = vi.fn(async () => ({ body: new Uint8Array([1, 2]), httpEtag: '"abc"' }))
      const response = await worker.fetch(
        new Request('https://eypi.cc/media/frames/camp/a.png', { method: 'HEAD' }),
        etagEnv(get),
        ctx(),
      )
      expect(response.status).toBe(200)
      expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0))
      expect(cache.store.size).toBe(0)
    })

    it('bypasses the cache for Range requests', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const get = vi.fn(async () => ({ body: new Uint8Array([1, 2]), httpEtag: '"abc"' }))
      const response = await worker.fetch(
        new Request('https://eypi.cc/media/frames/camp/a.png', { headers: { Range: 'bytes=0-0' } }),
        etagEnv(get),
        ctx(),
      )
      expect(response.status).toBe(200)
      expect(cache.store.size).toBe(0)
    })

    it('does not cache a missing object', async () => {
      const cache = new MediaMemoryCache()
      vi.stubGlobal('caches', { default: cache })
      const response = await worker.fetch(
        new Request('https://eypi.cc/media/frames/none.png'),
        etagEnv(vi.fn(async () => null)),
        ctx(),
      )
      expect(response.status).toBe(404)
      expect(cache.store.size).toBe(0)
    })
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

const FRAME_SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>eypi.cc - Link shortener for APC Rams</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`

function frameShellFetch() {
  return vi.fn(async () => new Response(FRAME_SHELL, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  }))
}

describe('guest ticket shell', () => {
  it('is served with X-Robots-Tag: noindex', async () => {
    const response = await worker.fetch(new Request('https://eypi.cc/t/abcDEF123'), makeEnv({}, frameShellFetch()), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
  })

  it('does not leak the token path in the Referer header', async () => {
    const response = await worker.fetch(new Request('https://eypi.cc/t/abcDEF123'), makeEnv({}, frameShellFetch()), ctx())
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})

describe('frame campaign share preview', () => {
  beforeEach(() => {
    logLinkClick.mockClear()
    execute.mockReset()
    execute.mockResolvedValue({ rows: [] })
    createClient.mockClear()
    vi.stubGlobal('HTMLRewriter', SharePreviewHTMLRewriter)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('injects the first frame as an absolute og:image on /frames/abc', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'frames/camp-1/frame-2-bbbbbbbb.png',
          position: 2,
        },
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'frames/camp-1/frame-1-abcd1234.png',
          position: 0,
        },
      ],
    })
    const fetchAsset = frameShellFetch()
    const response = await worker.fetch(
      new Request('https://eypi.cc/frames/abc'),
      makeEnv({}, fetchAsset),
      ctx(),
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Location')).toBeNull()
    expect(html).toContain('<meta property="og:image" content="https://eypi.cc/media/frames/camp-1/frame-1-abcd1234.png">')
    expect(html).toContain('<title>Rams Day</title>')
    expect(html).toContain('<meta name="description" content="Wear the frame.">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).not.toContain('frames/camp-1/frame-2-bbbbbbbb.png')
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(createClient).toHaveBeenCalledWith({
      url: 'libsql://test.turso.io',
      authToken: 'test-token',
    })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ['abc'] }))
  })

  it('uses the earlier frame when two frames share a position', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'frames/camp-1/frame-2-bbbbbbbb.png',
          position: 0,
          created_at: '2026-02-02 00:00:00',
        },
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'frames/camp-1/frame-1-abcd1234.png',
          position: 0,
          created_at: '2026-01-01 00:00:00',
        },
      ],
    })
    const response = await worker.fetch(
      new Request('https://eypi.cc/frames/abc'),
      makeEnv({}, frameShellFetch()),
      ctx(),
    )

    expect(await response.text()).toContain(
      '<meta property="og:image" content="https://eypi.cc/media/frames/camp-1/frame-1-abcd1234.png">',
    )
  })

  it('skips a data URL and previews the next stored frame key', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'data:image/png;base64,aaaa',
          position: 0,
        },
        {
          title: 'Rams Day',
          description: 'Wear the frame.',
          image_url: 'frames/camp-1/frame-1-abcd1234.png',
          position: 1,
        },
      ],
    })
    const response = await worker.fetch(
      new Request('https://eypi.cc/frames/abc'),
      makeEnv({}, frameShellFetch()),
      ctx(),
    )
    const html = await response.text()

    expect(html).toContain('<meta property="og:image" content="https://eypi.cc/media/frames/camp-1/frame-1-abcd1234.png">')
    expect(html).not.toContain('data:image')
  })

  it('escapes the campaign title and description', async () => {
    execute.mockResolvedValue({
      rows: [{
        title: 'Rams <Day> & "Night"',
        description: 'Wear the "frame" & go',
        image_url: 'frames/camp-1/frame-1-abcd1234.png',
        position: 0,
      }],
    })
    const response = await worker.fetch(
      new Request('https://eypi.cc/frames/abc'),
      makeEnv({}, frameShellFetch()),
      ctx(),
    )
    const html = await response.text()

    expect(html).toContain('<title>Rams &lt;Day&gt; &amp; "Night"</title>')
    expect(html).toContain('<meta name="description" content="Wear the &quot;frame&quot; &amp; go">')
    expect(html).toContain('<meta property="og:image" content="https://eypi.cc/media/frames/camp-1/frame-1-abcd1234.png">')
  })

  it('serves the shell when the campaign is missing or the lookup fails', async () => {
    const missingAsset = frameShellFetch()
    const missing = await worker.fetch(
      new Request('https://eypi.cc/frames/missing'),
      makeEnv({}, missingAsset),
      ctx(),
    )

    expect(missing.status).toBe(200)
    expect(await missing.text()).toBe(FRAME_SHELL)
    expect(missingAsset).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ['missing'] }))
    expect(logLinkClick).not.toHaveBeenCalled()

    execute.mockRejectedValue(new Error('turso down'))
    const failedAsset = frameShellFetch()
    const failed = await worker.fetch(
      new Request('https://eypi.cc/frames/abc'),
      makeEnv({}, failedAsset),
      ctx(),
    )

    expect(failed.status).toBe(200)
    expect(failed.headers.get('Cache-Control')).toBe('no-cache')
    expect(await failed.text()).toBe(FRAME_SHELL)
    expect(failedAsset).toHaveBeenCalledOnce()
  })
})

const SITE_TITLE = 'Eypi · Links and org tools for APC'
const SITE_DESCRIPTION = 'Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.'

class SitemapMemoryCache {
  private stored: Response | null = null

  async match(): Promise<Response | undefined> {
    return this.stored ? this.stored.clone() : undefined
  }

  async put(_request: Request, response: Response): Promise<void> {
    this.stored = response.clone()
  }
}

async function catalogQuery(query?: { sql?: string; args?: unknown[] }): Promise<{ rows: Array<Record<string, unknown>> }> {
  const sql = String(query?.sql ?? '')
  const filtered = /is_public_catalog\s*=\s*1/i.test(sql)
  const publicOrg = {
    id: 'foo',
    name: 'Foo Org',
    tagline: 'Build week projects',
    logo_url: 'orgs/foo/logo.png',
    social_links: '{"website":"https://jpcs.apc.edu.ph"}',
  }
  const privateOrg = {
    id: 'secret-org',
    name: 'Secret Org',
    tagline: 'Hidden',
    logo_url: null,
    social_links: null,
  }
  if (/from organizations/i.test(sql)) {
    const rows = filtered ? [publicOrg] : [publicOrg, privateOrg]
    if (query?.args && query.args.length > 0) {
      const id = String(query.args[0])
      return { rows: rows.filter((row) => row.id === id) }
    }
    return { rows: rows.map((row) => ({ id: row.id, name: row.name })) }
  }
  if (/from dp_campaigns/i.test(sql) && !/dp_frames/i.test(sql)) {
    return { rows: [{ slug: 'rams-day' }] }
  }
  return { rows: [] }
}

describe('seo surface', () => {
  beforeEach(() => {
    logLinkClick.mockClear()
    execute.mockReset()
    execute.mockImplementation(catalogQuery)
    createClient.mockClear()
    vi.stubGlobal('HTMLRewriter', SharePreviewHTMLRewriter)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns sitemap xml with public org and campaign urls cached for one hour', async () => {
    const cache = new SitemapMemoryCache()
    vi.stubGlobal('caches', { default: cache })
    const fetchAsset = vi.fn(async () => new Response(FRAME_SHELL, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }))
    const env = makeEnv({}, fetchAsset)

    const response = await worker.fetch(new Request('https://eypi.cc/sitemap.xml'), env, ctx())
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(xml).toContain('<loc>https://eypi.cc/</loc>')
    expect(xml).toContain('<loc>https://eypi.cc/privacy</loc>')
    expect(xml).toContain('<loc>https://eypi.cc/terms</loc>')
    expect(xml).toContain('<loc>https://eypi.cc/orgs/foo</loc>')
    expect(xml).toContain('<loc>https://eypi.cc/frames/rams-day</loc>')
    expect(xml).not.toContain('secret-org')
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringMatching(/is_public_catalog\s*=\s*1/i),
    }))

    execute.mockClear()
    const cached = await worker.fetch(new Request('https://eypi.cc/sitemap.xml'), env, ctx())
    expect(await cached.text()).toContain('<loc>https://eypi.cc/orgs/foo</loc>')
    expect(cached.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(execute).not.toHaveBeenCalled()
  })

  it('serves the static sitemap without the hour cache when the catalog query fails', async () => {
    execute.mockRejectedValue(new Error('turso down'))
    const fetchAsset = vi.fn(async () => new Response(FRAME_SHELL, { status: 200 }))
    const response = await worker.fetch(
      new Request('https://eypi.cc/sitemap.xml'),
      makeEnv({}, fetchAsset),
      ctx(),
    )
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0')
    expect(xml).toContain('<loc>https://eypi.cc/</loc>')
    expect(xml).toContain('<loc>https://eypi.cc/privacy</loc>')
    expect(xml).not.toContain('/orgs/foo')
    expect(xml).not.toContain('/frames/')
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it('puts the org name in og:title and Organization json-ld on /orgs/foo', async () => {
    const fetchAsset = frameShellFetch()
    const response = await worker.fetch(
      new Request('https://eypi.cc/orgs/foo'),
      makeEnv({}, fetchAsset),
      ctx(),
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
    expect(html).toContain('<meta property="og:title" content="Foo Org">')
    expect(html).toContain('<meta property="og:description" content="Build week projects">')
    expect(html).toContain('<meta property="og:image" content="https://eypi.cc/media/orgs/foo/logo.png">')
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"name":"Foo Org"')
    expect(html).toContain('"url":"https://eypi.cc/orgs/foo"')
    expect(html).toContain('"logo":"https://eypi.cc/media/orgs/foo/logo.png"')
    expect(html).toContain('https://jpcs.apc.edu.ph')
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringMatching(/is_public_catalog\s*=\s*1/i),
      args: ['foo'],
    }))
  })

  it('does not publish a private org name on /orgs/secret-org', async () => {
    const response = await worker.fetch(
      new Request('https://eypi.cc/orgs/secret-org'),
      makeEnv({}, frameShellFetch()),
      ctx(),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(FRAME_SHELL)
  })

  it('sets the homepage title and description meta on /', async () => {
    const response = await worker.fetch(
      new Request('https://eypi.cc/'),
      makeEnv({}, frameShellFetch()),
      ctx(),
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain(`<title>${SITE_TITLE}</title>`)
    expect(html).toContain(`<meta property="og:title" content="${SITE_TITLE}">`)
    expect(html).toContain(`<meta name="description" content="${SITE_DESCRIPTION}">`)
    expect(html).toContain(`<meta property="og:description" content="${SITE_DESCRIPTION}">`)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns 404 with the spa html body for an unknown multi-segment path', async () => {
    const fetchAsset = frameShellFetch()
    const response = await worker.fetch(
      new Request('https://eypi.cc/no/such/page'),
      makeEnv({}, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('Location')).toBeNull()
    expect(await response.text()).toBe(FRAME_SHELL)
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(logLinkClick).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns 404 with the spa html body when a single-segment slug misses KV and is not an spa route', async () => {
    const fetchAsset = frameShellFetch()
    const response = await worker.fetch(
      new Request('https://eypi.cc/missing-slug'),
      makeEnv({}, fetchAsset),
      ctx(),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('Location')).toBeNull()
    expect(response.headers.get('Cache-Control')).not.toBe('private, max-age=0')
    expect(await response.text()).toBe(FRAME_SHELL)
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(logLinkClick).not.toHaveBeenCalled()
  })

  it('keeps known spa routes on 200', async () => {
    const fetchAsset = frameShellFetch()
    const env = makeEnv({}, fetchAsset)

    for (const path of ['/privacy', '/forms/concessionaire', '/unlock/abc', '/orgs/modify']) {
      const response = await worker.fetch(new Request(`https://eypi.cc${path}`), env, ctx())
      expect(response.status, path).toBe(200)
      expect(await response.text()).toBe(FRAME_SHELL)
    }

    expect(logLinkClick).not.toHaveBeenCalled()
  })
})

describe('event share preview', () => {
  const EVENT_ROW = {
    slug: 'fest',
    name: 'Fest "2099" <script>alert(1)</script>',
    event_date: '2099-01-01',
    event_time: '09:00',
    location: 'Hall & Court',
    description: '# Welcome\n\n**Join** us <img src=x onerror=alert(1)> at "the" hall. ' + 'long '.repeat(80),
    cover_key: 'events/id-1/cover-ab.webp',
    org_name: 'Alpha',
  }

  beforeEach(() => {
    execute.mockReset()
    execute.mockImplementation(async (query?: { sql?: string; args?: unknown[] }) => {
      if (/from events/i.test(String(query?.sql)) && query?.args?.[0] === 'fest') return { rows: [EVENT_ROW] }
      return { rows: [] }
    })
    createClient.mockClear()
    vi.stubGlobal('HTMLRewriter', SharePreviewHTMLRewriter)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds escaped title, description and og:image on /tix/fest', async () => {
    const response = await worker.fetch(new Request('https://eypi.cc/tix/fest'), makeEnv({}, frameShellFetch()), ctx())
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('<title>Fest &quot;2099&quot; &lt;script&gt;alert(1)&lt;/script&gt;</title>'.replace(/&quot;/g, '"'))
    expect(html).toContain('<meta property="og:title" content="Fest &quot;2099&quot; &lt;script&gt;alert(1)&lt;/script&gt;">')
    expect(html).toContain('<meta property="og:image" content="https://eypi.cc/media/events/id-1/cover-ab.webp">')
    expect(html).toContain('<meta property="og:url" content="https://eypi.cc/tix/fest">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    const description = /<meta property="og:description" content="([^"]*)">/.exec(html)?.[1] ?? ''
    expect(description.startsWith('Welcome Join us')).toBe(true)
    expect(description).toContain('&quot;the&quot;')
    expect(description).not.toMatch(/[<>]|onerror|\*\*/)
    expect([...description.replace(/&quot;/g, '"')].length).toBeLessThanOrEqual(200)
    expect(html).not.toContain('<script>alert')
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringMatching(/status\s*!=\s*'draft'/i),
      args: ['fest'],
    }))
  })

  it('serves the plain shell for a draft or unknown event without leaking a name', async () => {
    const response = await worker.fetch(new Request('https://eypi.cc/tix/ghost'), makeEnv({}, frameShellFetch()), ctx())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(FRAME_SHELL)
  })

  it('falls back to the plain shell when the database throws', async () => {
    execute.mockRejectedValue(new Error('down'))
    const response = await worker.fetch(new Request('https://eypi.cc/tix/fest'), makeEnv({}, frameShellFetch()), ctx())
    expect(await response.text()).toBe(FRAME_SHELL)
  })

  it('leaves /tix and /tix/new untouched', async () => {
    for (const path of ['/tix', '/tix/new']) {
      execute.mockClear()
      const response = await worker.fetch(new Request(`https://eypi.cc${path}`), makeEnv({}, frameShellFetch()), ctx())
      expect(response.status).toBe(200)
    }
  })
})
