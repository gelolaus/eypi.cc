import type { Client } from '@libsql/client/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession, sessionCookieName } from '../lib/auth/session'
import { createTestApp, grantCurrentConsent, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const admin: TestUser = {
  id: 'admin-1',
  email: 'admin@apc.edu.ph',
  name: 'Ada Admin',
  role: 'admin',
}

const secondAdmin: TestUser = {
  id: 'admin-2',
  email: 'second-admin@apc.edu.ph',
  name: 'Bea Admin',
  role: 'admin',
}

const member: TestUser = {
  id: 'user-1',
  email: 'bea@student.apc.edu.ph',
  name: 'Bea',
  role: 'user',
}

function json(method: string, body?: unknown): RequestInit {
  const headers: Record<string, string> = { Origin: ORIGIN }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

async function insertUser(
  client: Client,
  user: TestUser,
  extra: { createdAt?: string; disabledAt?: string | null } = {},
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO users (id, email, name, role, created_at, disabled_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      user.id,
      user.email,
      user.name,
      user.role,
      extra.createdAt ?? new Date().toISOString(),
      extra.disabledAt ?? null,
    ],
  })
}

async function count(client: Client, sql: string, args: (string | null)[] = []): Promise<number> {
  const result = await client.execute({ sql, args })
  return Number(result.rows[0]?.n ?? 0)
}

async function column(client: Client, sql: string, args: (string | null)[] = []): Promise<string[]> {
  const result = await client.execute({ sql, args })
  return result.rows.map((row) => {
    const value = Object.values(row)[0]
    return value == null ? '' : String(value)
  })
}

async function auditRows(
  client: Client,
  action: string,
): Promise<{ target_type: string; target_id: string; meta: string | null }[]> {
  const result = await client.execute({
    sql: 'SELECT target_type, target_id, meta FROM audit_events WHERE action = ? ORDER BY created_at, id',
    args: [action],
  })
  return result.rows.map((row) => ({
    target_type: String(row.target_type ?? ''),
    target_id: String(row.target_id ?? ''),
    meta: row.meta == null ? null : String(row.meta),
  }))
}

