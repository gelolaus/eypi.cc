import { createClient } from '@libsql/client/node'
import type { Client as WebClient } from '@libsql/client/web'
import { describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../test/createTestApp'
import { manilaDay, manilaHourOfWeek, p75, rollupLinks, rollupModules, runHourlyRollups } from './rollups'

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

type Db = ReturnType<typeof createClient>

async function linkDb() {
  const client = await memoryDb()
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: ['user-1', 'ada@student.apc.edu.ph', 'Ada'],
  })
  await client.execute({
    sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
    args: ['link-1', 'user-1', 'https://example.com', 'one'],
  })
  return client
}

interface Click {
  at: string
  hash?: string | null
  country?: string | null
  os?: string | null
  device?: string | null
  browser?: string | null
  app?: string | null
  referrer?: string | null
  source?: string | null
}

async function click(client: Db, c: Click, linkId = 'link-1') {
  await client.execute({
    sql: `INSERT INTO analytics (link_id, os, country, referrer, visitor_hash, source, device, browser, app, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      linkId, c.os ?? 'Windows', c.country ?? 'PH', c.referrer === undefined ? 'direct' : c.referrer,
      c.hash ?? null, c.source ?? null, c.device ?? 'desktop', c.browser ?? 'Chrome', c.app ?? null, c.at,
    ],
  })
}

async function dump(client: Db) {
  const daily = await client.execute('SELECT link_id, day, clicks, uniques, qr FROM analytics_daily ORDER BY link_id, day')
  const dim = await client.execute(
    'SELECT link_id, day, dim, value, clicks FROM analytics_daily_dim ORDER BY link_id, day, dim, value',
  )
  return { daily: daily.rows.map((r) => ({ ...r })), dim: dim.rows.map((r) => ({ ...r })) }
}

const web = (c: Db) => c as unknown as WebClient

describe('manila helpers', () => {
  it('maps instants to Manila day and hour of week', () => {
    expect(manilaDay(new Date('2026-10-26T15:59:59Z'))).toBe('2026-10-26')
    expect(manilaDay(new Date('2026-10-26T16:00:00Z'))).toBe('2026-10-27')
    // 2026-10-26 is a Monday. Sunday 16:30Z is Monday 00:30 Manila.
    expect(manilaHourOfWeek(new Date('2026-10-25T16:30:00Z'))).toBe(0)
    expect(manilaHourOfWeek(new Date('2026-10-26T16:30:00Z'))).toBe(24)
    expect(manilaHourOfWeek(new Date('2026-10-25T15:30:00Z'))).toBe(167)
  })
})

describe('rollupLinks', () => {
  it('splits at manila midnight', async () => {
    const client = await linkDb()
    await click(client, { at: '2026-10-26 15:59:59', hash: 'a' })
    await click(client, { at: '2026-10-26 16:00:00', hash: 'b' })
    await rollupLinks(web(client), ['2026-10-26', '2026-10-27'])
    const { daily } = await dump(client)
    expect(daily).toEqual([
      { link_id: 'link-1', day: '2026-10-26', clicks: 1, uniques: 1, qr: 0 },
      { link_id: 'link-1', day: '2026-10-27', clicks: 1, uniques: 1, qr: 0 },
    ])
  })

  it('counts distinct non-null visitor hashes as uniques and qr clicks', async () => {
    const client = await linkDb()
    await click(client, { at: '2026-10-26 01:00:00', hash: 'a', source: 'qr' })
    await click(client, { at: '2026-10-26 02:00:00', hash: 'a' })
    await click(client, { at: '2026-10-26 03:00:00', hash: 'b' })
    await click(client, { at: '2026-10-26 04:00:00', hash: null })
    await click(client, { at: '2026-10-26 05:00:00', hash: null })
    await rollupLinks(web(client), ['2026-10-26'])
    const { daily } = await dump(client)
    expect(daily).toEqual([{ link_id: 'link-1', day: '2026-10-26', clicks: 5, uniques: 2, qr: 1 }])
  })

  it('writes dims with hour of week, skipping a missing app', async () => {
    const client = await linkDb()
    // Monday 2026-10-26 00:30 Manila = Sunday 16:30Z
    await click(client, { at: '2026-10-25 16:30:00', hash: 'a', app: 'messenger', country: 'PH' })
    await click(client, { at: '2026-10-25 17:30:00', hash: 'b', country: 'US', referrer: null })
    await rollupLinks(web(client), ['2026-10-26'])
    const { dim } = await dump(client)
    const pick = (d: string) => dim.filter((r) => r.dim === d).map((r) => [r.value, r.clicks])
    expect(pick('how')).toEqual([['0', 1], ['1', 1]])
    expect(pick('country')).toEqual([['PH', 1], ['US', 1]])
    expect(pick('app')).toEqual([['messenger', 1]])
    expect(pick('device')).toEqual([['desktop', 2]])
    expect(pick('browser')).toEqual([['Chrome', 2]])
    expect(pick('os')).toEqual([['Windows', 2]])
    expect(pick('referrer')).toEqual([['Unknown', 1], ['direct', 1]])
  })

  it('rerun repairs partial day', async () => {
    const client = await linkDb()
    for (let i = 0; i < 6; i++) {
      await click(client, {
        at: `2026-10-26 0${i}:00:00`,
        hash: `h${i}`,
        country: i % 2 ? 'PH' : 'US',
        app: i % 3 ? 'tiktok' : null,
      })
    }
    await rollupLinks(web(client), ['2026-10-26'])
    const fresh = await dump(client)
    await client.execute('DELETE FROM analytics_daily')
    await client.execute("DELETE FROM analytics_daily_dim WHERE dim IN ('country', 'how')")
    await rollupLinks(web(client), ['2026-10-26'])
    expect(await dump(client)).toEqual(fresh)
  })

  it('removes a rollup day whose raw rows are gone', async () => {
    const client = await linkDb()
    await click(client, { at: '2026-10-26 01:00:00', hash: 'a' })
    await rollupLinks(web(client), ['2026-10-26'])
    await client.execute('DELETE FROM analytics')
    await rollupLinks(web(client), ['2026-10-26'])
    expect((await dump(client)).daily).toEqual([])
  })

  it('runHourlyRollups rolls up Manila yesterday and today', async () => {
    const client = await linkDb()
    // NOW is 2026-10-26T19:15Z = 2026-10-27 03:15 Manila.
    await click(client, { at: '2026-10-26 10:00:00', hash: 'a' })
    await click(client, { at: '2026-10-26 17:00:00', hash: 'b' })
    await click(client, { at: '2026-10-20 10:00:00', hash: 'c' })
    await runHourlyRollups(web(client), NOW)
    const { daily } = await dump(client)
    expect(daily.map((r) => [r.day, r.clicks])).toEqual([['2026-10-26', 1], ['2026-10-27', 1]])
  })
})

describe('rollupModules', () => {
  it('counts events and distinct visitors per subject, module, action and day', async () => {
    const client = await memoryDb()
    const rows: Array<[string, string, string, string | null, string]> = [
      ['dp-1', 'frames', 'view', 'a', '2026-10-26'],
      ['dp-1', 'frames', 'view', 'a', '2026-10-26'],
      ['dp-1', 'frames', 'view', 'b', '2026-10-26'],
      ['dp-1', 'frames', 'view', null, '2026-10-26'],
      ['dp-1', 'frames', 'download', 'a', '2026-10-26'],
      ['dp-1', 'frames', 'view', 'a', '2026-10-27'],
      ['org-1', 'org', 'view', 'a', '2026-10-26'],
    ]
    for (const [subject, module, action, hash, day] of rows) {
      await client.execute({
        sql: 'INSERT INTO module_events (module, subject_id, action, visitor_hash, day) VALUES (?, ?, ?, ?, ?)',
        args: [module, subject, action, hash, day],
      })
    }
    await rollupModules(web(client), ['2026-10-26'])
    await rollupModules(web(client), ['2026-10-26'])
    const result = await client.execute(
      'SELECT subject_id, module, action, day, n, uniques FROM module_daily ORDER BY subject_id, module, action, day',
    )
    expect(result.rows.map((r) => ({ ...r }))).toEqual([
      { subject_id: 'dp-1', module: 'frames', action: 'download', day: '2026-10-26', n: 1, uniques: 1 },
      { subject_id: 'dp-1', module: 'frames', action: 'view', day: '2026-10-26', n: 4, uniques: 2 },
      { subject_id: 'org-1', module: 'org', action: 'view', day: '2026-10-26', n: 1, uniques: 1 },
    ])
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
