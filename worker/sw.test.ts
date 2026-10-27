import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

type Strategy = 'shell-network-first' | 'asset-cache-first' | 'media-cache-first' | 'tickets-network-first' | 'bypass'
type FakeCache = ReturnType<typeof makeCache>
type Sw = {
  CACHE_NAMES: { media: string; tickets: string; shellPrefix: string }
  MEDIA_LIMIT: number
  HTML_TIMEOUT_MS: number
  pickStrategy: (url: URL, request: Request) => Strategy
  shellNetworkFirst: (request: Request, deps: Deps) => Promise<Response>
  assetCacheFirst: (request: Request, deps: Deps) => Promise<Response>
  mediaCacheFirst: (request: Request, deps: Deps) => Promise<Response>
  ticketsNetworkFirst: (request: Request, deps: Deps) => Promise<Response>
  trimCache: (cache: FakeCache, limit: number) => Promise<void>
  cacheable: (response: Response) => boolean
}
type Deps = { caches: FakeCaches; fetch: (r: Request) => Promise<Response>; shellCache: string; wait?: (ms: number) => Promise<void> }

function keyOf(input: Request | string): string {
  const raw = typeof input === 'string' ? input : input.url
  return new URL(raw, 'https://eypi.cc').pathname + new URL(raw, 'https://eypi.cc').search
}

function makeCache() {
  const map = new Map<string, Response>()
  return {
    map,
    async match(input: Request | string) {
      const hit = map.get(keyOf(input))
      return hit ? hit.clone() : undefined
    },
    async put(input: Request | string, response: Response) {
      map.set(keyOf(input), response)
    },
    async delete(input: Request | string) {
      return map.delete(keyOf(input))
    },
    async keys() {
      return [...map.keys()].map((k) => new Request(`https://eypi.cc${k}`))
    },
  }
}

class FakeCaches {
  stores = new Map<string, FakeCache>()
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, makeCache())
    return this.stores.get(name)!
  }
  async keys() {
    return [...this.stores.keys()]
  }
  async delete(name: string) {
    return this.stores.delete(name)
  }
}

let sw: Sw
beforeAll(async () => {
  // @ts-expect-error classic script without types; it publishes globalThis.EypiSw
  await import('../public/sw-strategies.js')
  sw = (globalThis as unknown as { EypiSw: Sw }).EypiSw
})

function req(url: string, init: RequestInit & { mode?: RequestMode } = {}) {
  return new Request(url, init)
}
function pick(url: string, init: RequestInit = {}) {
  const request = req(url, init)
  return sw.pickStrategy(new URL(url), request)
}
function html(body = '<html></html>', init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' }, ...init })
}
function deps(fetchImpl: Deps['fetch'], caches = new FakeCaches()): Deps {
  return { caches, fetch: fetchImpl, shellCache: 'eypi-shell-test' }
}

describe('pickStrategy', () => {
  it.each([
    ['https://eypi.cc/assets/index-abc.js', 'asset-cache-first'],
    ['https://eypi.cc/assets/font.woff2', 'asset-cache-first'],
    ['https://eypi.cc/media/orgs/a.webp', 'media-cache-first'],
    ['https://api.eypi.cc/api/tickets', 'tickets-network-first'],
    ['https://api.eypi.cc/api/tickets/guest/tok123', 'tickets-network-first'],
    ['https://api.eypi.cc/api/me', 'bypass'],
    ['https://api.eypi.cc/api/tickets/123/cancel', 'bypass'],
    ['https://api.eypi.cc/api/links', 'bypass'],
    ['https://eypi.cc/api/tickets', 'bypass'],
    ['https://evil.example/assets/x.js', 'bypass'],
    ['https://eypi.cc/sw.js', 'bypass'],
  ])('%s -> %s', (url, expected) => {
    expect(pick(url)).toBe(expected)
  })

  it('treats a navigation as the network-first shell (html is network first)', () => {
    const request = { url: 'https://eypi.cc/tickets', method: 'GET', mode: 'navigate', headers: new Headers() } as unknown as Request
    expect(sw.pickStrategy(new URL(request.url), request)).toBe('shell-network-first')
  })

  it('bypasses anything that is not a plain GET', () => {
    expect(pick('https://eypi.cc/assets/x.js', { method: 'POST' })).toBe('bypass')
    expect(pick('https://api.eypi.cc/api/tickets', { method: 'DELETE' })).toBe('bypass')
    expect(pick('https://eypi.cc/media/v.mp4', { headers: { Range: 'bytes=0-10' } })).toBe('bypass')
  })
})

