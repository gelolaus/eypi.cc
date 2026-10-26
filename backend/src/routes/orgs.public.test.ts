import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'
const ORG_ID = '7d0f3c1e-5a6b-4c1d-9e2f-0a1b2c3d4e5f'

describe('orgs public route allowlist', () => {
  it('still requires auth on a members path that merely contains /public/', async () => {
    const { request } = await createTestApp()
    const res = await request(`/api/orgs/${ORG_ID}/members/public/resend`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    })
    expect(res.status).toBe(401)
  })

  it('still requires auth on a path ending in /public under an org id', async () => {
    const { request } = await createTestApp()
    const res = await request(`/api/orgs/${ORG_ID}/public`, { headers: { Origin: ORIGIN } })
    expect(res.status).toBe(401)
  })

  it('keeps the public catalog and profile open', async () => {
    const { request } = await createTestApp()
    expect((await request('/api/orgs/public')).status).toBe(200)
    expect((await request('/api/orgs/public/nope')).status).toBe(404)
  })

  it('does not open public paths to unsafe methods', async () => {
    const { request } = await createTestApp()
    const res = await request('/api/orgs/public', { method: 'POST', headers: { Origin: ORIGIN } })
    expect(res.status).toBe(401)
  })
})
