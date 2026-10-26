import type { Client } from '@libsql/client/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'
const TOKEN = 'token-current'
const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const IP_HASH = 'ip-hash-value'
const CONSENT_IP_HASH = 'consent-ip-hash'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function column(client: Client, sql: string, args: (string | null)[] = []): Promise<string[]> {
  const result = await client.execute({ sql, args })
  return result.rows.map((row) => {
    const value = Object.values(row)[0]
    return value == null ? '' : String(value)
  })
}

function cookieHeader(): string {
  return `eypi_session=${TOKEN}`
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  const headers: Record<string, string> = {
    Cookie: cookieHeader(),
    Origin: ORIGIN,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  return {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

async function insertUser(client: Client, id: string, email: string, name: string): Promise<void> {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [id, email, name, 'user'],
  })
}

async function insertSession(
  client: Client,
  id: string,
  userId: string,
  userAgent: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  await client.execute({
    sql: `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, now, now, '2099-01-01T00:00:00.000Z', userAgent, IP_HASH],
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('account routes', () => {
  it('requires a session and does not require legal consent', async () => {
    const anon = await createTestApp()
    const paths: RequestInit[] = [
      { method: 'GET' },
      { method: 'GET' },
      { method: 'DELETE', headers: { Origin: ORIGIN } },
      { method: 'POST', headers: { Origin: ORIGIN } },
      {
        method: 'DELETE',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: 'ada@apc.edu.ph' }),
      },
    ]
    const urls = [
      '/api/account/export.json',
      '/api/account/sessions',
      '/api/account/sessions/session-extra',
      '/api/account/sessions/revoke-all',
      '/api/account',
    ]
    for (let i = 0; i < urls.length; i += 1) {
      const res = await anon.request(urls[i], paths[i])
      expect(res.status, urls[i]).toBe(401)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('unauthorized')
    }

    const currentId = await sha256Hex(TOKEN)
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-ada', 'ada-id', 'https://example.com/ada', 'ada-link'],
        })
      },
    })

    const exported = await request('/api/account/export.json', { headers: { Cookie: cookieHeader() } })
    expect(exported.status).toBe(200)
    const removed = await request('/api/account', jsonRequest('DELETE', { confirmEmail: 'ada@apc.edu.ph' }))
    expect(removed.status).toBe(204)
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['ada-id'])).toEqual([])
    expect(await column(client, 'SELECT id FROM legal_consents')).toEqual([])
  })

  it('exports the caller and leaves out another person', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertUser(db, 'bea-id', 'bea@apc.edu.ph', 'Bea')
        await insertUser(db, 'owner-id', 'owner@apc.edu.ph', 'Owner')
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
          args: [
            'org-alpha', 'Alpha', 'ada-id',
            'org-beta', 'Beta', 'owner-id',
            'org-gamma', 'Gamma', 'owner-id',
          ],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)`,
          args: ['org-beta', 'ada@apc.edu.ph', 'ada-id', '2026-01-01T00:00:00.000Z'],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)`,
          args: ['org-beta', 'bea@apc.edu.ph', 'bea-id', '2026-01-01T00:00:00.000Z'],
        })
        await db.execute({
          sql: 'INSERT INTO org_members (org_id, email) VALUES (?, ?)',
          args: ['org-gamma', 'ada@apc.edu.ph'],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, clicks) VALUES (?, ?, ?, ?, ?)`,
          args: ['link-ada', 'ada-id', 'https://example.com/ada', 'ada-link', 9],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, clicks) VALUES (?, ?, ?, ?, ?)`,
          args: ['link-bea', 'bea-id', 'https://example.com/bea', 'bea-secret-slug', 4],
        })
        await db.execute({
          sql: 'INSERT INTO analytics (link_id, os) VALUES (?, ?), (?, ?), (?, ?)',
          args: ['link-ada', 'Windows', 'link-ada', 'Windows', 'link-bea', 'Mac'],
        })
        await db.execute({
          sql: `INSERT INTO legal_consents (id, user_id, document, version, ip_hash)
                VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
          args: [
            'consent-ada-privacy', 'ada-id', 'privacy', '2026-11-01', CONSENT_IP_HASH,
            'consent-bea-terms', 'bea-id', 'terms', '2026-11-01', CONSENT_IP_HASH,
          ],
        })
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await insertSession(db, 'session-bea', 'bea-id', 'BeaAgent/1.0')
      },
    })

    const res = await request('/api/account/export.json', { headers: { Cookie: cookieHeader() } })
    expect(res.status).toBe(200)
    const utcDay = new Date().toISOString().slice(0, 10)
    expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="eypi-data-${utcDay}.json"`)

    const body = await res.json() as {
      profile: { id: string; email: string; name: string; role: string }
      links: { slug: string; analytics: { clickCount: number } }[]
      memberships: { orgId: string; orgName: string; email: string }[]
      invites: { orgId: string; orgName: string; email: string }[]
      ownedOrgs: { id: string; name: string }[]
      consents: { id: string; document: string; version: string }[]
      sessions: { id: string; device: string; current: boolean; lastSeenAt: string; expiresAt: string }[]
    }
    expect(Object.keys(body).sort()).toEqual([
      'consents', 'invites', 'links', 'memberships', 'ownedOrgs', 'profile', 'sessions',
    ])
    expect(body.profile).toMatchObject({
      id: 'ada-id',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'user',
    })
    expect(body.links).toEqual([
      expect.objectContaining({
        slug: 'ada-link',
        analytics: { clickCount: 2 },
      }),
    ])
    expect(body.memberships).toEqual([
      expect.objectContaining({ orgId: 'org-beta', orgName: 'Beta', email: 'ada@apc.edu.ph' }),
    ])
    expect(body.invites).toEqual([
      expect.objectContaining({ orgId: 'org-gamma', orgName: 'Gamma', email: 'ada@apc.edu.ph' }),
    ])
    expect(body.ownedOrgs).toEqual([{ id: 'org-alpha', name: 'Alpha' }])
    expect(body.consents).toEqual([
      expect.objectContaining({ id: 'consent-ada-privacy', document: 'privacy', version: '2026-11-01' }),
    ])
    const current = body.sessions.find((session) => session.id === currentId)
    expect(current?.current).toBe(true)
    expect(current?.device).toContain('Chrome')
    expect(current?.device).toContain('Windows')
    expect(current?.lastSeenAt).toBeTruthy()
    expect(current?.expiresAt).toBe('2099-01-01T00:00:00.000Z')
    expect(Object.keys(current ?? {}).sort()).toEqual(['current', 'device', 'expiresAt', 'id', 'lastSeenAt'])

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('bea@apc.edu.ph')
    expect(serialized).not.toContain('bea-secret-slug')
    expect(serialized).not.toContain('session-bea')
    expect(serialized).not.toContain('consent-bea-terms')
    expect(serialized).not.toContain(IP_HASH)
    expect(serialized).not.toContain(CONSENT_IP_HASH)
    expect(serialized).not.toContain(TOKEN)
  })

  it('lists the caller sessions and marks only the request cookie as current', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertUser(db, 'bea-id', 'bea@apc.edu.ph', 'Bea')
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await insertSession(db, 'session-extra', 'ada-id', 'Mozilla/5.0 (Macintosh) Firefox/120.0')
        await insertSession(db, 'session-bea', 'bea-id', 'BeaAgent/1.0')
      },
    })

    const res = await request('/api/account/sessions', { headers: { Cookie: cookieHeader() } })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      sessions: { id: string; device: string; lastSeenAt: string; expiresAt: string; current: boolean }[]
    }
    const ids = body.sessions.map((session) => session.id).sort()
    expect(ids).toEqual([currentId, 'session-extra'].sort())
    const current = body.sessions.find((session) => session.id === currentId)
    const extra = body.sessions.find((session) => session.id === 'session-extra')
    expect(current?.current).toBe(true)
    expect(extra?.current).toBe(false)
    expect(current?.device).toContain('Chrome')
    expect(current?.device).toContain('Windows')
    expect(Object.keys(current ?? {}).sort()).toEqual(['current', 'device', 'expiresAt', 'id', 'lastSeenAt'])
    expect(JSON.stringify(body)).not.toContain(IP_HASH)
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(JSON.stringify(body)).not.toContain('session-bea')
  })

  it('deletes one of the caller sessions and returns 404 for someone else', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertUser(db, 'bea-id', 'bea@apc.edu.ph', 'Bea')
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await insertSession(db, 'session-extra', 'ada-id', null)
        await insertSession(db, 'session-bea', 'bea-id', null)
      },
    })

    const removed = await request('/api/account/sessions/session-extra', jsonRequest('DELETE'))
    expect(removed.status).toBe(204)
    expect(await column(client, 'SELECT id FROM sessions WHERE id = ?', ['session-extra'])).toEqual([])
    expect(await column(client, 'SELECT id FROM sessions WHERE id = ?', [currentId])).toEqual([currentId])

    const foreign = await request('/api/account/sessions/session-bea', jsonRequest('DELETE'))
    expect(foreign.status).toBe(404)
    expect(await column(client, 'SELECT id FROM sessions WHERE id = ?', ['session-bea'])).toEqual(['session-bea'])
  })

  it('revoke-all leaves zero sessions for the caller', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertUser(db, 'bea-id', 'bea@apc.edu.ph', 'Bea')
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await insertSession(db, 'session-extra', 'ada-id', null)
        await insertSession(db, 'session-bea', 'bea-id', null)
      },
    })

    const res = await request('/api/account/sessions/revoke-all', jsonRequest('POST'))
    expect(res.status).toBe(204)
    expect(await column(client, 'SELECT id FROM sessions WHERE user_id = ?', ['ada-id'])).toEqual([])
    expect(await column(client, 'SELECT id FROM sessions WHERE user_id = ?', ['bea-id'])).toEqual(['session-bea'])
  })

  it('returns email_mismatch and deletes nothing when the confirm email differs', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertSession(db, currentId, 'ada-id', null)
      },
    })

    const res = await request('/api/account', jsonRequest('DELETE', { confirmEmail: '  other@apc.edu.ph  ' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('email_mismatch')
    expect(body.error.message).toBe('That email does not match this account.')
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['ada-id'])).toEqual(['ada-id'])
  })

  it('returns 409 owns_org and deletes nothing while the user owns an organization', async () => {
    const currentId = await sha256Hex(TOKEN)
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertSession(db, currentId, 'ada-id', null)
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?), (?, ?, ?)',
          args: ['org-zeta', 'Zeta', 'ada-id', 'org-alpha', 'Alpha', 'ada-id'],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-ada', 'ada-id', 'https://example.com/ada', 'ada-link'],
        })
      },
    })

    const res = await request('/api/account', jsonRequest('DELETE', { confirmEmail: 'ada@apc.edu.ph' }))
    expect(res.status).toBe(409)
    const body = await res.json() as {
      error: { code: string; message: string }
      orgs: { id: string; name: string }[]
    }
    expect(body).toEqual({
      error: {
        code: 'owns_org',
        message: 'Transfer ownership before deleting your account.',
      },
      orgs: [
        { id: 'org-alpha', name: 'Alpha' },
        { id: 'org-zeta', name: 'Zeta' },
      ],
    })
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['ada-id'])).toEqual(['ada-id'])
    expect(await column(client, 'SELECT id FROM links WHERE id = ?', ['link-ada'])).toEqual(['link-ada'])
    expect(await column(client, 'SELECT id FROM sessions WHERE user_id = ?', ['ada-id'])).toEqual([currentId])
  })

  it('deletes the account, reassigns org rows, and scrubs audit email text', async () => {
    const currentId = await sha256Hex(TOKEN)
    const qrKey = 'qr-logos/link-ada-abcd1234.png'
    const beaKey = 'qr-logos/link-bea-abcd1234.png'
    const otherKey = 'orgs/not-a-qr-logo.png'
    const { request, client, env } = await createTestApp({
      seed: async (db) => {
        await db.execute('PRAGMA foreign_keys = ON')
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertUser(db, 'bea-id', 'bea@apc.edu.ph', 'Bea')
        await insertUser(db, 'owner-id', 'owner@apc.edu.ph', 'Owner')
        await db.execute({
          sql: `INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
          args: [
            'org-beta', 'Beta', 'owner-id',
            'org-mail', 'Mail', 'owner-id',
            'org-invite', 'Invite', 'owner-id',
          ],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, NULL, NULL)`,
          args: [
            'org-beta', 'ada@apc.edu.ph', 'ada-id', '2026-01-01T00:00:00.000Z',
            'org-mail', 'Ada@apc.edu.ph', null, '2026-02-01T00:00:00.000Z',
            'org-invite', 'ada@apc.edu.ph',
          ],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)`,
          args: ['org-beta', 'bea@apc.edu.ph', 'bea-id', '2026-01-01T00:00:00.000Z'],
        })
        await db.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, NULL)`,
          args: [
            'event-kept', 'kept-event', 'ada-id', 'Kept', '2026-12-01', '10:00', 'APC', 'org-beta',
            'event-drop', 'drop-event', 'ada-id', 'Drop', '2026-12-02', '11:00', 'APC',
          ],
        })
        await db.execute({
          sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)`,
          args: ['att-1', 'event-drop', 'Ada', 'guest@example.com', 'qr-att-1'],
        })
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)`,
          args: ['check-1', 'att-1', 'event-drop', 'checked_in'],
        })
        await db.execute({
          sql: `INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count) VALUES (?, ?, ?, ?, ?)`,
          args: ['cluster-1', 'event-drop', 'section', 'A', 10],
        })
        await db.execute({
          sql: `INSERT INTO event_column_mappings (id, event_id, email_col) VALUES (?, ?, ?)`,
          args: ['map-1', 'event-drop', 'email'],
        })
        await db.execute({
          sql: `INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES (?, ?, ?, ?)`,
          args: ['csv-1', 'event-drop', 0, '{}'],
        })
        await db.execute({
          sql: `INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, slug, org_id)
                VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, NULL)`,
          args: [
            'camp-kept', 'ada-id', 'Kept', 'frames/kept.png', 'kept-frame', 'org-beta',
            'camp-drop', 'ada-id', 'Drop', 'frames/drop.png', 'drop-frame',
          ],
        })
        await db.execute({
          sql: `INSERT INTO dp_frames (id, campaign_id, image_url) VALUES (?, ?, ?), (?, ?, ?)`,
          args: [
            'frame-kept', 'camp-kept', 'frames/kept.png',
            'frame-drop', 'camp-drop', 'frames/drop.png',
          ],
        })
        await db.execute({
          sql: 'INSERT INTO dp_slug_history (old_slug, campaign_id) VALUES (?, ?)',
          args: ['old-drop', 'camp-drop'],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
                VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
          args: [
            'link-ada', 'ada-id', 'https://example.com/ada', 'ada-link',
            JSON.stringify({ logo: { key: qrKey } }),
            'link-ada-org', 'ada-id', 'https://example.com/org', 'ada-org-link',
            JSON.stringify({ logo: { key: otherKey } }),
            'link-bea', 'bea-id', 'https://example.com/bea', 'bea-link',
            JSON.stringify({ logo: { key: beaKey } }),
          ],
        })
        await db.execute({
          sql: 'INSERT INTO analytics (link_id, os) VALUES (?, ?), (?, ?)',
          args: ['link-ada', 'Windows', 'link-bea', 'Mac'],
        })
        await db.execute({
          sql: `INSERT INTO link_reports (id, link_id, reason) VALUES (?, ?, ?), (?, ?, ?)`,
          args: ['report-ada', 'link-ada', 'spam', 'report-bea', 'link-bea', 'ok'],
        })
        await db.execute({
          sql: `INSERT INTO user_identities (provider, tenant_id, subject, user_id, email_at_link)
                VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, NULL)`,
          args: [
            'microsoft', 'tenant', 'subject-ada', 'ada-id', 'ada@apc.edu.ph',
            'microsoft', 'tenant', 'subject-bea', 'bea-id',
          ],
        })
        await insertSession(db, currentId, 'ada-id', CHROME_WINDOWS)
        await insertSession(db, 'session-bea', 'bea-id', null)
        await db.execute({
          sql: `INSERT INTO legal_consents (id, user_id, document, version, ip_hash)
                VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
          args: [
            'consent-ada', 'ada-id', 'privacy', '2026-11-01', CONSENT_IP_HASH,
            'consent-bea', 'bea-id', 'privacy', '2026-11-01', CONSENT_IP_HASH,
          ],
        })
        await db.execute({
          sql: `INSERT INTO audit_events (id, actor_user_id, action, meta)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, NULL)`,
          args: [
            'audit-ada', 'ada-id', 'role.update', '{"email":"ada@apc.edu.ph","note":"ada@apc.edu.ph"}',
            'audit-bea', 'bea-id', 'role.update', '{"email":"bea@apc.edu.ph"}',
            'audit-plain', 'ada-id', 'login',
          ],
        })
      },
    })
    await env.MEDIA.put(qrKey, new Uint8Array([1]))
    await env.MEDIA.put(beaKey, new Uint8Array([2]))
    await env.MEDIA.put(otherKey, new Uint8Array([3]))

    const res = await request('/api/account', jsonRequest('DELETE', { confirmEmail: '  Ada@apc.edu.ph  ' }))
    expect(res.status).toBe(204)

    expect((await column(client, 'SELECT id FROM users')).sort()).toEqual(['bea-id', 'owner-id'])
    expect(await column(client, 'SELECT id FROM links')).toEqual(['link-bea'])
    expect(await column(client, 'SELECT link_id FROM analytics')).toEqual(['link-bea'])
    expect(await column(client, 'SELECT id FROM link_reports')).toEqual(['report-bea'])
    expect(await column(client, 'SELECT id FROM sessions')).toEqual(['session-bea'])
    expect(await column(client, 'SELECT user_id FROM user_identities')).toEqual(['bea-id'])
    expect(await column(client, 'SELECT user_id FROM legal_consents')).toEqual(['bea-id'])
    expect(await column(client, 'SELECT lower(email) FROM org_members')).toEqual(['bea@apc.edu.ph'])
    expect(await column(client, 'SELECT lead_user_id FROM events WHERE id = ?', ['event-kept'])).toEqual(['owner-id'])
    expect(await column(client, 'SELECT id FROM events')).toEqual(['event-kept'])
    expect(await column(client, 'SELECT id FROM attendees')).toEqual([])
    expect(await column(client, 'SELECT id FROM check_ins')).toEqual([])
    expect(await column(client, 'SELECT id FROM event_clusters')).toEqual([])
    expect(await column(client, 'SELECT id FROM event_column_mappings')).toEqual([])
    expect(await column(client, 'SELECT id FROM event_csv_rows')).toEqual([])
    expect(await column(client, 'SELECT creator_id FROM dp_campaigns WHERE id = ?', ['camp-kept'])).toEqual(['owner-id'])
    expect(await column(client, 'SELECT id FROM dp_campaigns')).toEqual(['camp-kept'])
    expect(await column(client, 'SELECT id FROM dp_frames')).toEqual(['frame-kept'])
    expect(await column(client, 'SELECT old_slug FROM dp_slug_history')).toEqual([])
    expect(await env.MEDIA.head(qrKey)).toBeNull()
    expect(await env.MEDIA.head(beaKey)).not.toBeNull()
    expect(await env.MEDIA.head(otherKey)).not.toBeNull()

    const adaAudit = await client.execute({
      sql: 'SELECT actor_user_id, meta FROM audit_events WHERE id = ?',
      args: ['audit-ada'],
    })
    expect(String(adaAudit.rows[0]?.actor_user_id)).toBe('ada-id')
    expect(String(adaAudit.rows[0]?.meta)).toBe('{"email":"deleted-user","note":"deleted-user"}')
    const beaAudit = await client.execute({
      sql: 'SELECT actor_user_id, meta FROM audit_events WHERE id = ?',
      args: ['audit-bea'],
    })
    expect(String(beaAudit.rows[0]?.actor_user_id)).toBe('bea-id')
    expect(String(beaAudit.rows[0]?.meta)).toBe('{"email":"bea@apc.edu.ph"}')
    expect(await column(client, 'SELECT id FROM audit_events')).toHaveLength(3)
  })

  it('scrubs only whole audit email matches and leaves a neighbour address alone', async () => {
    const currentId = await sha256Hex(TOKEN)
    const deletedEmail = 'ana.santos@apc.edu.ph'
    const neighbourEmail = 'joana.santos@apc.edu.ph'
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await insertUser(db, 'ana-id', deletedEmail, 'Ana Santos')
        await insertUser(db, 'joana-id', neighbourEmail, 'Joana Santos')
        await insertSession(db, currentId, 'ana-id', null)
        await db.execute({
          sql: `INSERT INTO audit_events (id, actor_user_id, action, meta)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
          args: [
            'audit-ana-plain', 'ana-id', 'login', deletedEmail,
            'audit-ana-json', 'ana-id', 'role.update', JSON.stringify({ email: deletedEmail, note: 'Ana Santos' }),
            'audit-ana-case', 'ana-id', 'login', JSON.stringify({ email: 'ANA.SANTOS@apc.edu.ph' }),
            'audit-ana-prose', 'ana-id', 'report.create', JSON.stringify({ note: `reported by ${deletedEmail}.` }),
            'audit-joana-json', 'joana-id', 'role.update', JSON.stringify({ email: neighbourEmail }),
            'audit-joana-prose', 'joana-id', 'login', `signed in as ${neighbourEmail}`,
          ],
        })
      },
    })

    const res = await request('/api/account', jsonRequest('DELETE', { confirmEmail: deletedEmail }))
    expect(res.status).toBe(204)

    async function auditMeta(id: string): Promise<string> {
      const result = await client.execute({
        sql: 'SELECT meta FROM audit_events WHERE id = ?',
        args: [id],
      })
      return String(result.rows[0]?.meta)
    }

    expect(await auditMeta('audit-ana-plain')).toBe('deleted-user')
    expect(await auditMeta('audit-ana-json')).toBe('{"email":"deleted-user","note":"Ana Santos"}')
    expect(await auditMeta('audit-ana-case')).toBe('{"email":"deleted-user"}')
    expect(await auditMeta('audit-ana-prose')).toBe('{"note":"reported by deleted-user."}')
    expect(await auditMeta('audit-joana-json')).toBe(JSON.stringify({ email: neighbourEmail }))
    expect(await auditMeta('audit-joana-prose')).toBe(`signed in as ${neighbourEmail}`)
    expect(await column(client, 'SELECT id FROM users')).toEqual(['joana-id'])
  })

  it('still returns 204 when a QR logo cannot be deleted, without logging the email or user id', async () => {
    const currentId = await sha256Hex(TOKEN)
    const media = {
      delete: vi.fn(async () => {
        throw new Error('storage failed ada@apc.edu.ph ada-id')
      }),
    }
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { request, client } = await createTestApp({
      env: { MEDIA: media as unknown as R2Bucket },
      seed: async (db) => {
        await insertUser(db, 'ada-id', 'ada@apc.edu.ph', 'Ada')
        await insertSession(db, currentId, 'ada-id', null)
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config) VALUES (?, ?, ?, ?, ?)`,
          args: [
            'link-ada',
            'ada-id',
            'https://example.com/ada',
            'ada-link',
            JSON.stringify({ logo: { key: 'qr-logos/link-ada-abcd1234.png' } }),
          ],
        })
      },
    })

    const res = await request('/api/account', jsonRequest('DELETE', { confirmEmail: 'ada@apc.edu.ph' }))
    expect(res.status).toBe(204)
    expect(media.delete).toHaveBeenCalledWith('qr-logos/link-ada-abcd1234.png')
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['ada-id'])).toEqual([])
    const logged = errors.mock.calls.map((call) => call.map(String).join(' ')).join('\n')
    expect(logged).not.toContain('ada@apc.edu.ph')
    expect(logged).not.toContain('ada-id')
    expect(logged.length).toBeGreaterThan(0)
  })
})
