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
})
