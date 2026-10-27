import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const owner = { id: 'user-1', email: 'ada@student.apc.edu.ph', name: 'Ada', role: 'user' }

async function withLinks(rows: [string, string, string, number][]) {
  return createTestApp({
    user: owner,
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role],
      })
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: ['user-2', 'bea@student.apc.edu.ph', 'Bea', 'user'],
      })
      for (const [id, userId, slug, clicks] of rows) {
        await client.execute({
          sql: 'INSERT INTO links (id, user_id, original_url, slug, clicks) VALUES (?, ?, ?, ?, ?)',
          args: [id, userId, `https://${slug}.example`, slug, clicks],
        })
      }
    },
  })
}

describe('GET /api/links/summary', () => {
  it('returns zeros and no top link when the user has no links', async () => {
    const { request } = await withLinks([])
    const res = await request('/api/links/summary')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 0, clicks: 0, top: null })
  })

  it('sums only the signed-in user links and names the top one', async () => {
    const { request } = await withLinks([
      ['l1', 'user-1', 'aa', 3],
      ['l2', 'user-1', 'bb', 9],
      ['l3', 'user-2', 'cc', 100],
    ])
    const res = await request('/api/links/summary')
    expect(await res.json()).toEqual({ count: 2, clicks: 12, top: { slug: 'bb', clicks: 9 } })
  })
})
