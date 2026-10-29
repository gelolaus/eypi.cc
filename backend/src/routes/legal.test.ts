import { describe, expect, it, vi } from 'vitest'
import { createSession } from '../lib/auth/session'
import type { Bindings } from '../lib/db'
import { hmacIp } from '../lib/ipHash'
import { createTestApp } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'
const IP = '203.0.113.50'
const USER_AGENT = 'EyepiTest/1.0'

const CONSENT_REQUIRED = {
  error: {
    code: 'consent_required',
    message: 'Accept the current privacy policy and terms to continue.',
  },
}

const INVALID_DOCUMENT = {
  error: {
    code: 'invalid_document',
    message: 'Choose a known legal document.',
  },
}

const user = {
  id: 'ada-id',
  email: 'ada@apc.edu.ph',
  name: 'Ada',
  role: 'user',
}

function send(method: string, body?: unknown, extra: Record<string, string> = {}): RequestInit {
  const headers: Record<string, string> = {
    Origin: ORIGIN,
    'CF-Connecting-IP': IP,
    'User-Agent': USER_AGENT,
    ...extra,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

async function signedIn(env?: Partial<Bindings>, seed?: (client: Awaited<ReturnType<typeof createTestApp>>['client']) => Promise<void>) {
  const harness = await createTestApp({
    env,
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [user.id, user.email, user.name, user.role],
      })
      if (seed) await seed(client)
    },
  })
  const { token } = await createSession(
    harness.client,
    harness.env,
    user.id,
    new Request('https://eypi.cc/'),
  )
  return {
    ...harness,
    request(path: string, init?: RequestInit) {
      const headers = new Headers(init?.headers)
      if (!headers.has('Cookie')) headers.set('Cookie', `eypi_session=${token}`)
      return harness.request(path, { ...init, headers })
    },
  }
}

async function consentRows(client: Awaited<ReturnType<typeof createTestApp>>['client']) {
  const result = await client.execute(
    'SELECT document, version, ip_hash, user_agent FROM legal_consents ORDER BY document, version',
  )
  return result.rows.map((row) => ({
    document: String(row.document),
    version: String(row.version),
    ip_hash: row.ip_hash == null ? null : String(row.ip_hash),
    user_agent: row.user_agent == null ? null : String(row.user_agent),
  }))
}

describe('GET /api/me needsConsent', () => {
  it('lists privacy and terms again when the stored version is not current', async () => {
    const { request } = await signedIn(undefined, async (client) => {
      await client.execute({
        sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES
          ('old-privacy', ?, 'privacy', '2026-01-01'),
          ('old-terms', ?, 'terms', '2026-11-01')`,
        args: [user.id, user.id],
      })
    })

    const res = await request('/api/me')

    expect(res.status).toBe(200)
    const body = await res.json() as { needsConsent: { document: string; version: string }[] }
    expect(body.needsConsent).toEqual([
      { document: 'privacy', version: '2026-11-15' },
    ])
  })
})

describe('POST /api/links consent gate', () => {
  it('returns 403 consent_required before a link is created', async () => {
    const { request, client } = await signedIn()

    const res = await request('/api/links', send('POST', { url: 'https://example.com/one', slug: 'my-link' }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0]?.n)).toBe(0)
  })

  it('returns 201 after the current privacy and terms are accepted', async () => {
    const { request, client } = await signedIn({ IP_HASH_SECRET: 'test-ip-secret' })

    const accepted = await request('/api/legal/consent', send('POST', {
      documents: ['privacy', 'terms'],
      version: '1999-01-01',
    }))
    expect(accepted.status).toBe(200)

    const res = await request('/api/links', send('POST', { url: 'https://example.com/one', slug: 'my-link' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ slug: 'my-link', url: 'https://example.com/one' })
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0]?.n)).toBe(1)
    const me = await request('/api/me')
    expect((await me.json() as { needsConsent: unknown[] }).needsConsent).toEqual([])
    expect(await consentRows(client)).toEqual([
      {
        document: 'privacy',
        version: '2026-11-15',
        ip_hash: await hmacIp('test-ip-secret', IP),
        user_agent: USER_AGENT,
      },
      {
        document: 'terms',
        version: '2026-11-01',
        ip_hash: await hmacIp('test-ip-secret', IP),
        user_agent: USER_AGENT,
      },
    ])
    const audits = await client.execute('SELECT COUNT(*) AS n FROM audit_events')
    expect(Number(audits.rows[0]?.n)).toBe(0)
  })

  it('returns 403 again when a stored version is not current, then 201 after re-accept', async () => {
    const { request } = await signedIn(undefined, async (client) => {
      await client.execute({
        sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES
          ('old-privacy', ?, 'privacy', '2026-01-01'),
          ('old-terms', ?, 'terms', '2026-01-01')`,
        args: [user.id, user.id],
      })
    })

    const blocked = await request('/api/links', send('POST', { url: 'https://example.com/old', slug: 'old-link' }))
    expect(blocked.status).toBe(403)
    expect(await blocked.json()).toEqual(CONSENT_REQUIRED)

    const accepted = await request('/api/legal/consent', send('POST', { documents: ['terms', 'privacy'] }))
    expect(accepted.status).toBe(200)
    const me = await request('/api/me')
    expect((await me.json() as { needsConsent: unknown[] }).needsConsent).toEqual([])

    const created = await request('/api/links', send('POST', { url: 'https://example.com/new', slug: 'new-link' }))
    expect(created.status).toBe(201)
  })
})