/** A second signed-in user (the harness only builds a cookie for its `user`). */
async function cookieFor(
  client: Client,
  env: Parameters<typeof createSession>[1],
  userId: string,
): Promise<string> {
  await grantCurrentConsent(client, userId)
  const { token } = await createSession(client, env, userId, new Request('https://eypi.cc/'))
  return `${sessionCookieName(env)}=${token}`
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('admin routes', () => {
  it('returns 403 admin_only for every endpoint when the caller is not an admin', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (client) => {
        await insertUser(client, member)
        await insertUser(client, admin)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason) VALUES (?, ?, ?, ?)`,
          args: ['report-1', 'link-1', 'one', 'spam'],
        })
      },
    })

    const calls: { path: string; init: RequestInit }[] = [
      { path: '/api/admin/users', init: { method: 'GET' } },
      { path: '/api/admin/users/user-1', init: json('PATCH', { role: 'admin' }) },
      { path: '/api/admin/users/user-1/logout', init: json('POST') },
      { path: '/api/admin/users/user-1', init: json('DELETE') },
      { path: '/api/admin/links', init: { method: 'GET' } },
      { path: '/api/admin/links/link-1/disable', init: json('POST', { reason: 'abuse' }) },
      { path: '/api/admin/reports?status=open', init: { method: 'GET' } },
      { path: '/api/admin/reports/report-1/resolve', init: json('POST', { action: 'dismiss' }) },
      { path: '/api/admin/audit', init: { method: 'GET' } },
      { path: '/api/admin/speed?days=7', init: { method: 'GET' } },
      { path: '/api/admin/media/pending', init: { method: 'GET' } },
    ]

    for (const call of calls) {
      const res = await request(call.path, call.init)
      expect(res.status, call.path).toBe(403)
      expect(await res.json(), call.path).toMatchObject({ error: { code: 'admin_only' } })
    }
  })

  it('returns 401 when anonymous', async () => {
    const { request } = await createTestApp()
    const res = await request('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('lists users with search and stable cursor pages', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        for (let i = 0; i < 27; i += 1) {
          await insertUser(client, {
            id: `member-${String(i).padStart(2, '0')}`,
            email: `member-${String(i).padStart(2, '0')}@student.apc.edu.ph`,
            name: `Member ${i}`,
            role: 'user',
          }, { createdAt: '2026-01-01 00:00:00' })
        }
      },
    })
    const first = await request('/api/admin/users')
    expect(first.status).toBe(200)
    const firstBody = await first.json() as {
      items: { id: string; email: string; role: string; disabled: boolean; createdAt: string }[]
      nextCursor: string | null
    }
    expect(firstBody.items).toHaveLength(25)
    expect(typeof firstBody.nextCursor).toBe('string')
    expect(firstBody.items[0]).toMatchObject({ id: 'admin-1', role: 'admin', disabled: false })

    const second = await request(
      `/api/admin/users?cursor=${encodeURIComponent(firstBody.nextCursor ?? '')}`,
    )
    const secondBody = await second.json() as {
      items: { id: string }[]
      nextCursor: string | null
    }
    const total = await count(client, 'SELECT COUNT(*) AS n FROM users')
    const seen = [...firstBody.items, ...secondBody.items].map((item) => item.id)
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen).toHaveLength(total)
    expect(secondBody.nextCursor).toBeNull()

    const searched = await request('/api/admin/users?q=member-1')
    const searchedBody = await searched.json() as { items: { email: string }[] }
    expect(searchedBody.items.map((item) => item.email).sort()).toEqual([
      'member-10@student.apc.edu.ph',
      'member-11@student.apc.edu.ph',
      'member-12@student.apc.edu.ph',
      'member-13@student.apc.edu.ph',
      'member-14@student.apc.edu.ph',
      'member-15@student.apc.edu.ph',
      'member-16@student.apc.edu.ph',
      'member-17@student.apc.edu.ph',
      'member-18@student.apc.edu.ph',
      'member-19@student.apc.edu.ph',
    ])
  })

  it('refuses to demote the last admin and to demote yourself', async () => {
    const solo = await createTestApp({ user: admin })
    const demoteSelf = await solo.request('/api/admin/users/admin-1', json('PATCH', { role: 'user' }))
    expect(demoteSelf.status).toBe(409)
    expect(await demoteSelf.json()).toMatchObject({ error: { code: 'last_admin' } })
    expect(await column(solo.client, 'SELECT role FROM users WHERE id = ?', ['admin-1'])).toEqual(['admin'])

    const pair = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, secondAdmin)
      },
    })
    const stillSelf = await pair.request('/api/admin/users/admin-1', json('PATCH', { role: 'user' }))
    expect(stillSelf.status).toBe(409)
    expect(await stillSelf.json()).toMatchObject({ error: { code: 'last_admin' } })

    const promote = await pair.request('/api/admin/users/user-1', json('PATCH', { role: 'admin' }))
    expect(promote.status).toBe(404)
  })

  it('promotes and demotes another user and writes an audit row', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
      },
    })

    const promoted = await request('/api/admin/users/user-1', json('PATCH', { role: 'admin' }))
    expect(promoted.status).toBe(200)
    expect(await promoted.json()).toMatchObject({ item: { id: 'user-1', role: 'admin' } })
    expect(await column(client, 'SELECT role FROM users WHERE id = ?', ['user-1'])).toEqual(['admin'])
    const audits = await auditRows(client, 'user.role')
    expect(audits).toHaveLength(1)
    expect(audits[0].target_id).toBe('user-1')
    expect(JSON.parse(audits[0].meta ?? '{}')).toMatchObject({ from: 'user', to: 'admin' })

    const demoted = await request('/api/admin/users/user-1', json('PATCH', { role: 'user' }))
    expect(demoted.status).toBe(200)
    expect(await column(client, 'SELECT role FROM users WHERE id = ?', ['user-1'])).toEqual(['user'])
    expect(await auditRows(client, 'user.role')).toHaveLength(2)
  })

  it('disabling a user revokes their sessions; enabling restores the account', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
      },
    })
    const memberCookie = await cookieFor(client, env, member.id)
    const memberHeaders = { Cookie: memberCookie }
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [member.id])).toBe(1)

    const disabled = await request('/api/admin/users/user-1', json('PATCH', { disabled: true }))
    expect(disabled.status).toBe(200)
    expect(await disabled.json()).toMatchObject({ item: { id: 'user-1', disabled: true } })
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [member.id])).toBe(0)
    expect(await count(
      client,
      "SELECT COUNT(*) AS n FROM users WHERE id = ? AND disabled_at IS NOT NULL AND disabled_at != ''",
      [member.id],
    )).toBe(1)
    expect(await auditRows(client, 'user.disable')).toHaveLength(1)
    expect((await request('/api/me', { headers: memberHeaders })).status).toBe(401)

    const enabled = await request('/api/admin/users/user-1', json('PATCH', { disabled: false }))
    expect(enabled.status).toBe(200)
    expect(await enabled.json()).toMatchObject({ item: { id: 'user-1', disabled: false } })
    expect(await auditRows(client, 'user.enable')).toHaveLength(1)
  })

  it('refuses to disable or delete the last admin', async () => {
    const { request, client } = await createTestApp({ user: admin })

    const disabled = await request('/api/admin/users/admin-1', json('PATCH', { disabled: true }))
    expect(disabled.status).toBe(409)
    expect(await disabled.json()).toMatchObject({ error: { code: 'last_admin' } })

    const deleted = await request('/api/admin/users/admin-1', json('DELETE'))
    expect(deleted.status).toBe(409)
    expect(await deleted.json()).toMatchObject({ error: { code: 'last_admin' } })
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['admin-1'])).toEqual(['admin-1'])
  })

  it('lets an admin disable themselves when another admin remains', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, secondAdmin)
      },
    })

    const disabled = await request('/api/admin/users/admin-1', json('PATCH', { disabled: true }))
    expect(disabled.status).toBe(200)
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', ['admin-1'])).toBe(0)
  })

  it('forces a logout and audits it', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
      },
    })
    await cookieFor(client, env, member.id)
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [member.id])).toBe(1)

    const res = await request('/api/admin/users/user-1/logout', json('POST'))
    expect(res.status).toBe(204)
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [member.id])).toBe(0)
    expect(await auditRows(client, 'user.logout')).toHaveLength(1)
  })

  it('deletes another user through the account deletion routine', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
      },
    })
    await env.LINKS_KV.put('one', '{"url":"https://example.com/one"}')
    await cookieFor(client, env, member.id)

    const res = await request('/api/admin/users/user-1', json('DELETE'))
    expect(res.status).toBe(204)
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['user-1'])).toEqual([])
    expect(await column(client, 'SELECT id FROM links WHERE user_id = ?', ['user-1'])).toEqual([])
    expect(await count(client, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', ['user-1'])).toBe(0)
    expect(await env.LINKS_KV.get('one')).toBeNull()
    const deletes = await auditRows(client, 'user.delete')
    expect(deletes).toHaveLength(1)
    // The deleted address never survives in the audit trail.
    expect(deletes[0].meta).toBeNull()
  })

  it('deletes the account but logs when its edge keys cannot be removed', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
      },
    })
    await env.LINKS_KV.put('one', '{"url":"https://example.com/one"}')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(env.LINKS_KV, 'delete').mockRejectedValue(new Error('kv down'))

    const res = await request('/api/admin/users/user-1', json('DELETE'))
    expect(res.status).toBe(204)
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['user-1'])).toEqual([])
    expect(await column(client, 'SELECT id FROM links WHERE user_id = ?', ['user-1'])).toEqual([])
    expect(await env.LINKS_KV.get('one')).toBe('{"url":"https://example.com/one"}')

    const logged = errors.mock.calls.map((call) => call.map(String).join(' ')).join('\n')
    expect(logged).toContain('edge_delete_failed')
    expect(logged).not.toContain(member.email)
  })

  it('refuses to delete a user who owns an organization', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['org-1', 'Alpha', member.id],
        })
      },
    })

    const res = await request('/api/admin/users/user-1', json('DELETE'))
    expect(res.status).toBe(409)
    const body = await res.json() as {
      error: { code: string }
      orgs: { id: string; name: string }[]
    }
    expect(body.error.code).toBe('owns_org')
    expect(body.orgs).toEqual([{ id: 'org-1', name: 'Alpha' }])
    expect(await column(client, 'SELECT id FROM users WHERE id = ?', ['user-1'])).toEqual(['user-1'])
  })

  it('lists links with owner email and cursor pages', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        for (let i = 0; i < 27; i += 1) {
          await client.execute({
            sql: `INSERT INTO links (id, user_id, original_url, slug, created_at)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [
              `link-${String(i).padStart(2, '0')}`,
              member.id,
              `https://example.com/${i}`,
              `slug-${String(i).padStart(2, '0')}`,
              '2026-01-01 00:00:00',
            ],
          })
        }
      },
    })
    const total = await count(client, 'SELECT COUNT(*) AS n FROM links')

    const first = await request('/api/admin/links')
    const firstBody = await first.json() as {
      items: { id: string; ownerEmail: string; slug: string }[]
      nextCursor: string | null
    }
    expect(first.status).toBe(200)
    expect(firstBody.items).toHaveLength(25)
    expect(firstBody.items[0].ownerEmail).toBe(member.email)
    expect(typeof firstBody.nextCursor).toBe('string')

    const second = await request(`/api/admin/links?cursor=${encodeURIComponent(firstBody.nextCursor ?? '')}`)
    const secondBody = await second.json() as { items: { id: string }[]; nextCursor: string | null }
    const ids = [...firstBody.items, ...secondBody.items].map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(total)
    expect(secondBody.nextCursor).toBeNull()

    const searched = await request('/api/admin/links?q=SLUG-07')
    const searchedBody = await searched.json() as { items: { slug: string }[] }
    expect(searchedBody.items.map((item) => item.slug)).toEqual(['slug-07'])
  })

  it('disables a link with a moderator reason, removes the edge key, and audits it', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
      },
    })
    await env.LINKS_KV.put('one', '{"url":"https://example.com/one"}')

    const res = await request('/api/admin/links/link-1/disable', json('POST', { reason: 'abuse' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      item: { id: 'link-1', disabled: true, disabledReason: 'abuse' },
    })
    expect(await column(client, 'SELECT disabled_reason FROM links WHERE id = ?', ['link-1'])).toEqual(['abuse'])
    expect(await env.LINKS_KV.get('one')).toBeNull()
    const audits = await auditRows(client, 'link.disable')
    expect(audits).toHaveLength(1)
    expect(audits[0].target_id).toBe('link-1')
    expect(JSON.parse(audits[0].meta ?? '{}')).toMatchObject({ slug: 'one', reason: 'abuse' })
  })

  it('reports a retryable failure and keeps the edge key when the KV delete fails', async () => {
    const payload = '{"url":"https://example.com/one"}'
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
      },
    })
    await env.LINKS_KV.put('one', payload)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const edgeDelete = vi.spyOn(env.LINKS_KV, 'delete').mockRejectedValue(new Error('kv down'))

    const res = await request('/api/admin/links/link-1/disable', json('POST', { reason: 'abuse' }))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: { code: 'edge_delete_failed' } })
    expect(edgeDelete).toHaveBeenCalled()
    expect(await column(client, 'SELECT disabled_reason FROM links WHERE id = ?', ['link-1'])).toEqual(['abuse'])
    // The edge still resolves the link, so the caller must retry rather than see success.
    expect(await env.LINKS_KV.get('one')).toBe(payload)
    expect(await auditRows(client, 'link.disable')).toHaveLength(0)

    edgeDelete.mockRestore()
    const retry = await request('/api/admin/links/link-1/disable', json('POST', { reason: 'abuse' }))
    expect(retry.status).toBe(200)
    expect(await env.LINKS_KV.get('one')).toBeNull()
    expect(await auditRows(client, 'link.disable')).toHaveLength(1)
  })

  it('rejects an unknown disable reason and a missing link', async () => {
    const { request } = await createTestApp({ user: admin })

    const invalid = await request('/api/admin/links/missing/disable', json('POST', { reason: 'because' }))
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toMatchObject({ error: { code: 'invalid', fields: { reason: expect.any(String) } } })

    const missing = await request('/api/admin/links/missing/disable', json('POST', { reason: 'admin' }))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } })
  })

  it('resolving a report with disable_link marks the link abuse-disabled', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/phish', 'phish'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason, details)
                VALUES (?, ?, ?, ?, ?)`,
          args: ['report-1', 'link-1', 'phish', 'phishing', 'Looks like a login page.'],
        })
      },
    })
    await env.LINKS_KV.put('phish', '{"url":"https://example.com/phish"}')

    const res = await request('/api/admin/reports/report-1/resolve', json('POST', { action: 'disable_link' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      item: { id: 'report-1', status: 'resolved', resolution: 'disable_link' },
    })
    expect(await column(client, 'SELECT disabled_reason FROM links WHERE id = ?', ['link-1'])).toEqual(['abuse'])
    expect(await count(client, "SELECT COUNT(*) AS n FROM links WHERE id = ? AND disabled_at IS NOT NULL", ['link-1'])).toBe(1)
    expect(await env.LINKS_KV.get('phish')).toBeNull()
    expect(await count(client, 'SELECT COUNT(*) AS n FROM link_reports WHERE id = ? AND resolved_at IS NOT NULL', ['report-1'])).toBe(1)

    const linkAudits = await auditRows(client, 'link.disable')
    expect(linkAudits).toHaveLength(1)
    expect(JSON.parse(linkAudits[0].meta ?? '{}')).toMatchObject({ slug: 'phish', reason: 'abuse', reportId: 'report-1' })
    expect(await auditRows(client, 'report.resolve')).toHaveLength(1)

    const ownerCookie = await cookieFor(client, env, member.id)
    const enable = await request('/api/links/link-1', {
      ...json('PATCH', { disabled: false }),
      headers: { ...json('PATCH', { disabled: false }).headers, Cookie: ownerCookie },
    })
    expect(enable.status).toBe(403)
    expect(await enable.json()).toMatchObject({ error: { code: 'moderator_disabled' } })
  })

  it('keeps a report open when the edge key cannot be cleared, then resolves on retry', async () => {
    const payload = '{"url":"https://example.com/phish"}'
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/phish', 'phish'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason) VALUES (?, ?, ?, ?)`,
          args: ['report-1', 'link-1', 'phish', 'phishing'],
        })
      },
    })
    await env.LINKS_KV.put('phish', payload)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const edgeDelete = vi.spyOn(env.LINKS_KV, 'delete').mockRejectedValue(new Error('kv down'))

    const res = await request('/api/admin/reports/report-1/resolve', json('POST', { action: 'disable_link' }))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: { code: 'edge_delete_failed' } })
    expect(await column(client, 'SELECT disabled_reason FROM links WHERE id = ?', ['link-1'])).toEqual(['abuse'])
    expect(await env.LINKS_KV.get('phish')).toBe(payload)
    // The report stays open so the moderator can retry.
    expect(await count(client, 'SELECT COUNT(*) AS n FROM link_reports WHERE id = ? AND resolved_at IS NOT NULL', ['report-1'])).toBe(0)

    edgeDelete.mockRestore()
    const retry = await request('/api/admin/reports/report-1/resolve', json('POST', { action: 'disable_link' }))
    expect(retry.status).toBe(200)
    expect(await env.LINKS_KV.get('phish')).toBeNull()
    expect(await count(client, 'SELECT COUNT(*) AS n FROM link_reports WHERE id = ? AND resolved_at IS NOT NULL', ['report-1'])).toBe(1)
    expect(await auditRows(client, 'report.resolve')).toHaveLength(1)
  })

  it('dismissing a report resolves it without touching the link', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason) VALUES (?, ?, ?, ?)`,
          args: ['report-1', 'link-1', 'one', 'spam'],
        })
      },
    })

    const res = await request('/api/admin/reports/report-1/resolve', json('POST', { action: 'dismiss' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ item: { id: 'report-1', status: 'resolved', resolution: 'dismiss' } })
    expect(await count(client, 'SELECT COUNT(*) AS n FROM links WHERE id = ? AND disabled_at IS NULL', ['link-1'])).toBe(1)
    expect(await count(client, 'SELECT COUNT(*) AS n FROM links WHERE id = ? AND disabled_at IS NOT NULL', ['link-1'])).toBe(0)

    const again = await request('/api/admin/reports/report-1/resolve', json('POST', { action: 'dismiss' }))
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ error: { code: 'already_resolved' } })
  })

  it('lists open and resolved reports with the target link state', async () => {
    const { request } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, member)
        await client.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
          args: ['link-1', member.id, 'https://example.com/one', 'one'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason) VALUES (?, ?, ?, ?)`,
          args: ['report-open', 'link-1', 'one', 'spam'],
        })
        await client.execute({
          sql: `INSERT INTO link_reports (id, link_id, slug, reason, resolved_at, resolved_by, resolution)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ['report-closed', 'link-1', 'one', 'phishing', '2026-01-02 00:00:00', admin.id, 'dismiss'],
        })
      },
    })

    const open = await request('/api/admin/reports?status=open')
    const openBody = await open.json() as { items: { id: string; status: string; ownerEmail: string }[] }
    expect(open.status).toBe(200)
    expect(openBody.items).toHaveLength(1)
    expect(openBody.items[0]).toMatchObject({
      id: 'report-open',
      status: 'open',
      ownerEmail: member.email,
    })

    const resolved = await request('/api/admin/reports?status=resolved')
    const resolvedBody = await resolved.json() as { items: { id: string; status: string; resolution: string }[] }
    expect(resolvedBody.items).toHaveLength(1)
    expect(resolvedBody.items[0]).toMatchObject({ id: 'report-closed', status: 'resolved', resolution: 'dismiss' })

    const invalid = await request('/api/admin/reports?status=pending')
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toMatchObject({ error: { code: 'invalid' } })
  })

  it('pages the audit log and filters by action', async () => {
    const { request } = await createTestApp({
      user: admin,
      seed: async (client) => {
        for (let i = 0; i < 30; i += 1) {
          await client.execute({
            sql: `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, meta, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
              `audit-${String(i).padStart(2, '0')}`,
              admin.id,
              i % 2 === 0 ? 'user.role' : 'link.disable',
              'user',
              `target-${i}`,
              JSON.stringify({ index: i }),
              '2026-01-01 00:00:00',
            ],
          })
        }
      },
    })

    const first = await request('/api/admin/audit')
    const firstBody = await first.json() as {
      items: { id: string; actorEmail: string; action: string; meta: { index: number } | null }[]
      nextCursor: string | null
    }
    expect(first.status).toBe(200)
    expect(firstBody.items).toHaveLength(25)
    expect(firstBody.items[0].actorEmail).toBe(admin.email)
    expect(firstBody.items[0].meta).toHaveProperty('index')
    expect(typeof firstBody.nextCursor).toBe('string')

    const second = await request(`/api/admin/audit?cursor=${encodeURIComponent(firstBody.nextCursor ?? '')}`)
    const secondBody = await second.json() as { items: { id: string }[]; nextCursor: string | null }
    const ids = [...firstBody.items, ...secondBody.items].map((item) => item.id)
    expect(new Set(ids).size).toBe(30)
    expect(secondBody.nextCursor).toBeNull()

    const filtered = await request('/api/admin/audit?action=link.disable')
    const filteredBody = await filtered.json() as { items: { action: string }[]; nextCursor: string | null }
    expect(filteredBody.items).toHaveLength(15)
    expect(filteredBody.items.every((item) => item.action === 'link.disable')).toBe(true)
    expect(filteredBody.nextCursor).toBeNull()
  })

  it('does not leak deleted audit actors', async () => {
    const { request } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await client.execute({
          sql: `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, meta)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: ['audit-1', 'gone-user', 'user.role', 'user', 'user-1', null],
        })
      },
    })

    const res = await request('/api/admin/audit')
    const body = await res.json() as { items: { id: string; actorEmail: string | null }[] }
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ id: 'audit-1', actorEmail: null })
  })
})

describe('admin speed route', () => {
  it('returns 401 when anonymous', async () => {
    const { request } = await createTestApp()
    const res = await request('/api/admin/speed?days=7')
    expect(res.status).toBe(401)
  })

  it('rejects unsupported day windows', async () => {
    const { request } = await createTestApp({
      user: admin,
      seed: (client) => insertUser(client, admin),
    })
    const res = await request('/api/admin/speed?days=99')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'invalid' } })
  })

  it('returns thresholds, per-route rows and a sample-weighted trend', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    const { request } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, admin)
        const ins = (day: string, route: string, p75: number, samples: number) =>
          client.execute({
            sql: 'INSERT INTO rum_daily (day, route, metric, device, p75, samples) VALUES (?, ?, ?, ?, ?, ?)',
            args: [day, route, 'LCP', 'mobile', p75, samples],
          })
        await ins(today, '/a', 1000, 1)
        await ins(today, '/b', 3000, 3)
        await ins(old, '/a', 9999, 5)
      },
    })
    const res = await request('/api/admin/speed?days=7')
    expect(res.status).toBe(200)
    const body = await res.json() as {
      thresholds: Record<string, number[]>
      rows: { route: string; metric: string; device: string; p75: number; samples: number }[]
      trend: { metric: string; day: string; p75: number }[]
    }
    expect(body.thresholds.LCP).toEqual([2500, 4000])
    expect(body.rows.map((r) => r.route).sort()).toEqual(['/a', '/b'])
    expect(body.trend).toEqual([{ metric: 'LCP', day: today, p75: 2500 }])
  })
})

describe('admin media pending route', () => {
  it('returns 401 when anonymous', async () => {
    const { request } = await createTestApp()
    const res = await request('/api/admin/media/pending')
    expect(res.status).toBe(401)
  })

  it('lists only stored keys the variants endpoint accepts and that have no meta', async () => {
    const meta = JSON.stringify({ w: 800, h: 400, fmt: 'webp', widths: [96], ph: '' })
    const { request } = await createTestApp({
      user: admin,
      seed: async (client) => {
        await insertUser(client, admin)
        const org = (id: string, logo: string | null, banner: string | null, logoMeta: string | null = null) =>
          client.execute({
            sql: 'INSERT INTO organizations (id, name, owner_id, logo_url, banner_url, logo_meta) VALUES (?, ?, ?, ?, ?, ?)',
            args: [id, id, admin.id, logo, banner, logoMeta],
          })
        await org('org-a', 'orgs/org-a/logo-0123abcd.png', 'https://example.com/b.png')
        await org('org-b', 'orgs/org-b/logo-0123abcd.png', 'orgs/org-b/banner-89abcdef.webp', meta)
        await org('org-c', 'https://example.com/l.png', null)
        await org('org-d', '/media/orgs/org-d/logo-0123abcd.jpg', 'not-a-key')
        await client.execute({
          sql: 'INSERT INTO dp_campaigns (id, creator_id, org_id, title, frame_image_url) VALUES (?, ?, ?, ?, ?)',
          args: ['camp-1', admin.id, 'org-a', 'Camp', 'x'],
        })
        const frame = (id: string, url: string, imageMeta: string | null) =>
          client.execute({
            sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, image_meta) VALUES (?, ?, ?, ?)',
            args: [id, 'camp-1', url, imageMeta],
          })
        await frame('f1', 'frames/camp-1/f1-0123abcd.png', null)
        await frame('f2', 'frames/camp-1/f2-0123abcd.png', meta)
        await frame('f3', 'https://example.com/f.png', null)
      },
    })
    const res = await request('/api/admin/media/pending')
    expect(res.status).toBe(200)
    const body = await res.json() as { items: { key: string; profile: string }[] }
    const sorted = [...body.items].sort((a, b) => a.key.localeCompare(b.key))
    expect(sorted).toEqual([
      { key: 'frames/camp-1/f1-0123abcd.png', profile: 'frame' },
      { key: 'orgs/org-a/logo-0123abcd.png', profile: 'orgLogo' },
      { key: 'orgs/org-b/banner-89abcdef.webp', profile: 'banner' },
      { key: 'orgs/org-d/logo-0123abcd.jpg', profile: 'orgLogo' },
    ])
  })
})
