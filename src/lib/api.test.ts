// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'
import { api, ApiError } from '@/lib/api'
import { useSession } from '@/stores/session'
import { peekQuery, prefetchQuery } from '@/lib/queryCache'

const { push, currentRoute } = vi.hoisted(() => ({
  push: vi.fn(),
  currentRoute: {
    value: { fullPath: '/manage/tix/spring-formal', name: 'event-manage' },
  },
}))

vi.mock('@/router', () => ({
  default: {
    push,
    currentRoute,
  },
}))

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  push.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  currentRoute.value = { fullPath: '/manage/tix/spring-formal', name: 'event-manage' }
  useSession().reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  useSession().reset()
})

describe('api client', () => {
  it('sends credentials and the active org header without a bearer token', async () => {
    const legacyKey = ['eypi', 'token'].join('_')
    localStorage.setItem(legacyKey, 'tok-1')
    localStorage.setItem('active_org_id', 'org-1')
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await expect(api.get<{ ok: boolean }>('/api/orgs')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_BASE_URL}/api/orgs`)
    expect(init.credentials).toBe('include')
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('X-Active-Org-Id')).toBe('org-1')
  })

  it('parses an error object into ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, {
      error: {
        code: 'slug_taken',
        message: 'That slug is taken.',
        fields: { slug: 'Already in use.' },
      },
    }))

    const error = await api.post('/api/links', { original_url: 'https://example.com' }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'slug_taken',
      message: 'That slug is taken.',
      fields: { slug: 'Already in use.' },
    })
  })

  it('turns an HTML error body into a generic ApiError', async () => {
    fetchMock.mockResolvedValue(new Response('<html><body>bad gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    }))

    const error = await api.get('/api/health').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Something went wrong.',
    })
  })

  it('resets the session once and routes to login with returnTo on 401', async () => {
    const reset = vi.spyOn(useSession(), 'reset')
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in again.' },
    }))

    const error = await api.get('/api/links').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized', message: 'Sign in again.' })
    expect(reset).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({
      name: 'login',
      query: { returnTo: '/manage/tix/spring-formal' },
    })
    reset.mockRestore()
  })

  it('does not reset the session when GET /api/me is 401', async () => {
    const reset = vi.spyOn(useSession(), 'reset')
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))

    const error = await api.get('/api/me').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(reset).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    reset.mockRestore()
  })
})

describe('query cache and sign-out', () => {
  it('is cleared when an API call returns 401', async () => {
    await prefetchQuery('links:list:', async () => ({ items: [{ id: 'private' }] }))
    expect(peekQuery('links:list:')).toBeDefined()
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'unauthorized', message: 'No.' } }))
    await expect(api.get('/api/links')).rejects.toBeInstanceOf(ApiError)
    expect(peekQuery('links:list:')).toBeUndefined()
  })

  it('is cleared on logout and on session reset', async () => {
    await prefetchQuery('links:summary', async () => 1)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await useSession().logout()
    expect(peekQuery('links:summary')).toBeUndefined()

    await prefetchQuery('links:summary', async () => 1)
    useSession().reset()
    expect(peekQuery('links:summary')).toBeUndefined()
  })
})

describe('cache invalidation after writes', () => {
  const cases: Array<[string, string, string[]]> = [
    ['POST', '/api/events', ['events:list:x', 'orgs:summary:x']],
    ['PATCH', '/api/events/launch', ['events:list:x', 'orgs:summary:x']],
    ['DELETE', '/api/events/launch', ['events:list:x', 'orgs:summary:x']],
    ['DELETE', '/api/events/launch/registration', ['events:public:launch', 'tickets:list']],
    ['POST', '/api/events/launch/register', ['tickets:list']],
    ['POST', '/api/dp', ['dp:list:x', 'orgs:summary:x']],
    ['POST', '/api/dp/1/frames', ['dp:list:x', 'orgs:summary:x']],
    ['PATCH', '/api/orgs/jpcs/profile', ['orgs:catalog', 'orgs:summary:x']],
    ['POST', '/api/links', ['links:summary']],
  ]
  for (const [method, path, keys] of cases) {
    it(`${method} ${path} drops ${keys.join(', ')}`, async () => {
      for (const k of keys) await prefetchQuery(k, async () => 1)
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
      await api.raw(path, { method })
      for (const k of keys) expect(peekQuery(k)).toBeUndefined()
    })
  }

  it('keeps the cache on reads and failed writes', async () => {
    await prefetchQuery('events:list:x', async () => 1)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await api.raw('/api/events')
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}))
    await api.raw('/api/events', { method: 'POST' })
    expect(peekQuery('events:list:x')).toBeDefined()
  })
})
