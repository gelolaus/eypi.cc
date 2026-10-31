import { createClient } from '@libsql/client/node'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from '../../test/createTestApp'
import { loadPeriod, userScope } from './analyticsQuery'

async function memoryDb() {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  return client
}

describe('loadPeriod with userScope', () => {
  it('sums clicks, uniques and qr across only the scoped user links', async () => {
    const db = await memoryDb()
    await db.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?), (?, ?, ?)',
      args: ['u1', 'ada@student.apc.edu.ph', 'Ada', 'u2', 'bea@student.apc.edu.ph', 'Bea'],
    })
    await db.execute({
      sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      args: [
        'l1', 'u1', 'https://example.com/1', 'one',
        'l2', 'u1', 'https://example.com/2', 'two',
        'l3', 'u2', 'https://example.com/3', 'three',
      ],
    })
    await db.execute({
      sql: `INSERT INTO analytics_daily (link_id, day, clicks, uniques, qr) VALUES
            (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      args: [
        'l1', '2026-10-20', 10, 4, 2,
        'l2', '2026-10-20', 5, 3, 1,
        'l2', '2026-10-21', 7, 2, 0,
        'l3', '2026-10-20', 100, 50, 20,
      ],
    })

    const period = await loadPeriod(db, userScope('u1'), '2026-10-20', '2026-10-21', '2026-10-26')

    expect(period.totals.clicks).toBe(22)
    expect(period.totals.uniques).toBe(9)
    expect(period.totals.qr).toBe(3)
    expect(period.timeline).toEqual([
      { day: '2026-10-20', clicks: 15, uniques: 7 },
      { day: '2026-10-21', clicks: 7, uniques: 2 },
    ])
  })
})