describe('POST /api/legal/consent', () => {
  it('returns 401 when nobody is signed in', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/legal/consent', send('POST', { documents: ['privacy'] }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
  })

  it('returns 400 invalid_document for an empty list or an unknown name and stores nothing', async () => {
    const { request, client } = await signedIn()

    const empty = await request('/api/legal/consent', send('POST', { documents: [] }))
    const unknown = await request('/api/legal/consent', send('POST', { documents: ['privacy', 'cookies'] }))
    const shaped = await request('/api/legal/consent', send('POST', { documents: 'privacy' }))

    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual(INVALID_DOCUMENT)
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual(INVALID_DOCUMENT)
    expect(shaped.status).toBe(400)
    expect(await shaped.json()).toEqual(INVALID_DOCUMENT)
    expect(await consentRows(client)).toEqual([])
  })

  it('stores acceptable use without clearing privacy and terms', async () => {
    const { request } = await signedIn()

    const accepted = await request('/api/legal/consent', send('POST', { documents: ['acceptable-use'] }))

    expect(accepted.status).toBe(200)
    const me = await request('/api/me')
    expect((await me.json() as { needsConsent: { document: string }[] }).needsConsent.map((item) => item.document))
      .toEqual(['privacy', 'terms'])
    const blocked = await request('/api/links', send('POST', { url: 'https://example.com/a', slug: 'still-blocked' }))
    expect(blocked.status).toBe(403)
    expect(await blocked.json()).toEqual(CONSENT_REQUIRED)
  })

  it('leaves needsConsent empty when the current version is accepted again', async () => {
    const { request, client } = await signedIn()

    const first = await request('/api/legal/consent', send('POST', { documents: ['privacy', 'terms', 'privacy'] }))
    const second = await request('/api/legal/consent', send('POST', { documents: ['terms', 'privacy'] }))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const me = await request('/api/me')
    expect((await me.json() as { needsConsent: unknown[] }).needsConsent).toEqual([])
    expect(await consentRows(client)).toHaveLength(2)
  })

  it('stores no consent rows when the second insert fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { request, client } = await signedIn()
    let consentInserts = 0
    const originalExecute = client.execute.bind(client)
    const originalBatch = client.batch.bind(client)
    const failingInsert = {
      sql: 'INSERT INTO legal_consents (id, user_id, document, version) VALUES (?, ?, ?, ?)',
      args: [null, null, null, null],
    }

    function poison<T>(stmt: T): T {
      const sql = typeof stmt === 'string' ? stmt : String((stmt as { sql?: unknown }).sql ?? '')
      if (!sql.includes('INSERT INTO legal_consents')) return stmt
      consentInserts += 1
      if (consentInserts === 2) return failingInsert as T
      return stmt
    }

    client.execute = (async (stmt: { sql: string }) => originalExecute(poison(stmt) as never)) as typeof client.execute
    client.batch = (async (stmts: Array<{ sql: string } | string>, mode?: 'write') => {
      return originalBatch(stmts.map((stmt) => poison(stmt)) as never, mode)
    }) as typeof client.batch

    const res = await request('/api/legal/consent', send('POST', { documents: ['privacy', 'terms'] }))

    expect(res.status).toBe(500)
    expect(await consentRows(client)).toEqual([])
  })

  it('stores a null ip hash when IP_HASH_SECRET is missing and a null user agent when the header is absent', async () => {
    const { request, client } = await signedIn()

    const res = await request('/api/legal/consent', {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        'CF-Connecting-IP': IP,
      },
      body: JSON.stringify({ documents: ['privacy'] }),
    })

    expect(res.status).toBe(200)
    expect(await consentRows(client)).toEqual([
      { document: 'privacy', version: '2026-11-15', ip_hash: null, user_agent: null },
    ])
  })
})

describe('consent gate coverage', () => {
  it('blocks link mutations and org routes, and leaves reads, unlock, and the public catalog open', async () => {
    const { request, client } = await signedIn(undefined, async (db) => {
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug)
          VALUES ('link-1', ?, 'https://example.com/a', 'alpha1')`,
        args: [user.id],
      })
    })

    const patch = await request('/api/links/link-1', send('PATCH', { url: 'https://example.com/b' }))
    const removed = await request('/api/links/link-1', send('DELETE'))
    const bulk = await request('/api/links/bulk', send('POST', { action: 'delete', ids: ['link-1'] }))
    const logo = await request('/api/links/link-1/qr-logo', send('PUT', { imageData: null }))
    expect(patch.status).toBe(403)
    expect(await patch.json()).toEqual(CONSENT_REQUIRED)
    expect(removed.status).toBe(403)
    expect(bulk.status).toBe(403)
    expect(logo.status).toBe(403)

    const stored = await client.execute({
      sql: 'SELECT original_url FROM links WHERE id = ?',
      args: ['link-1'],
    })
    expect(stored.rows[0]?.original_url).toBe('https://example.com/a')

    const listed = await request('/api/links')
    const detail = await request('/api/links/link-1')
    expect(listed.status).toBe(200)
    expect(detail.status).toBe(200)

    const unlock = await request('/api/links/alpha1/unlock', send('POST', { password: 'correct-horse' }))
    expect(unlock.status).not.toBe(403)
    const unlockBody = await unlock.json() as { error?: { code?: string } }
    expect(unlockBody.error?.code).not.toBe('consent_required')

    const orgs = await request('/api/orgs')
    expect(orgs.status).toBe(403)
    expect(await orgs.json()).toEqual(CONSENT_REQUIRED)

    const catalog = await request('/api/orgs/public')
    expect(catalog.status).toBe(200)
    const profile = await request('/api/orgs/public/missing')
    expect(profile.status).toBe(404)
    expect(await profile.json()).not.toEqual(CONSENT_REQUIRED)

    const me = await request('/api/me')
    expect(me.status).toBe(200)
  })

  it('returns 401, not consent_required, for an anonymous link create', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/links', send('POST', { url: 'https://example.com/one' }))

    expect(res.status).toBe(401)
  })
})
