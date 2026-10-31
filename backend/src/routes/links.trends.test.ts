import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp } from '../test/createTestApp'

const owner = { id: 'user-1', email: 'ada@student.apc.edu.ph', name: 'Ada', role: 'user' }
const other = { id: 'user-2', email: 'bea@student.apc.edu.ph', name: 'Bea', role: 'user' }
const FROZEN_NOW = '2026-10-31T02:00:00Z' // 2026-10-31 10:00 Manila

type TrendsBody = {
  totals: { clicks: number; uniques: number; qr: number; activeLinks: number; links: number }
  timeline: { day: string; clicks: number; uniques: number }[]
  top: {
    links: { slug: string; clicks: number }[]
    device: { value: string; clicks: number }[]
    country: { value: string; clicks: number }[]
    referrer: { value: string; clicks: number }[]
    app: { value: string; clicks: number }[]
  }
  heat: number[]
  previous?: { totals: unknown; timeline: { day: string; clicks: number; uniques: number }[] }
}

async function withOwner(seed?: (client: Client) => Promise<void>) {
  return createTestApp({
    user: owner,
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role, other.id, other.email, other.name, other.role],
      })
      if (seed) await seed(client)
    },
  })
}

async function insertLink(
  client: Client,
  row: { id: string; slug: string; userId?: string },
) {
  await client.execute({
    sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
    args: [row.id, row.userId ?? owner.id, `https://${row.slug}.example`, row.slug],
  })
}

async function insertDaily(
  client: Client,
  rows: [string, string, number, number, number][],
) {
  for (const [linkId, day, clicks, uniques, qr] of rows) {
    await client.execute({
      sql: 'INSERT INTO analytics_daily (link_id, day, clicks, uniques, qr) VALUES (?, ?, ?, ?, ?)',
      args: [linkId, day, clicks, uniques, qr],
    })
  }
}

async function insertDim(
  client: Client,
  rows: [string, string, string, string, number][],
) {
  for (const [linkId, day, dim, value, clicks] of rows) {
    await client.execute({
      sql: 'INSERT INTO analytics_daily_dim (link_id, day, dim, value, clicks) VALUES (?, ?, ?, ?, ?)',
      args: [linkId, day, dim, value, clicks],
    })
  }
}

async function insertClick(
  client: Client,
  linkId: string,
  at: string,
  extra: { country?: string; device?: string; source?: string; hash?: string; app?: string; referrer?: string } = {},
) {
  await client.execute({
    sql: `INSERT INTO analytics (link_id, os, country, referrer, visitor_hash, source, device, browser, app, created_at)
          VALUES (?, 'Windows', ?, ?, ?, ?, ?, 'Chrome', ?, ?)`,
    args: [
      linkId,
      extra.country ?? 'PH',
      extra.referrer ?? 'direct',
      extra.hash ?? null,
      extra.source ?? null,
      extra.device ?? 'desktop',
      extra.app ?? null,
      at,
    ],
  })
}