describe('cache names', () => {
  it('uses the fixed names', () => {
    expect(sw.CACHE_NAMES.media).toBe('eypi-media-v1')
    expect(sw.CACHE_NAMES.tickets).toBe('eypi-tickets-v1')
    expect(sw.CACHE_NAMES.shellPrefix).toBe('eypi-shell-')
  })
})

describe('html is network first', () => {
  const nav = () => req('https://eypi.cc/tickets')

  it('serves the network copy and refreshes the cached shell', async () => {
    const caches = new FakeCaches()
    const res = await sw.shellNetworkFirst(nav(), deps(async () => html('fresh'), caches))
    expect(await res.text()).toBe('fresh')
    const shell = await caches.open('eypi-shell-test')
    expect(await (await shell.match('/index.html'))!.text()).toBe('fresh')
  })

  it('falls back to the cached shell when the network fails', async () => {
    const caches = new FakeCaches()
    await (await caches.open('eypi-shell-test')).put('/index.html', html('cached'))
    const res = await sw.shellNetworkFirst(nav(), deps(async () => { throw new TypeError('offline') }, caches))
    expect(await res.text()).toBe('cached')
  })

  it('falls back to the cached shell after 3000 ms of silence', async () => {
    vi.useFakeTimers()
    try {
      const caches = new FakeCaches()
      await (await caches.open('eypi-shell-test')).put('/index.html', html('cached'))
      const slow = () => new Promise<Response>((resolve) => setTimeout(() => resolve(html('late')), 10_000))
      const pending = sw.shellNetworkFirst(nav(), deps(slow, caches))
      await vi.advanceTimersByTimeAsync(2999)
      let settled = false
      void pending.then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await (await pending).text()).toBe('cached')
      expect(sw.HTML_TIMEOUT_MS).toBe(3000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for a slow network when nothing is cached', async () => {
    vi.useFakeTimers()
    try {
      const slow = () => new Promise<Response>((resolve) => setTimeout(() => resolve(html('late')), 5000))
      const pending = sw.shellNetworkFirst(nav(), deps(slow))
      await vi.advanceTimersByTimeAsync(5000)
      expect(await (await pending).text()).toBe('late')
    } finally {
      vi.useRealTimers()
    }
  })

  it('never caches error pages or redirects as the shell', async () => {
    const caches = new FakeCaches()
    const res = await sw.shellNetworkFirst(nav(), deps(async () => html('nope', { status: 404 }), caches))
    expect(res.status).toBe(404)
    const shell = await caches.open('eypi-shell-test')
    expect(await shell.match('/index.html')).toBeUndefined()
  })
})

describe('assets', () => {
  it('serves from cache without touching the network', async () => {
    const caches = new FakeCaches()
    await (await caches.open('eypi-shell-test')).put('/assets/a.js', new Response('js', { headers: { 'Content-Type': 'text/javascript' } }))
    const fetchSpy = vi.fn()
    const res = await sw.assetCacheFirst(req('https://eypi.cc/assets/a.js'), deps(fetchSpy, caches))
    expect(await res.text()).toBe('js')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('caches a fresh ok asset', async () => {
    const caches = new FakeCaches()
    await sw.assetCacheFirst(req('https://eypi.cc/assets/b.js'), deps(async () => new Response('js', { headers: { 'Content-Type': 'text/javascript' } }), caches))
    expect(await (await caches.open('eypi-shell-test')).match('/assets/b.js')).toBeDefined()
  })

  it('does not cache the spa fallback html served for a missing chunk', async () => {
    const caches = new FakeCaches()
    const res = await sw.assetCacheFirst(req('https://eypi.cc/assets/gone.js'), deps(async () => html(), caches))
    expect(res.status).toBe(200)
    expect(await (await caches.open('eypi-shell-test')).match('/assets/gone.js')).toBeUndefined()
  })
})

describe('media', () => {
  it('evicts the oldest entries beyond 150', async () => {
    expect(sw.MEDIA_LIMIT).toBe(150)
    const cache = makeCache()
    for (let i = 0; i < 155; i++) await cache.put(`/media/${i}.webp`, new Response('x'))
    await sw.trimCache(cache, sw.MEDIA_LIMIT)
    expect(cache.map.size).toBe(150)
    expect(cache.map.has('/media/0.webp')).toBe(false)
    expect(cache.map.has('/media/4.webp')).toBe(false)
    expect(cache.map.has('/media/5.webp')).toBe(true)
    expect(cache.map.has('/media/154.webp')).toBe(true)
  })

  it('caches ok media and trims after a put', async () => {
    const caches = new FakeCaches()
    const media = await caches.open('eypi-media-v1')
    for (let i = 0; i < 150; i++) await media.put(`/media/${i}.webp`, new Response('x'))
    const res = await sw.mediaCacheFirst(req('https://eypi.cc/media/new.webp'), deps(async () => new Response('img', { headers: { 'Content-Type': 'image/webp' } }), caches))
    expect(await res.text()).toBe('img')
    expect(media.map.size).toBe(150)
    expect(media.map.has('/media/new.webp')).toBe(true)
    expect(media.map.has('/media/0.webp')).toBe(false)
  })

  it('refreshes recency on a hit so a used entry survives eviction', async () => {
    const caches = new FakeCaches()
    const media = await caches.open('eypi-media-v1')
    await media.put('/media/old.webp', new Response('x'))
    await media.put('/media/other.webp', new Response('y'))
    await sw.mediaCacheFirst(req('https://eypi.cc/media/old.webp'), deps(vi.fn(), caches))
    expect([...media.map.keys()].pop()).toBe('/media/old.webp')
  })
})

describe('tickets', () => {
  const url = 'https://api.eypi.cc/api/tickets'

  it('caches a good response and serves it when offline', async () => {
    const caches = new FakeCaches()
    const ok = () => new Response('[1]', { headers: { 'Content-Type': 'application/json' } })
    const first = await sw.ticketsNetworkFirst(req(url), deps(async () => ok(), caches))
    expect(await first.text()).toBe('[1]')
    const offline = await sw.ticketsNetworkFirst(req(url), deps(async () => { throw new TypeError('offline') }, caches))
    expect(await offline.text()).toBe('[1]')
    expect(offline.headers.get('X-Eypi-Offline')).toBe('1')
  })

  it('drops the cached copy on 401 or 403 and returns the error', async () => {
    const caches = new FakeCaches()
    const store = await caches.open('eypi-tickets-v1')
    await store.put(url, new Response('[1]'))
    const res = await sw.ticketsNetworkFirst(req(url), deps(async () => new Response('no', { status: 401 }), caches))
    expect(res.status).toBe(401)
    expect(await store.match(url)).toBeUndefined()
  })

  it('does not cache errors, set-cookie responses or opaque responses', async () => {
    for (const make of [
      () => new Response('boom', { status: 500 }),
      () => new Response('[1]', { headers: { 'Set-Cookie': 'a=b' } }),
    ]) {
      const caches = new FakeCaches()
      await sw.ticketsNetworkFirst(req(url), deps(async () => make(), caches))
      expect(await (await caches.open('eypi-tickets-v1')).match(url)).toBeUndefined()
    }
    expect(sw.cacheable({ ok: true, status: 200, type: 'opaque', headers: new Headers() } as unknown as Response)).toBe(false)
    expect(sw.cacheable({ ok: true, status: 206, type: 'basic', headers: new Headers() } as unknown as Response)).toBe(false)
  })

  it('rethrows when offline with nothing cached', async () => {
    await expect(sw.ticketsNetworkFirst(req(url), deps(async () => { throw new TypeError('offline') }))).rejects.toThrow('offline')
  })
})

describe('sw.js wiring', () => {
  function load(file: string, extra: Record<string, unknown> = {}) {
    const listeners: Record<string, (e: unknown) => void> = {}
    const caches = new FakeCaches()
    const self = {
      addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn },
      skipWaiting: vi.fn(async () => {}),
      clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => []) },
      registration: { unregister: vi.fn(async () => true) },
      location: { origin: 'https://eypi.cc' },
    }
    const ctx = {
      self,
      caches,
      fetch: vi.fn(async () => html()),
      importScripts: () => { (ctx as Record<string, unknown>).EypiSw = sw },
      EypiSw: undefined as unknown,
      Promise, URL, Request, Response, Headers, setTimeout, clearTimeout,
      ...extra,
    }
    runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), ctx)
    return { listeners, caches, self, ctx }
  }
  const waitable = () => {
    const holder: { p?: Promise<unknown> } = {}
    return { holder, event: { waitUntil: (p: Promise<unknown>) => { holder.p = p } } }
  }

  it('deletes old shell caches on activate and keeps media and tickets', async () => {
    const { listeners, caches, self } = load('sw.js')
    for (const name of ['eypi-shell-old', 'eypi-shell-dev', 'eypi-media-v1', 'eypi-tickets-v1', 'other-app']) await caches.open(name)
    const { holder, event } = waitable()
    listeners.activate(event)
    await holder.p
    const left = await caches.keys()
    expect(left).toContain('eypi-shell-dev')
    expect(left).not.toContain('eypi-shell-old')
    expect(left).toEqual(expect.arrayContaining(['eypi-media-v1', 'eypi-tickets-v1', 'other-app']))
    expect(self.clients.claim).toHaveBeenCalled()
  })

  it('clears the tickets cache on a clear-tickets message', async () => {
    const { listeners, caches } = load('sw.js')
    await caches.open('eypi-tickets-v1')
    const { holder, event } = waitable()
    listeners.message({ data: { type: 'clear-tickets' }, waitUntil: event.waitUntil })
    await holder.p
    expect(await caches.keys()).not.toContain('eypi-tickets-v1')
  })

  it('does not intercept requests that bypass', () => {
    const { listeners } = load('sw.js')
    const respondWith = vi.fn()
    listeners.fetch({ request: req('https://api.eypi.cc/api/me'), respondWith })
    expect(respondWith).not.toHaveBeenCalled()
  })
})

