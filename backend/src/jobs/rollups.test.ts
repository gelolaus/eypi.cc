import { createClient } from '@libsql/client/node'
import type { Client as WebClient } from '@libsql/client/web'
import { describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../test/createTestApp'
import { p75, runHourlyRollups } from './rollups'

const NOW = new Date('2026-10-26T19:15:00.000Z')

async function memoryDb() {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  return client
}

async function seed(
  client: ReturnType<typeof createClient>,
  day: string,
  route: string,
  metric: string,
  device: string,
  values: number[],
) {
  for (const value of values) {
    await client.execute({
      sql: `INSERT INTO rum_samples (day, route, metric, value, rating, device)
            VALUES (?, ?, ?, ?, 'good', ?)`,
      args: [day, route, metric, value, device],
    })
  }
}

async function dailyRows(client: ReturnType<typeof createClient>) {
  const result = await client.execute(
    'SELECT day, route, metric, device, p75, samples FROM rum_daily ORDER BY day, route, metric, device',
  )
  return result.rows.map((row) => ({
    day: String(row.day),
    route: String(row.route),
    metric: String(row.metric),
    device: String(row.device),
    p75: Number(row.p75),
    samples: Number(row.samples),
  }))
}

describe('p75', () => {
  it('uses nearest-rank', () => {
    expect(p75([1, 2, 3, 4])).toBe(3)
    expect(p75([4, 1, 3, 2])).toBe(3)
    expect(p75([5])).toBe(5)
  })
})

describe('runHourlyRollups', () => {
  it('rolls up yesterday and today', async () => {
    const client = await memoryDb()
    await seed(client, '2026-10-25', '/', 'LCP', 'mobile', [1, 2, 3, 4])
    await seed(client, '2026-10-26', '/', 'LCP', 'mobile', [10, 20])
    await seed(client, '2026-10-26', '/', 'LCP', 'desktop', [7])
    await seed(client, '2026-10-26', '/links', 'INP', 'mobile', [100, 200, 300, 400, 500])
    await seed(client, '2026-10-20', '/', 'LCP', 'mobile', [99])

    await runHourlyRollups(client as unknown as WebClient, NOW)

    expect(await dailyRows(client)).toEqual([
      { day: '2026-10-25', route: '/', metric: 'LCP', device: 'mobile', p75: 3, samples: 4 },
      { day: '2026-10-26', route: '/', metric: 'LCP', device: 'desktop', p75: 7, samples: 1 },
      { day: '2026-10-26', route: '/', metric: 'LCP', device: 'mobile', p75: 20, samples: 2 },
      { day: '2026-10-26', route: '/links', metric: 'INP', device: 'mobile', p75: 400, samples: 5 },
    ])
  })

  it('is idempotent', async () => {
    const client = await memoryDb()
    await seed(client, '2026-10-26', '/', 'LCP', 'mobile', [1, 2, 3, 4])

    await runHourlyRollups(client as unknown as WebClient, NOW)
    const first = await dailyRows(client)
    await runHourlyRollups(client as unknown as WebClient, NOW)

    expect(await dailyRows(client)).toEqual(first)
    expect(first).toHaveLength(1)
  })
})

describe('scheduled', () => {
  it('dispatches hourly cron to rollups and daily cron to retention', async () => {
    const runHourlyRollups = vi.fn().mockResolvedValue(undefined)
    const runRetention = vi.fn().mockResolvedValue(undefined)
    vi.resetModules()
    vi.doMock('./rollups', () => ({ runHourlyRollups, p75 }))
    vi.doMock('./retention', () => ({ runRetention }))
    vi.doMock('@libsql/client/web', () => ({ createClient: () => ({}) }))
    const { default: worker } = await import('../index')
    const env = { TURSO_DATABASE_URL: 'libsql://x', TURSO_AUTH_TOKEN: 't' } as never

    await worker.scheduled({ cron: '15 * * * *' } as ScheduledController, env)
    expect(runHourlyRollups).toHaveBeenCalledTimes(1)
    expect(runRetention).not.toHaveBeenCalled()

    await worker.scheduled({ cron: '0 19 * * *' } as ScheduledController, env)
    expect(runRetention).toHaveBeenCalledTimes(1)
    expect(runHourlyRollups).toHaveBeenCalledTimes(1)
    vi.doUnmock('./rollups')
    vi.doUnmock('./retention')
    vi.doUnmock('@libsql/client/web')
  })
})
