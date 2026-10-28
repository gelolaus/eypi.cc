import type { Context } from 'hono'
import { sessionCookieName } from './auth/session'

const SESSION_COOKIE_NAMES = [sessionCookieName({ ENVIRONMENT: 'production' }), sessionCookieName(undefined)]

type EdgeCacheStore = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

function defaultStore(): EdgeCacheStore | null {
  const caches = (globalThis as { caches?: { default?: EdgeCacheStore } }).caches
  return caches?.default ?? null
}

/** True when the request carries anything that could make the response viewer-specific. */
function isPersonalized(c: Context): boolean {
  if (c.req.header('Authorization')) return true
  const cookie = c.req.header('Cookie') ?? ''
  if (!cookie) return false
  const names = cookie.split(';').map((part) => part.trim().split('=')[0])
  return names.some((name) => SESSION_COOKIE_NAMES.includes(name))
}

function withoutOriginHeaders(res: Response): Response {
  const clone = res.clone()
  const headers = new Headers(clone.headers)
  for (const name of [...headers.keys()]) {
    if (name.startsWith('access-control-') || name === 'vary') headers.delete(name)
  }
  return new Response(clone.body, { status: clone.status, headers })
}

function isCacheable(res: Response): boolean {
  if (res.status !== 200) return false
  if (res.headers.has('Set-Cookie')) return false
  if (res.headers.get('Vary')?.includes('*')) return false
  return true
}

/**
 * Cache an anonymous, public GET response at the edge for `ttlSec` seconds.
 *
 * Only use for handlers whose output is identical for every anonymous viewer.
 * The key is the full URL (path and query) with a bare GET, so no request header can
 * influence it. Requests with a session cookie or Authorization header, non-200
 * responses, and responses that set cookies are never stored. CORS headers are added
 * by outer middleware after this returns, so they are never part of the cached copy.
 */
export async function withEdgeCache(
  c: Context,
  ttlSec: number,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (c.req.method !== 'GET' || isPersonalized(c)) {
    const res = await handler()
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  const store = defaultStore()
  const key = new Request(c.req.url, { method: 'GET' })
  if (store) {
    const hit = await store.match(key)
    if (hit) return hit
  }

  const res = await handler()
  if (!isCacheable(res)) return res

  res.headers.set('Cache-Control', `public, max-age=${ttlSec}, stale-while-revalidate=300`)
  if (store) {
    const write = store.put(key, withoutOriginHeaders(res)).catch(() => {})
    try {
      c.executionCtx.waitUntil(write)
    } catch {
      await write
    }
  }
  return res
}
