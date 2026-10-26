import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const BAD_ORIGIN = {
  error: {
    code: 'bad_origin',
    message: 'This request came from an untrusted origin.',
  },
}

describe('CSRF origin check', () => {
  it('returns 403 bad_origin for POST without Origin', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'promo', reason: 'phishing' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(BAD_ORIGIN)
  })

  it('lets POST from https://eypi.cc through', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://eypi.cc' },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('eypi_session=')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('lets a localhost origin through outside production', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(res.status).toBe(204)
  })

  it('rejects a localhost origin when ENVIRONMENT is production', async () => {
    const { request } = await createTestApp({ env: { ENVIRONMENT: 'production' } })

    const res = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(BAD_ORIGIN)
  })
})

describe('CORS allowlist', () => {
  it('allows only Content-Type and X-Active-Org-Id', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://eypi.cc',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-active-org-id',
      },
    })

    expect(res.headers.get('access-control-allow-origin')).toBe('https://eypi.cc')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type,X-Active-Org-Id')
  })

  it('drops localhost from CORS when ENVIRONMENT is production', async () => {
    const { request } = await createTestApp({ env: { ENVIRONMENT: 'production' } })

    const res = await request('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
