import { createClient } from '@libsql/client/node'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from '../../test/createTestApp'
import { loadUserTrends } from './userTrends'

async function memoryDb() {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  return client
}

describe('loadUserTrends', () => {
  it('returns zeros for a user with no links', async () => {
    const db = await memoryDb()
    await db.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      args: ['u1', 'ada@student.apc.edu.ph', 'Ada'],
    })
    const trends = await loadUserTrends(db, 'u1', 7, false, '2026-10-31')
    expect(trends.totals).toEqual({ clicks: 0, uniques: 0, qr: 0, activeLinks: 0, links: 0 })
    expect(trends.timeline).toHaveLength(7)
    expect(trends.heat).toHaveLength(168)
    expect(trends.top.links).toEqual([])
    expect(trends.previous).toBeUndefined()
  })
})
