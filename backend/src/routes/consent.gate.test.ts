import { describe, expect, it } from 'vitest'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const user: TestUser = {
  id: 'user-1',
  email: 'ada@student.apc.edu.ph',
  name: 'Ada',
  role: 'user',
}

const CONSENT_REQUIRED = {
  error: {
    code: 'consent_required',
    message: 'Accept the current privacy policy and terms to continue.',
  },
}

async function appWithoutConsent() {
  const ctx = await createTestApp({ user })
  await ctx.request('/api/me')
  await ctx.client.execute({ sql: 'DELETE FROM legal_consents WHERE user_id = ?', args: [user.id] })
  return ctx
}

const json = {
  method: 'POST',
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: '{}',
} as const

describe('consent gate on org-gated routers', () => {
  it('blocks an events mutation', async () => {
    const { request } = await appWithoutConsent()
    const res = await request('/api/events', json)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('blocks an events read', async () => {
    const { request } = await appWithoutConsent()
    const res = await request('/api/events')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('blocks a frames mutation', async () => {
    const { request } = await appWithoutConsent()
    const res = await request('/api/dp', json)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('blocks forms routes', async () => {
    const { request } = await appWithoutConsent()
    const res = await request('/api/forms')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('leaves public routes open', async () => {
    const { request } = await appWithoutConsent()
    const guest = await request(`/api/tickets/guest/${'a'.repeat(32)}`)
    expect(guest.status).toBe(404)
    expect(await guest.json()).not.toEqual(CONSENT_REQUIRED)
    const page = await request('/api/dp/none')
    expect(page.status).toBe(404)
    const download = await request('/api/dp/none/download', json)
    expect(download.status).toBe(404)
    expect((await request('/api/health')).status).not.toBe(403)
    expect((await request('/api/me')).status).toBe(200)
  })

  it('lets a consenting user past the gate', async () => {
    const { request } = await createTestApp({ user })
    const res = await request('/api/forms')
    expect(await res.json()).not.toEqual(CONSENT_REQUIRED)
  })
})
