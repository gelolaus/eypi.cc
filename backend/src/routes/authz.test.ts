import { describe, expect, it } from 'vitest'
import { sign } from 'hono/jwt'
import type { Client } from '@libsql/client'
import { createSession } from '../lib/auth/session'
import { createTestApp } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'
const LEGACY_BEARER_SECRET = 'test-jwt-secret'

const member = {
  id: 'user-member',
  email: 'arlaus@student.apc.edu.ph',
  name: 'Member',
  role: 'user' as const,
}

const admin = {
  id: 'user-admin',
  email: 'admin@apc.edu.ph',
  name: 'Admin',
  role: 'admin' as const,
}

const owner = {
  id: 'user-owner',
  email: 'owner@student.apc.edu.ph',
  name: 'Owner',
  role: 'user' as const,
}

async function insertUser(
  client: Client,
  user: { id: string; email: string; name: string; role: 'user' | 'admin' },
) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [user.id, user.email, user.name, user.role],
  })
}

async function seedMemberOrg(client: Client) {
  await insertUser(client, member)
  await insertUser(client, owner)
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
    args: ['org-1', 'Alpha', member.id],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', member.email, member.id, '2026-01-01T00:00:00.000Z'],
  })
}

async function sessionRequest(
  user: { id: string; email: string; name: string; role: 'user' | 'admin' } | null,
  seed?: (client: Client) => Promise<void>,
) {
  const harness = await createTestApp({
    seed: async (client) => {
      if (user) await insertUser(client, user)
      if (seed) await seed(client)
    },
  })
  const headers = new Headers()
  if (user) {
    const { token } = await createSession(
      harness.client,
      {},
      user.id,
      new Request('https://eypi.cc/'),
    )
    headers.set('Cookie', `eypi_session=${token}`)
  }
  return {
    request(path: string, init: RequestInit = {}) {
      const next = new Headers(init.headers)
      headers.forEach((value, key) => {
        if (!next.has(key)) next.set(key, value)
      })
      return harness.request(path, { ...init, headers: next })
    },
  }
}

function json(method: string, body: unknown, extra: Record<string, string> = {}): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...extra,
    },
    body: JSON.stringify(body),
  }
}

describe('route authz', () => {
  describe('POST /api/links', () => {
    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null)

      const res = await request('/api/links', json('POST', { url: 'https://example.com' }))

      expect(res.status).toBe(401)
    })

    it('creates a link for a signed-in user', async () => {
      const { request } = await sessionRequest(member)

      const res = await request('/api/links', json('POST', { url: 'https://example.com' }))

      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({
        url: 'https://example.com',
        clicks: 0,
        protected: false,
        hasLogo: false,
      })
    })

    it('rejects a bearer token when the session cookie is absent', async () => {
      const { request } = await sessionRequest(null, async (client) => {
        await insertUser(client, member)
      })
      const token = await sign(
        {
          sub: member.id,
          email: member.email,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        LEGACY_BEARER_SECRET,
      )

      const res = await request('/api/links', json('POST', { url: 'https://example.com' }, {
        Authorization: `Bearer ${token}`,
      }))

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/orgs/:id/profile', () => {
    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null, seedMemberOrg)

      const res = await request('/api/orgs/org-1/profile', json('PATCH', { tagline: 'Hello' }))

      expect(res.status).toBe(401)
    })

    it('updates the profile for a coordinator', async () => {
      const { request } = await sessionRequest(member, async (client) => {
        await insertUser(client, owner)
        await client.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['org-1', 'Alpha', member.id],
        })
      })

      const res = await request('/api/orgs/org-1/profile', json('PATCH', { tagline: 'Hello' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ success: true, profile: { tagline: 'Hello' } })
    })
  })

  describe('POST /api/events', () => {
    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null, seedMemberOrg)

      const res = await request('/api/events', json('POST', {
        name: 'Launch',
        slug: 'launch',
        date: '2026-11-01',
        time: '09:00',
        location: 'Hall',
      }, { 'X-Active-Org-Id': 'org-1' }))

      expect(res.status).toBe(401)
    })

    it('creates an event for a member of the org', async () => {
      const { request } = await sessionRequest(member, async (client) => {
        await insertUser(client, owner)
        await client.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['org-1', 'Alpha', member.id],
        })
        await client.execute({
          sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
          args: ['org-1', member.email, member.id, '2026-01-01T00:00:00.000Z'],
        })
      })

      const res = await request('/api/events', json('POST', {
        name: 'Launch',
        slug: 'launch',
        date: '2026-11-01',
        time: '09:00',
        location: 'Hall',
      }, { 'X-Active-Org-Id': 'org-1' }))

      expect(res.status).toBe(201)
    })
  })

  describe('POST /api/dp', () => {
    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null, seedMemberOrg)

      const res = await request('/api/dp', json('POST', {
        title: 'Frame',
        frames: [{ imageData: 'data:image/png;base64,iVBORw0KGgo=' }],
      }, { 'X-Active-Org-Id': 'org-1' }))

      expect(res.status).toBe(401)
    })

    it('creates a campaign for a member of the org', async () => {
      const { request } = await sessionRequest(member, async (client) => {
        await insertUser(client, owner)
        await client.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['org-1', 'Alpha', member.id],
        })
        await client.execute({
          sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
          args: ['org-1', member.email, member.id, '2026-01-01T00:00:00.000Z'],
        })
      })

      const res = await request('/api/dp', json('POST', {
        title: 'Frame',
        frames: [{ imageData: 'data:image/png;base64,iVBORw0KGgo=' }],
      }, { 'X-Active-Org-Id': 'org-1' }))

      expect(res.status).toBe(201)
    })
  })

  describe('GET /api/forms', () => {
    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null, seedMemberOrg)

      const res = await request('/api/forms', { headers: { 'X-Active-Org-Id': 'org-1' } })

      expect(res.status).toBe(401)
    })

    it('returns the catalog for a member of the org', async () => {
      const { request } = await sessionRequest(member, async (client) => {
        await insertUser(client, owner)
        await client.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['org-1', 'Alpha', member.id],
        })
        await client.execute({
          sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
          args: ['org-1', member.email, member.id, '2026-01-01T00:00:00.000Z'],
        })
      })

      const res = await request('/api/forms', { headers: { 'X-Active-Org-Id': 'org-1' } })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ status: 'ok', orgId: 'org-1' })
    })
  })

  describe('POST /api/orgs', () => {
    const body = { id: 'new-org', name: 'New Org', ownerEmail: owner.email }

    async function seedCreate(client: Client) {
      await insertUser(client, owner)
    }

    it('returns 401 for an anonymous request', async () => {
      const { request } = await sessionRequest(null, seedCreate)

      const res = await request('/api/orgs', json('POST', body))

      expect(res.status).toBe(401)
    })

    it('returns 403 when the session role is user, even for the former super-admin email', async () => {
      const { request } = await sessionRequest(member, seedCreate)

      const res = await request('/api/orgs', json('POST', body))

      expect(res.status).toBe(403)
    })

    it('creates an organization when the session role is admin', async () => {
      const { request } = await sessionRequest(admin, seedCreate)

      const res = await request('/api/orgs', json('POST', body))

      expect(res.status).toBe(201)
    })
  })
})