describe('GET /api/links/summary/trends', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 without a session', async () => {
    const { request } = await createTestApp()
    expect((await request('/api/links/summary/trends')).status).toBe(401)
  })

  it('returns 422 invalid_range for an unsupported range', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner()
    const res = await request('/api/links/summary/trends?range=14')
    expect(res.status).toBe(422)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('invalid_range')
  })

  it('defaults to range 30 with an all-zero empty response', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner()
    const res = await request('/api/links/summary/trends')
    const body = await res.json() as TrendsBody
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(body.totals).toEqual({ clicks: 0, uniques: 0, qr: 0, activeLinks: 0, links: 0 })
    expect(body.timeline).toHaveLength(30)
    expect(body.timeline.every((row) => row.clicks === 0 && row.uniques === 0)).toBe(true)
    expect(body.timeline[0]?.day).toBe('2026-10-02')
    expect(body.timeline[29]?.day).toBe('2026-10-31')
    expect(body.heat).toHaveLength(168)
    expect(body.heat.every((n) => n === 0)).toBe(true)
    expect(body.top).toEqual({ links: [], device: [], country: [], referrer: [], app: [] })
    expect(body.previous).toBeUndefined()
  })

  it('sums only the signed-in user links and ranks top links by clicks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'l1', slug: 'alpha' })
      await insertLink(db, { id: 'l2', slug: 'beta' })
      await insertLink(db, { id: 'l3', slug: 'other', userId: other.id })
      await insertDaily(db, [
        ['l1', '2026-10-29', 10, 4, 2],
        ['l2', '2026-10-29', 5, 3, 1],
        ['l2', '2026-10-30', 20, 8, 4],
        ['l3', '2026-10-29', 100, 50, 20],
      ])
      await insertDim(db, [
        ['l1', '2026-10-29', 'device', 'mobile', 10],
        ['l2', '2026-10-30', 'device', 'desktop', 20],
        ['l3', '2026-10-29', 'device', 'tablet', 100],
        ['l1', '2026-10-29', 'country', 'PH', 10],
        ['l2', '2026-10-30', 'country', 'US', 20],
      ])
    })

    const res = await request('/api/links/summary/trends?range=7')
    const body = await res.json() as TrendsBody
    expect(res.status).toBe(200)
    expect(body.totals.clicks).toBe(35)
    expect(body.totals.uniques).toBe(15)
    expect(body.totals.qr).toBe(7)
    expect(body.totals.links).toBe(2)
    expect(body.totals.activeLinks).toBe(2)
    expect(body.timeline).toHaveLength(7)
    expect(body.timeline.find((r) => r.day === '2026-10-29')).toEqual({ day: '2026-10-29', clicks: 15, uniques: 7 })
    expect(body.timeline.find((r) => r.day === '2026-10-30')).toEqual({ day: '2026-10-30', clicks: 20, uniques: 8 })
    expect(body.top.links).toEqual([
      { slug: 'beta', clicks: 25 },
      { slug: 'alpha', clicks: 10 },
    ])
    expect(body.top.device[0]).toEqual({ value: 'desktop', clicks: 20 })
    expect(body.top.country.map((c) => c.value).sort()).toEqual(['PH', 'US'])
    expect(body.top.device.every((d) => d.value !== 'tablet')).toBe(true)
  })

  it('counts activeLinks as links with clicks and ignores deleted-link rollups', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'alive', slug: 'alive' })
      await insertLink(db, { id: 'quiet', slug: 'quiet' })
      await insertDaily(db, [
        ['alive', '2026-10-30', 3, 2, 0],
        ['gone', '2026-10-30', 50, 20, 5],
      ])
    })

    const body = await (await request('/api/links/summary/trends?range=7')).json() as TrendsBody
    expect(body.totals.clicks).toBe(3)
    expect(body.totals.links).toBe(2)
    expect(body.totals.activeLinks).toBe(1)
    expect(body.top.links).toEqual([{ slug: 'alive', clicks: 3 }])
  })

  it('returns previous period when compare=1', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'l1', slug: 'cmp' })
      await insertDaily(db, [
        ['l1', '2026-10-28', 2, 1, 0],
        ['l1', '2026-10-20', 9, 4, 1],
      ])
    })

    const body = await (await request('/api/links/summary/trends?range=7&compare=1')).json() as TrendsBody
    expect(body.timeline).toHaveLength(7)
    expect(body.previous).toBeDefined()
    expect(body.previous!.timeline).toHaveLength(7)
    expect(body.previous!.timeline[0]?.day).toBe('2026-10-18')
    expect(body.previous!.timeline[6]?.day).toBe('2026-10-24')
    expect(body.previous!.timeline.find((r) => r.day === '2026-10-20')?.clicks).toBe(9)
    expect(body.timeline.find((r) => r.day === '2026-10-28')?.clicks).toBe(2)
  })

  it('reads today from raw rows and maps a late UTC click to the next Manila day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'today', slug: 'today' })
      // Stale rollup for today must be ignored.
      await insertDaily(db, [['today', '2026-10-31', 99, 50, 10]])
    })
    // 2026-10-30 16:30 UTC = 2026-10-31 00:30 Manila
    await insertClick(client, 'today', '2026-10-30 16:30:00', { hash: 'm1', source: 'qr', country: 'PH', device: 'mobile' })
    await insertClick(client, 'today', '2026-10-30 17:00:00', { hash: 'm2', device: 'mobile' })

    const body = await (await request('/api/links/summary/trends?range=7')).json() as TrendsBody
    expect(body.timeline.find((r) => r.day === '2026-10-31')).toEqual({ day: '2026-10-31', clicks: 2, uniques: 2 })
    expect(body.totals.clicks).toBe(2)
    expect(body.totals.qr).toBe(1)
    expect(body.totals.activeLinks).toBe(1)
    expect(body.top.links).toEqual([{ slug: 'today', clicks: 2 }])
  })
})