describe('sw-kill.js', () => {
  it('unregisters itself and deletes every eypi cache', async () => {
    const listeners: Record<string, (e: unknown) => void> = {}
    const caches = new FakeCaches()
    for (const name of ['eypi-shell-a', 'eypi-media-v1', 'eypi-tickets-v1', 'other-app']) await caches.open(name)
    const navigate = vi.fn(async () => null)
    const self = {
      addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn },
      skipWaiting: vi.fn(async () => {}),
      clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => [{ url: 'https://eypi.cc/', navigate }]) },
      registration: { unregister: vi.fn(async () => true) },
    }
    runInNewContext(readFileSync(new URL('../public/sw-kill.js', import.meta.url), 'utf8'), { self, caches, Promise })
    const install = { waitUntil: vi.fn() }
    listeners.install(install)
    expect(self.skipWaiting).toHaveBeenCalled()
    let p: Promise<unknown> | undefined
    listeners.activate({ waitUntil: (x: Promise<unknown>) => { p = x } })
    await p
    expect(await caches.keys()).toEqual(['other-app'])
    expect(self.registration.unregister).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('https://eypi.cc/')
  })

  it('never answers fetches', () => {
    const src = readFileSync(new URL('../public/sw-kill.js', import.meta.url), 'utf8')
    expect(src).not.toMatch(/respondWith/)
  })
})

describe('public/_headers', () => {
  it('serves the worker scripts with no-cache', () => {
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
    for (const path of ['/sw.js', '/sw-strategies.js', '/sw-kill.js']) {
      expect(headers).toMatch(new RegExp(`^${path.replace('.', '\\.')}\\n\\s+Cache-Control: no-cache`, 'm'))
    }
  })
})
