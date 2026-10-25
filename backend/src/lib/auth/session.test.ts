import { describe, expect, it } from 'vitest'
import { hmacIp } from '../ipHash'
import { createTestApp } from '../../test/createTestApp'
import {
  createSession,
  destroyAllSessions,
  destroySession,
  readSession,
  sessionCookieName,
} from './session'

const IP_SECRET = 'test-ip-hash-secret'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function seedUser(id: string, role = 'user') {
  const { client } = await createTestApp({
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [id, `${id}@student.apc.edu.ph`, 'Ada', role],
      })
    },
  })
  return client
}

describe('sessionCookieName', () => {
  it('uses the host-prefixed name in production and eypi_session otherwise', () => {
    expect(sessionCookieName({ ENVIRONMENT: 'production' })).toBe('__Host-eypi_session')
    expect(sessionCookieName({ ENVIRONMENT: 'development' })).toBe('eypi_session')
    expect(sessionCookieName({})).toBe('eypi_session')
  })
})

describe('createSession', () => {
  it('stores sha256(token) and puts the raw token only in the cookie', async () => {
    const client = await seedUser('user-ada')
    const req = new Request('http://localhost/api/me', {
      headers: {
        'User-Agent': 'eypi-test',
        'CF-Connecting-IP': '203.0.113.10',
      },
    })

    const { token, cookie } = await createSession(
      client,
      { ENVIRONMENT: 'development', IP_HASH_SECRET: IP_SECRET },
      'user-ada',
      req,
    )

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(cookie.startsWith(`eypi_session=${token};`)).toBe(true)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=2592000')
    expect(cookie).not.toContain('Domain=')

    const stored = await client.execute('SELECT id, user_id, user_agent, ip_hash, expires_at FROM sessions')
    expect(stored.rows).toHaveLength(1)
    expect(stored.rows[0]?.id).toBe(await sha256Hex(token))
    expect(stored.rows[0]?.id).not.toBe(token)
    expect(stored.rows[0]?.user_id).toBe('user-ada')
    expect(stored.rows[0]?.user_agent).toBe('eypi-test')
    expect(stored.rows[0]?.ip_hash).toBe(await hmacIp(IP_SECRET, '203.0.113.10'))
    expect(stored.rows[0]?.ip_hash).not.toBe('203.0.113.10')

    const expiresAt = Date.parse(String(stored.rows[0]?.expires_at))
    expect(expiresAt).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('names the production cookie __Host-eypi_session', async () => {
    const client = await seedUser('user-prod')
    const { token, cookie } = await createSession(
      client,
      { ENVIRONMENT: 'production' },
      'user-prod',
      new Request('http://localhost/api/me'),
    )

    expect(cookie.startsWith(`__Host-eypi_session=${token};`)).toBe(true)
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Path=/')
    expect(cookie).not.toContain('Domain=')
  })
})

describe('readSession', () => {
  it('returns the user and slides expiry at most once per hour', async () => {
    const client = await seedUser('user-slide', 'admin')
    const { token } = await createSession(
      client,
      {},
      'user-slide',
      new Request('http://localhost/api/me'),
    )

    const before = await client.execute('SELECT expires_at, last_seen_at FROM sessions')
    const user = await readSession(client, token)
    const afterQuiet = await client.execute('SELECT expires_at, last_seen_at FROM sessions')

    expect(user).toEqual({
      id: 'user-slide',
      email: 'user-slide@student.apc.edu.ph',
      name: 'Ada',
      role: 'admin',
    })
    expect(afterQuiet.rows[0]?.expires_at).toBe(before.rows[0]?.expires_at)
    expect(afterQuiet.rows[0]?.last_seen_at).toBe(before.rows[0]?.last_seen_at)

    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    await client.execute({
      sql: 'UPDATE sessions SET last_seen_at = ? WHERE user_id = ?',
      args: [stale, 'user-slide'],
    })

    await readSession(client, token)
    const slid = await client.execute('SELECT expires_at, last_seen_at FROM sessions')
    expect(Date.parse(String(slid.rows[0]?.last_seen_at))).toBeGreaterThan(Date.parse(stale))
    expect(Date.parse(String(slid.rows[0]?.expires_at))).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('returns null for an expired session', async () => {
    const client = await seedUser('user-expired')
    const { token } = await createSession(
      client,
      {},
      'user-expired',
      new Request('http://localhost/api/me'),
    )
    await client.execute({
      sql: 'UPDATE sessions SET expires_at = ? WHERE user_id = ?',
      args: ['2000-01-01T00:00:00.000Z', 'user-expired'],
    })

    expect(await readSession(client, token)).toBeNull()
  })

  it('returns null for a disabled user', async () => {
    const client = await seedUser('user-disabled')
    const { token } = await createSession(
      client,
      {},
      'user-disabled',
      new Request('http://localhost/api/me'),
    )
    await client.execute({
      sql: 'UPDATE users SET disabled_at = ? WHERE id = ?',
      args: ['2026-10-01T00:00:00.000Z', 'user-disabled'],
    })

    expect(await readSession(client, token)).toBeNull()
  })
})

describe('destroySession', () => {
  it('deletes one session and destroyAllSessions deletes every session for the user', async () => {
    const { client } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
          args: ['user-a', 'usera@student.apc.edu.ph', 'A'],
        })
        await db.execute({
          sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
          args: ['user-b', 'userb@student.apc.edu.ph', 'B'],
        })
      },
    })
    const first = await createSession(client, {}, 'user-a', new Request('http://localhost/'))
    const second = await createSession(client, {}, 'user-a', new Request('http://localhost/'))
    const other = await createSession(client, {}, 'user-b', new Request('http://localhost/'))

    await destroySession(client, first.token)
    expect(await readSession(client, first.token)).toBeNull()
    expect((await readSession(client, second.token))?.id).toBe('user-a')

    await destroyAllSessions(client, 'user-a')
    expect(await readSession(client, second.token)).toBeNull()
    expect((await readSession(client, other.token))?.id).toBe('user-b')
  })
})
