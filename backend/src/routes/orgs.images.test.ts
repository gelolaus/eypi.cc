import { describe, expect, it } from 'vitest'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const owner: TestUser = {
  id: 'owner-1',
  email: 'owner@student.apc.edu.ph',
  name: 'Owner Omar',
  role: 'user',
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function dataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

describe('GET /api/orgs/public', () => {
  it('GET /api/orgs/public payload has no data: strings', async () => {
    const logo = png(8, 8)
    const { request, client, env } = await createTestApp({
      user: owner,
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO organizations (id, name, owner_id, is_public_catalog, logo_url)
            VALUES (?, ?, ?, 1, ?), (?, ?, ?, 1, NULL)`,
          args: ['alpha', 'Alpha', owner.id, 'data:image/png;base64,LEGACY', 'beta', 'Beta', owner.id],
        })
      },
    })

    const patched = await request('/api/orgs/beta/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ logoUrl: dataUrl(logo), bannerUrl: dataUrl(png(12, 4)) }),
    })
    expect(patched.status).toBe(200)
    const saved = await patched.json() as { profile: { logoUrl: string | null; bannerUrl: string | null } }
    expect(saved.profile.logoUrl).toMatch(/^\/media\/orgs\/beta\/logo-[0-9a-f]{8}\.png$/)
    expect(saved.profile.bannerUrl).toMatch(/^\/media\/orgs\/beta\/banner-[0-9a-f]{8}\.png$/)
    expect(JSON.stringify(saved)).not.toContain('data:')

    const listed = await request('/api/orgs/public')
    expect(listed.status).toBe(200)
    const body = await listed.json() as { orgs: { slug: string; logoUrl: string | null }[] }
    expect(JSON.stringify(body)).not.toContain('data:')
    expect(body.orgs.map((org) => org.slug)).toEqual(['alpha', 'beta'])
    expect(body.orgs[0].logoUrl).toBeNull()
    expect(body.orgs[1].logoUrl).toBe(saved.profile.logoUrl)

    const stored = await client.execute({
      sql: 'SELECT logo_url, banner_url FROM organizations WHERE id = ?',
      args: ['beta'],
    })
    const logoKey = String(stored.rows[0]?.logo_url)
    const bannerKey = String(stored.rows[0]?.banner_url)
    expect(logoKey).toBe(saved.profile.logoUrl?.replace(/^\/media\//, ''))
    expect(bannerKey.startsWith('orgs/beta/banner-')).toBe(true)
    expect(await env.MEDIA.get(logoKey)).not.toBeNull()
    expect(await env.MEDIA.get(bannerKey)).not.toBeNull()
  })
})
