import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { badRequest, conflict, forbidden, notFound, onError, tooMany, unauthorized } from './errors'

function appThatThrows(throwError: () => never) {
  const app = new Hono()
  app.onError(onError)
  app.get('/fail', () => {
    throwError()
  })
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('API error contract', () => {
  it('maps helpers onto the contract statuses', () => {
    expect(badRequest('invalid', 'Check the slug.').status).toBe(400)
    expect(unauthorized().status).toBe(401)
    expect(unauthorized().code).toBe('unauthorized')
    expect(forbidden('org_not_accessible', 'You cannot open that organization.').status).toBe(403)
    expect(notFound().status).toBe(404)
    expect(notFound().code).toBe('not_found')
    expect(notFound().message).toBe('Not found')
    expect(conflict('slug_taken', 'That slug is taken.').status).toBe(409)
    expect(tooMany().status).toBe(429)
    expect(tooMany().code).toBe('too_many')
  })

  it("returns 409 with the conflict code when a handler throws conflict('slug_taken')", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appThatThrows(() => {
      throw conflict('slug_taken', 'That slug is taken.')
    })

    const res = await app.request('/fail')

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'slug_taken', message: 'That slug is taken.' },
    })
  })

  it('returns 500 internal and does not leak an unknown error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appThatThrows(() => {
      throw new Error('connect failed for user@example.com token=super-secret-token from 203.0.113.5')
    })

    const res = await app.request('/fail', {
      headers: {
        Authorization: 'Bearer super-secret-token',
        'CF-Connecting-IP': '203.0.113.5',
      },
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Something went wrong.' },
    })
  })

  it('includes field messages on a bad request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appThatThrows(() => {
      throw badRequest('invalid_slug', 'Check the highlighted fields.', {
        slug: 'Use letters and numbers only.',
      })
    })

    const res = await app.request('/fail')

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'invalid_slug',
        message: 'Check the highlighted fields.',
        fields: { slug: 'Use letters and numbers only.' },
      },
    })
  })

  it('logs one JSON line and omits emails, tokens, and IPs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = appThatThrows(() => {
      throw new Error('connect failed for user@example.com token=super-secret-token from 203.0.113.5')
    })

    await app.request('/fail', {
      headers: {
        Authorization: 'Bearer super-secret-token',
        'CF-Connecting-IP': '203.0.113.5',
        'X-Request-Id': 'req-test-1',
      },
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const line = String(spy.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toEqual({
      level: 'error',
      route: '/fail',
      code: 'internal',
      message: 'Something went wrong.',
      requestId: 'req-test-1',
    })
    expect(line).not.toContain('user@example.com')
    expect(line).not.toContain('super-secret-token')
    expect(line).not.toContain('203.0.113.5')
  })
})
