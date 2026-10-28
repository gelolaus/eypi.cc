import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const owner = { id: 'user-1', email: 'ada@student.apc.edu.ph', name: 'Ada', role: 'user' }

async function setup(signedIn = true) {
  return createTestApp({
    user: signedIn ? owner : undefined,
    seed: async (client) => {
      for (const [id, email] of [['user-1', owner.email], ['user-2', 'bea@student.apc.edu.ph']]) {
        await client.execute({ sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)', args: [id, email, id, 'user'] })
      }
      await client.execute("INSERT INTO links (id, user_id, original_url, slug) VALUES ('l1', 'user-1', 'https://a.example', 'aa')")
      await client.execute("INSERT INTO links (id, user_id, original_url, slug) VALUES ('l2', 'user-2', 'https://b.example', 'bb')")
    },
  })
}

type Client = Awaited<ReturnType<typeof setup>>['client']
async function click(client: Client, linkId: string, minutesAgo: number, country = 'PH', app: string | null = null) {
  await client.execute({
    sql: `INSERT INTO analytics (link_id, country, app, visitor_hash, referrer, created_at)
          VALUES (?, ?, ?, 'secret-hash', 'https://ref.example', strftime('%Y-%m-%d %H:%M:%S', 'now', ?))`,
    args: [linkId, country, app, `-${minutesAgo * 60 + 5} seconds`],
  })
}

describe('GET /api/links/summary/live', () => {
  it('rejects anonymous callers', async () => {
    const { request } = await setup(false)
    expect((await request('/api/links/summary/live')).status).toBe(401)
  })

  it('returns 60 per-minute buckets (oldest first) for own links only', async () => {
    const { request, client } = await setup()
    await click(client, 'l1', 0)
    await click(client, 'l1', 0)
    await click(client, 'l1', 5)
    await click(client, 'l1', 59)
    await click(client, 'l1', 90)
    await click(client, 'l2', 0)
    const res = await request('/api/links/summary/live')
    expect(res.status).toBe(200)
    const body = await res.json() as { last60: number[] }
    expect(body.last60).toHaveLength(60)
    expect(body.last60[59]).toBe(2)
    expect(body.last60[54]).toBe(1)
    expect(body.last60[0]).toBe(1)
    expect(body.last60.reduce((a, b) => a + b, 0)).toBe(4)
  })

  it('lists the 10 most recent clicks with only time, country and app', async () => {
    const { request, client } = await setup()
    for (let i = 0; i < 12; i++) await click(client, 'l1', i, 'PH', i === 0 ? 'messenger' : null)
    await click(client, 'l2', 0, 'US')
    const body = await (await request('/api/links/summary/live')).json() as { recent: Record<string, unknown>[] }
    expect(body.recent).toHaveLength(10)
    expect(body.recent[0]).toEqual({ at: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/), country: 'PH', app: 'messenger' })
    for (const r of body.recent) expect(Object.keys(r).sort()).toEqual(['app', 'at', 'country'])
    expect(JSON.stringify(body)).not.toMatch(/secret-hash|ref\.example|visitor|l1|aa/)
  })

  it('answers 304 for a matching ETag and 200 once a click lands', async () => {
    const { request, client } = await setup()
    const first = await request('/api/links/summary/live')
    const etag = first.headers.get('ETag')
    expect(etag).toMatch(/^W\//)
    expect(first.headers.get('Cache-Control')).toMatch(/no-cache/)
    const again = await request('/api/links/summary/live', { headers: { 'If-None-Match': etag! } })
    expect(again.status).toBe(304)
    await click(client, 'l1', 0)
    const changed = await request('/api/links/summary/live', { headers: { 'If-None-Match': etag! } })
    expect(changed.status).toBe(200)
    expect(changed.headers.get('ETag')).not.toBe(etag)
  })

  it('is not shadowed by /api/links/:id', async () => {
    const { request } = await setup()
    const body = await (await request('/api/links/summary/live')).json() as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['last60', 'recent'])
  })
})
