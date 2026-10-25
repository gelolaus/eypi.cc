import { describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../test/createTestApp'
import { decodeLinkKv } from '../../../shared/linksKv'

const owner = {
  id: 'user-1',
  email: 'ada@student.apc.edu.ph',
  name: 'Ada',
  role: 'user',
}

const other = {
  id: 'user-2',
  email: 'bea@student.apc.edu.ph',
  name: 'Bea',
  role: 'user',
}

const ORIGIN = 'https://eypi.cc'

function post(body: unknown, ip = '203.0.113.10'): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify(body),
  }
}

function patch(body: unknown): RequestInit {
  return {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: JSON.stringify(body),
  }
}

async function withOwner(seed?: (client: Awaited<ReturnType<typeof createTestApp>>['client']) => Promise<void>) {
  return createTestApp({
    user: owner,
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role],
      })
      if (seed) await seed(client)
    },
  })
}

function count(value: unknown): number {
  return Number(value ?? 0)
}

describe('links API', () => {
  it('returns 500 internal when listing hits a database error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { request, client } = await withOwner()
    const original = client.execute.bind(client)
    client.execute = (async (stmt: { sql: string; args?: unknown[] }) => {
      if (String(stmt.sql).toLowerCase().includes('links')) {
        throw new Error('database unavailable')
      }
      return original(stmt as never)
    }) as typeof client.execute

    const res = await request('/api/links')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Something went wrong.' },
    })
    vi.restoreAllMocks()
  })

  it('returns 409 slug_taken for a duplicate custom slug', async () => {
    const { request, client } = await withOwner()

    const first = await request('/api/links', post({ url: 'https://example.com/one', slug: 'my-link' }))
    const second = await request('/api/links', post({ url: 'https://example.com/two', slug: 'my-link' }))

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({
      error: { code: 'slug_taken', message: 'That slug is taken.' },
    })
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(count(rows.rows[0].n)).toBe(1)
  })

  it('returns 422 fields.slug for slug a/b', async () => {
    const { request, client } = await withOwner()

    const res = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'a/b' }))
    const body = await res.json() as { error?: { fields?: { slug?: string } } }

    expect(res.status).toBe(422)
    expect(typeof body.error?.fields?.slug).toBe('string')
    expect(body.error?.fields?.slug?.length).toBeGreaterThan(0)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(count(rows.rows[0].n)).toBe(0)
  })

  it('returns 422 userinfo for a destination with credentials', async () => {
    const { request } = await withOwner()

    const res = await request('/api/links', post({ url: 'https://apc.edu.ph@evil.tld' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'userinfo' } })
  })

  it('returns 422 self_link for an eypi.cc destination', async () => {
    const { request } = await withOwner()

    const res = await request('/api/links', post({ url: 'https://eypi.cc/x' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'self_link' } })
  })

  it('returns 429 quota_exceeded for the 501st link', async () => {
    const { request, client } = await withOwner(async (db) => {
      const lines: string[] = []
      for (let i = 0; i < 500; i++) {
        lines.push(
          `INSERT INTO links (id, user_id, original_url, slug) VALUES ('link-${i}', 'user-1', 'https://example.com/${i}', 'q${String(i).padStart(4, '0')}');`,
        )
      }
      await db.executeMultiple(lines.join('\n'))
    })

    const res = await request('/api/links', post({ url: 'https://example.com/over' }))
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: { code: 'quota_exceeded' } })
    expect(count(rows.rows[0].n)).toBe(500)
  })

  it('returns 429 on the 31st create in an hour', async () => {
    const { request, client } = await withOwner()
    let created = 0

    for (let i = 0; i < 31; i++) {
      const res = await request('/api/links', post({ url: `https://example.com/c/${i}` }))
      if (res.status === 201) {
        created += 1
        continue
      }
      expect(res.status).toBe(429)
      expect(await res.json()).toMatchObject({ error: { code: 'too_many' } })
      expect(i).toBe(30)
      break
    }

    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(created).toBe(30)
    expect(count(rows.rows[0].n)).toBe(30)
  })

  it('omits logo bytes and pages 25 links with a stable cursor', async () => {
    const logo = 'data:image/png;base64,AAAA'
    const { request } = await withOwner(async (db) => {
      for (let i = 1; i <= 26; i++) {
        const day = String(i).padStart(2, '0')
        const qr = i === 26
          ? JSON.stringify({
            dotType: 'square',
            eyeFrameType: 'square',
            eyeBallType: 'square',
            color: '#DEAC4B',
            logoDataUrl: logo,
          })
          : null
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, clicks, created_at, qr_config)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `link-${day}`,
            owner.id,
            `https://example.com/${day}`,
            `p${day}x`,
            i,
            `2026-01-${day} 00:00:00`,
            qr,
          ],
        })
      }
    })

    const first = await request('/api/links')
    const secondFetch = await request('/api/links')
    const page = await first.json() as {
      items: Array<{ id: string; hasLogo: boolean; qrConfig?: unknown }>
      nextCursor: string | null
    }
    const again = await secondFetch.json() as { items: Array<{ id: string }>; nextCursor: string | null }

    expect(first.status).toBe(200)
    expect(page.items).toHaveLength(25)
    expect(page.items[0].id).toBe('link-26')
    expect(page.items[24].id).toBe('link-02')
    expect(page.items.map((item) => item.id)).not.toContain('link-01')
    expect(page.nextCursor).toEqual(expect.any(String))
    expect(JSON.stringify(page)).not.toContain('AAAA')
    expect(page.items[0].hasLogo).toBe(true)
    expect(page.items[0].qrConfig).toBeUndefined()
    expect(page.items[1].hasLogo).toBe(false)
    expect(again.items.map((item) => item.id)).toEqual(page.items.map((item) => item.id))
    expect(again.nextCursor).toBe(page.nextCursor)

    const next = await request(`/api/links?cursor=${encodeURIComponent(page.nextCursor ?? '')}`)
    const rest = await next.json() as { items: Array<{ id: string }>; nextCursor: string | null }
    expect(rest.items.map((item) => item.id)).toEqual(['link-01'])
    expect(rest.nextCursor).toBeNull()
  })

  it('filters and sorts the list', async () => {
    const { request } = await withOwner(async (db) => {
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug, clicks, expires_at)
          VALUES ('active-1', ?, 'https://example.com/active', 'active-link', 1, NULL)`,
        args: [owner.id],
      })
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug, clicks, expires_at)
          VALUES ('old-1', ?, 'https://example.com/gone', 'gone-link', 9, '2020-01-01 00:00:00')`,
        args: [owner.id],
      })
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug, clicks, password_hash)
          VALUES ('secret-1', ?, 'https://example.com/secret-list', 'secret-link', 3, ?)`,
        args: [owner.id, 'pbkdf2$sha256$100000$c2FsdA==$aGFzaA=='],
      })
    })

    const expired = await request('/api/links?status=expired')
    const protectedLinks = await request('/api/links?status=protected')
    const searched = await request('/api/links?q=gone')
    const byClicks = await request('/api/links?sort=clicks')

    expect(await expired.json()).toMatchObject({ items: [{ id: 'old-1' }] })
    expect(await protectedLinks.json()).toMatchObject({ items: [{ id: 'secret-1', protected: true }] })
    expect(await searched.json()).toMatchObject({ items: [{ slug: 'gone-link' }] })
    const ranked = await byClicks.json() as { items: Array<{ id: string }> }
    expect(ranked.items.map((item) => item.id)).toEqual(['old-1', 'secret-1', 'active-1'])
  })

  it('returns 404 for another user link', async () => {
    const { request } = await withOwner(async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [other.id, other.email, other.name, other.role],
      })
      await db.execute({
        sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
        args: ['other-link', other.id, 'https://example.com/other', 'other-slug'],
      })
    })

    const res = await request('/api/links/other-link')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } })
  })

  it('reports slug availability', async () => {
    const { request } = await withOwner(async (db) => {
      await db.execute({
        sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
        args: ['link-taken', owner.id, 'https://example.com/t', 'taken-slug'],
      })
    })

    expect(await (await request('/api/links/slug-available?slug=fresh-slug')).json()).toEqual({ available: true })
    expect(await (await request('/api/links/slug-available?slug=taken-slug')).json()).toEqual({
      available: false,
      reason: 'taken',
    })
    expect(await (await request('/api/links/slug-available?slug=links')).json()).toEqual({
      available: false,
      reason: 'reserved',
    })
    expect(await (await request('/api/links/slug-available?slug=ab')).json()).toEqual({
      available: false,
      reason: 'invalid',
    })
  })

  it('rejects a wrong unlock password and the 11th try within 15 minutes', async () => {
    const { request } = await withOwner()
    const created = await request('/api/links', post({
      url: 'https://example.com/secret',
      password: 'correct-horse',
      slug: 'secret1',
    }))
    expect(created.status).toBe(201)
    const { slug } = await created.json() as { slug: string }

    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await request(`/api/links/${slug}/unlock`, post({ password: 'wrong-password' }, '203.0.113.40'))
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ error: { code: 'wrong_password' } })
    }

    const blocked = await request(`/api/links/${slug}/unlock`, post({ password: 'wrong-password' }, '203.0.113.40'))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toMatchObject({ error: { code: 'too_many' } })
  }, 60_000)

  it('returns the destination and one analytics row for the right password', async () => {
    const { request, client, env } = await withOwner()
    const created = await request('/api/links', post({
      url: 'https://example.com/secret',
      password: 'correct-horse',
      slug: 'secret2',
    }))
    const { slug } = await created.json() as { slug: string }
    const raw = await env.LINKS_KV.get(slug)
    expect(raw).not.toContain('correct-horse')
    expect(decodeLinkKv(raw)?.pw).toBe(true)

    const stored = await client.execute({
      sql: 'SELECT password_hash FROM links WHERE slug = ?',
      args: [slug],
    })
    expect(String(stored.rows[0].password_hash)).toMatch(/^pbkdf2\$sha256\$100000\$/)
    expect(String(stored.rows[0].password_hash)).not.toContain('correct-horse')

    const res = await request(`/api/links/${slug}/unlock`, post({ password: 'correct-horse' }, '203.0.113.41'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://example.com/secret' })
    const rows = await client.execute('SELECT COUNT(*) AS n FROM analytics')
    expect(count(rows.rows[0].n)).toBe(1)
  })

  it('returns 410 link_expired for an expired resolve and does not log a click', async () => {
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, expires_at)
            VALUES ('old-link', ?, 'https://example.com/old', 'old-link', '2020-01-01 00:00:00')`,
          args: [owner.id],
        })
      },
    })

    const res = await request('/api/links/resolve/old-link?r=https%3A%2F%2Fexample.com%2Ffrom')
    const rows = await client.execute('SELECT COUNT(*) AS n FROM analytics')

    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ error: { code: 'link_expired' } })
    expect(count(rows.rows[0].n)).toBe(0)
  })

  it('resolves an open link, strips src=qr, and logs the referrer once', async () => {
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug)
            VALUES ('open-link', ?, 'https://example.com/dest?src=qr', 'open-link')`,
          args: [owner.id],
        })
      },
    })

    const res = await request(
      `/api/links/resolve/open-link?r=${encodeURIComponent('https://facebook.com/post')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 Chrome' } },
    )
    const rows = await client.execute('SELECT referrer, source FROM analytics')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://example.com/dest' })
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].referrer).toBe('Facebook')
    expect(rows.rows[0].source).toBe('qr')
  })

  it('does not log a bot resolve', async () => {
    const { request, client } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug)
            VALUES ('bot-link', ?, 'https://example.com/bot', 'bot-link')`,
          args: [owner.id],
        })
      },
    })

    const res = await request('/api/links/resolve/bot-link?r=', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)' },
    })
    const rows = await client.execute('SELECT COUNT(*) AS n FROM analytics')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://example.com/bot' })
    expect(count(rows.rows[0].n)).toBe(0)
  })

  it('returns protected without the destination', async () => {
    const { request, client } = await withOwner()
    const created = await request('/api/links', post({
      url: 'https://example.com/hidden',
      password: 'correct-horse',
      slug: 'hidden1',
    }))
    const { slug } = await created.json() as { slug: string }

    const res = await request(`/api/links/resolve/${slug}?r=`)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM analytics')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ protected: true })
    expect(count(rows.rows[0].n)).toBe(0)
  })

  it('returns 429 when resolve is already at 60 for the IP', async () => {
    const { request, env } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug)
            VALUES ('fast-link', ?, 'https://example.com/fast', 'fast-link')`,
          args: [owner.id],
        })
      },
    })
    const expiry = Math.floor(Date.now() / 1000) + 60
    await env.RATE_LIMIT_KV.put('rl:resolve:203.0.113.60', `60:${expiry}`)

    const res = await request('/api/links/resolve/fast-link?r=', {
      headers: { 'CF-Connecting-IP': '203.0.113.60' },
    })

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: { code: 'too_many' } })
  })

  it('removes the KV key when a link is disabled and restores it when enabled', async () => {
    const { request, env } = await withOwner()
    const created = await request('/api/links', post({
      url: 'https://example.com/back',
      slug: 'come-back',
    }))
    const body = await created.json() as { id: string; slug: string }
    expect(decodeLinkKv(await env.LINKS_KV.get(body.slug))?.url).toBe('https://example.com/back')

    const disabled = await request(`/api/links/${body.id}`, patch({ disabled: true }))
    expect(disabled.status).toBe(200)
    expect(await env.LINKS_KV.get(body.slug)).toBeNull()

    const hidden = await request(`/api/links/resolve/${body.slug}?r=`)
    expect(hidden.status).toBe(404)

    const enabled = await request(`/api/links/${body.id}`, patch({ disabled: false }))
    expect(enabled.status).toBe(200)
    expect(decodeLinkKv(await env.LINKS_KV.get(body.slug))).toMatchObject({
      id: body.id,
      url: 'https://example.com/back',
    })
  })

  it('refuses to re-enable a link a moderator disabled', async () => {
    const { request, env } = await withOwner(async (db) => {
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug, disabled_at, disabled_reason)
          VALUES ('mod-link', ?, 'https://example.com/mod', 'mod-link', '2026-01-01 00:00:00', 'abuse')`,
        args: [owner.id],
      })
    })

    const res = await request('/api/links/mod-link', patch({ disabled: false }))

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'moderator_disabled' } })
    expect(await env.LINKS_KV.get('mod-link')).toBeNull()
  })

  it('bulk-deletes the owner links and their KV keys', async () => {
    const { request, client, env } = await withOwner()
    const first = await request('/api/links', post({ url: 'https://example.com/a', slug: 'bulk-aaa' }))
    const second = await request('/api/links', post({ url: 'https://example.com/b', slug: 'bulk-bbb' }))
    const a = await first.json() as { id: string; slug: string }
    const b = await second.json() as { id: string; slug: string }

    const res = await request('/api/links/bulk', post({
      ids: [a.id, b.id, 'missing-link'],
      action: 'delete',
    }))
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')

    expect(res.status).toBe(200)
    expect(count(rows.rows[0].n)).toBe(0)
    expect(await env.LINKS_KV.get(a.slug)).toBeNull()
    expect(await env.LINKS_KV.get(b.slug)).toBeNull()
  })

  it('returns 429 when edits are already at 120 for the hour', async () => {
    const { request, env } = await withOwner(async (db) => {
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug)
          VALUES ('edit-link', ?, 'https://example.com/edit', 'edit-link')`,
        args: [owner.id],
      })
    })
    const expiry = Math.floor(Date.now() / 1000) + 3600
    await env.RATE_LIMIT_KV.put(`rl:edit:${owner.id}`, `120:${expiry}`)

    const res = await request('/api/links/edit-link', patch({ url: 'https://example.com/edited' }))

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: { code: 'too_many' } })
  })
})
