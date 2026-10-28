import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const UNAUTHORIZED = {
  error: { code: 'unauthorized', message: 'Sign in to continue.' },
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function seedSession(opts: {
  disabled?: boolean
  expiresAt?: string
  consent?: 'current' | 'acceptable-use'
} = {}) {
  const token = `token-${opts.disabled ? 'disabled' : opts.expiresAt ? 'expired' : 'live'}`
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const harness = await createTestApp({
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role, disabled_at) VALUES (?, ?, ?, ?, ?)',
        args: [
          'ada-id',
          'ada@apc.edu.ph',
          'Ada',
          'user',
          opts.disabled ? '2026-10-01T00:00:00.000Z' : null,
        ],
      })
      await db.execute({
        sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        args: ['owner-id', 'owner@apc.edu.ph', 'Owner'],
      })
      await db.execute({
        sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
        args: ['org-alpha', 'Alpha', 'ada-id'],
      })
      await db.execute({
        sql: `INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)`,
        args: ['org-alpha', 'ada@apc.edu.ph', 'ada-id', '2026-01-01T00:00:00.000Z'],
      })
      await db.execute({
        sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
        args: ['org-beta', 'Beta', 'owner-id'],
      })
      await db.execute({
        sql: 'INSERT INTO org_members (org_id, email, activated_at) VALUES (?, ?, NULL)',
        args: ['org-beta', 'ada@apc.edu.ph'],
      })
      await db.execute({
        sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
        args: ['org-gamma', 'Gamma', 'owner-id'],
      })
      await db.execute({
        sql: 'INSERT INTO org_members (org_id, email, activated_at, declined_at) VALUES (?, ?, NULL, ?)',
        args: ['org-gamma', 'ada@apc.edu.ph', '2026-10-01T00:00:00.000Z'],
      })
      await db.execute({
        sql: `INSERT INTO sessions (id, user_id, expires_at, last_seen_at) VALUES (?, ?, ?, ?)`,
        args: [await sha256Hex(token), 'ada-id', expiresAt, new Date().toISOString()],
      })
      if (opts.consent === 'current') {
        await db.execute({
          sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES
            ('consent-privacy', 'ada-id', 'privacy', '2026-11-15'),
            ('consent-terms', 'ada-id', 'terms', '2026-11-01')`,
        })
      }
      if (opts.consent === 'acceptable-use') {
        await db.execute({
          sql: `INSERT INTO legal_consents (id, user_id, document, version)
            VALUES ('consent-aup', 'ada-id', 'acceptable-use', '2026-11-01')`,
        })
      }
    },
  })
  return { ...harness, token }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/me', () => {
  it('returns 401 for an anonymous request', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/me')

    expect(res.status).toBe(401)
  })

  it('returns the user, pending invites, privacy and terms in needsConsent, and orgs, ignoring a declined row', async () => {
    const { request, token } = await seedSession()

    const res = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as {
      user: { id: string; email: string; name: string; role: string }
      pendingInviteCount: number
      needsConsent: unknown[]
      orgs: { org_id: string; org_name: string; is_owner: number }[]
    }
    expect(body.user).toEqual({
      id: 'ada-id',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'user',
    })
    expect(body.pendingInviteCount).toBe(1)
    expect(body.needsConsent).toEqual([
      { document: 'privacy', version: '2026-11-15' },
      { document: 'terms', version: '2026-11-01' },
    ])
    expect(body.orgs.map((org) => org.org_id)).toEqual(['org-alpha'])
    expect(body.orgs[0]).toMatchObject({ org_name: 'Alpha', is_owner: 1 })
  })

  it('returns an empty needsConsent after the current privacy and terms are accepted', async () => {
    const { request, token } = await seedSession({ consent: 'current' })

    const res = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { needsConsent: unknown[] }
    expect(body.needsConsent).toEqual([])
  })

  it('still lists privacy and terms when only acceptable use is accepted', async () => {
    const { request, token } = await seedSession({ consent: 'acceptable-use' })

    const res = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { needsConsent: unknown[] }
    expect(body.needsConsent).toEqual([
      { document: 'privacy', version: '2026-11-15' },
      { document: 'terms', version: '2026-11-01' },
    ])
  })

  it('returns 401 for a disabled user session', async () => {
    const { request, token } = await seedSession({ disabled: true })

    const res = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED)
  })

  it('returns 401 for an expired session', async () => {
    const { request, token } = await seedSession({ expiresAt: '2000-01-01T00:00:00.000Z' })

    const res = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED)
  })

  it('returns 503 session_unavailable when the session lookup throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { request, client } = await createTestApp()
    await client.execute('DROP TABLE sessions')

    const res = await request('/api/me', {
      headers: { Cookie: 'eypi_session=raw-token' },
    })

    expect(res.status).toBe(503)
    expect(res.status).not.toBe(401)
    expect(await res.json()).toEqual({
      error: {
        code: 'session_unavailable',
        message: 'Sign-in is temporarily unavailable. Try again.',
      },
    })
  })
})

describe('POST /api/auth/logout', () => {
  it('deletes the session and clears the cookie', async () => {
    const { request, client, token } = await seedSession()

    const res = await request('/api/auth/logout', {
      method: 'POST',
      headers: {
        Origin: 'https://eypi.cc',
        Cookie: `eypi_session=${token}`,
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('eypi_session=')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')

    const left = await client.execute('SELECT COUNT(*) AS n FROM sessions')
    expect(Number(left.rows[0]?.n)).toBe(0)

    const again = await request('/api/me', {
      headers: { Cookie: `eypi_session=${token}` },
    })
    expect(again.status).toBe(401)
  })
})
