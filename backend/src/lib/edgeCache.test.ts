import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { withEdgeCache } from './edgeCache'

const CC = 'public, max-age=30, stale-while-revalidate=300'

function installFakeCache() {
  const map = new Map<string, Response>()
  ;(globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (req: Request) => map.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => {
        map.set(req.url, res)
      },
    },
  }
  return map
}

function makeApp(opts: { status?: number; setCookie?: boolean } = {}) {
  let calls = 0
  const app = new Hono()
  app.get('/pub', (c) =>
    withEdgeCache(c, 30, async () => {
      calls += 1
      const headers = opts.setCookie ? { 'Set-Cookie': 'a=b' } : undefined
      return c.json({ n: calls }, (opts.status ?? 200) as 200, headers)
    }),
  )
  return { app, calls: () => calls }
}

describe('withEdgeCache', () => {
  beforeEach(() => {
    installFakeCache()
  })
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches
  })

  it('runs the handler once for two anonymous requests and sets the exact header', async () => {
    const { app, calls } = makeApp()
    const a = await app.request('http://x.test/pub?q=1')
    const b = await app.request('http://x.test/pub?q=1')
    expect(calls()).toBe(1)
    expect(a.headers.get('Cache-Control')).toBe(CC)
    expect(b.headers.get('Cache-Control')).toBe(CC)
    expect(await b.json()).toEqual({ n: 1 })
  })

  it('keys on the full URL including the query', async () => {
    const { app, calls } = makeApp()
    await app.request('http://x.test/pub?q=1')
    await app.request('http://x.test/pub?q=2')
    expect(calls()).toBe(2)
  })

  it('bypasses the cache for a session cookie or Authorization header', async () => {
    const { app, calls } = makeApp()
    await app.request('http://x.test/pub')
    const a = await app.request('http://x.test/pub', { headers: { Cookie: 'eypi_session=tok' } })
    const b = await app.request('http://x.test/pub', { headers: { Cookie: '__Host-eypi_session=tok' } })
    const c = await app.request('http://x.test/pub', { headers: { Authorization: 'Bearer x' } })
    expect(calls()).toBe(4)
    for (const res of [a, b, c]) expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('does not store a personalized response for later anonymous viewers', async () => {
    const { app, calls } = makeApp()
    await app.request('http://x.test/pub', { headers: { Cookie: 'eypi_session=tok' } })
    await app.request('http://x.test/pub')
    expect(calls()).toBe(2)
  })

  it('ignores unrelated cookies', async () => {
    const { app, calls } = makeApp()
    await app.request('http://x.test/pub', { headers: { Cookie: 'theme=dark' } })
    await app.request('http://x.test/pub')
    expect(calls()).toBe(1)
  })

  it('never caches non-200 responses', async () => {
    const { app, calls } = makeApp({ status: 404 })
    const a = await app.request('http://x.test/pub')
    await app.request('http://x.test/pub')
    expect(calls()).toBe(2)
    expect(a.headers.get('Cache-Control')).not.toBe(CC)
  })

  it('never caches responses that set cookies', async () => {
    const { app, calls } = makeApp({ setCookie: true })
    await app.request('http://x.test/pub')
    await app.request('http://x.test/pub')
    expect(calls()).toBe(2)
  })

  it('still sets the header when no edge cache exists', async () => {
    delete (globalThis as { caches?: unknown }).caches
    const { app } = makeApp()
    const res = await app.request('http://x.test/pub')
    expect(res.headers.get('Cache-Control')).toBe(CC)
  })
})
