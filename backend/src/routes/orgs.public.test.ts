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

  it('lists only published public events on the org profile', async () => {
    const { request } = await createTestApp({
      seed: async (client) => {
        await client.executeMultiple(`
          INSERT INTO users (id, email, name) VALUES ('own', 'own@apc.edu.ph', 'Own');
          INSERT INTO organizations (id, name, owner_id, is_public_catalog) VALUES ('org-pub', 'Pub', 'own', 1);
        `)
        const rows: [string, string, string, string][] = [
          ['ok', 'published', 'public', '2099-01-01'],
          ['draft', 'draft', 'public', '2099-01-02'],
          ['hidden', 'published', 'unlisted', '2099-01-03'],
          ['closed', 'closed', 'public', '2099-01-04'],
          ['old-draft', 'draft', 'public', '2000-01-01'],
          ['old-hidden', 'published', 'unlisted', '2000-01-02'],
          ['old-ok', 'published', 'public', '2000-01-03'],
        ]
        for (const [slug, status, visibility, date] of rows) {
          await client.execute({
            sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, status, visibility)
                  VALUES (?, ?, 'own', ?, ?, '09:00', 'Hall', 'org-pub', ?, ?)`,
            args: [`id-${slug}`, slug, slug, date, status, visibility],
          })
        }
      },
    })
    const res = await request('/api/orgs/public/org-pub')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { events: { upcoming: { slug: string }[]; past: { slug: string }[] } }
    expect(body.events.upcoming.map((e) => e.slug).sort()).toEqual(['closed', 'ok'])
    expect(body.events.past.map((e) => e.slug)).toEqual(['old-ok'])
  })
})
