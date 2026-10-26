import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp } from '../test/createTestApp'

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

const FROZEN_NOW = '2026-10-26T02:00:00Z'

type Click = {
  os?: string | null
  country?: string | null
  referrer?: string | null
  createdAt?: string
  visitorHash?: string | null
  source?: string | null
}

async function withOwner(seed?: (client: Client) => Promise<void>) {
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

async function insertLink(
  client: Client,
  row: {
    id: string
    slug: string
    url: string
    userId?: string
    clicks?: number
    createdAt?: string
    expiresAt?: string | null
    disabledAt?: string | null
    passwordHash?: string | null
  },
) {
  await client.execute({
    sql: `INSERT INTO links (
      id, user_id, original_url, slug, clicks, created_at, expires_at, disabled_at, password_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.userId ?? owner.id,
      row.url,
      row.slug,
      row.clicks ?? 0,
      row.createdAt ?? '2026-10-01 00:00:00',
      row.expiresAt ?? null,
      row.disabledAt ?? null,
      row.passwordHash ?? null,
    ],
  })
}

async function insertClicks(client: Client, linkId: string, clicks: Click[]) {
  for (const click of clicks) {
    await client.execute({
      sql: `INSERT INTO analytics (link_id, os, country, referrer, created_at, visitor_hash, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        linkId,
        click.os ?? null,
        click.country ?? null,
        click.referrer ?? null,
        click.createdAt ?? '2026-10-26 00:00:00',
        click.visitorHash ?? null,
        click.source ?? null,
      ],
    })
  }
}

function repeat(count: number, click: Click): Click[] {
  return Array.from({ length: count }, () => click)
}

describe('link analytics and CSV export', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ranks top referrers, countries, and operating systems by count and keeps five', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'ranked', slug: 'ranked', url: 'https://example.com/ranked' })
    })
    await insertClicks(client, 'ranked', [
      ...repeat(6, { referrer: 'zulu', country: 'ZZ', os: 'iOS' }),
      ...repeat(5, { referrer: 'mike', country: 'PH', os: 'Windows' }),
      ...repeat(4, { referrer: 'alpha', country: 'US', os: 'Android' }),
      ...repeat(3, { referrer: 'yankee', country: 'JP', os: 'Linux' }),
      ...repeat(2, { referrer: 'bravo', country: 'DE', os: 'macOS' }),
      ...repeat(1, { referrer: 'charlie', country: 'FR', os: 'ChromeOS' }),
      ...repeat(9, { referrer: null, country: null, os: null }),
    ])

    const res = await request('/api/links/ranked/analytics?range=30')
    const body = await res.json() as {
      topReferrers: { referrer: string; count: number }[]
      topCountries: { country: string; count: number }[]
      topOs: { os: string; count: number }[]
    }

    expect(res.status).toBe(200)
    expect(body.topReferrers).toEqual([
      { referrer: 'zulu', count: 6 },
      { referrer: 'mike', count: 5 },
      { referrer: 'alpha', count: 4 },
      { referrer: 'yankee', count: 3 },
      { referrer: 'bravo', count: 2 },
    ])
    expect(body.topCountries).toEqual([
      { country: 'ZZ', count: 6 },
      { country: 'PH', count: 5 },
      { country: 'US', count: 4 },
      { country: 'JP', count: 3 },
      { country: 'DE', count: 2 },
    ])
    expect(body.topOs).toEqual([
      { os: 'iOS', count: 6 },
      { os: 'Windows', count: 5 },
      { os: 'Android', count: 4 },
      { os: 'Linux', count: 3 },
      { os: 'macOS', count: 2 },
    ])
  })

  it('buckets a click at 2026-10-25T17:00:00Z onto Manila day 2026-10-26', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'manila', slug: 'manila', url: 'https://example.com/manila' })
    })
    await insertClicks(client, 'manila', [{
      createdAt: '2026-10-25 17:00:00',
      os: 'iOS',
      country: 'PH',
      referrer: 'example.com',
      visitorHash: 'hash-a',
      source: 'qr',
    }])

    const res = await request('/api/links/manila/analytics?range=7')
    const body = await res.json() as {
      total: number
      unique: number
      qr: number
      direct: number
      peakHour: number | null
      timeline: { day: string; clicks: number }[]
    }

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.unique).toBe(1)
    expect(body.qr).toBe(1)
    expect(body.direct).toBe(0)
    expect(body.peakHour).toBe(1)
    expect(body.timeline.map((point) => point.day)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ])
    expect(body.timeline[6]).toEqual({ day: '2026-10-26', clicks: 1 })
    expect(body.timeline[5]).toEqual({ day: '2026-10-25', clicks: 0 })
  })

  it('counts distinct visitor hashes and treats only source qr as qr', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'visitors', slug: 'visitors', url: 'https://example.com/visitors' })
    })
    await insertClicks(client, 'visitors', [
      { visitorHash: 'hash-a', source: 'qr', createdAt: '2026-10-25 17:00:00' },
      { visitorHash: 'hash-a', source: 'qr', createdAt: '2026-10-25 18:00:00' },
      { visitorHash: 'hash-b', source: 'direct', createdAt: '2026-10-25 19:00:00' },
      { visitorHash: null, source: null, createdAt: '2026-10-25 19:30:00' },
    ])

    const res = await request('/api/links/visitors/analytics?range=7')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ total: 4, unique: 2, qr: 2, direct: 2 })
  })

  it('drops a click before the Manila window and keeps the midnight boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'window', slug: 'window', url: 'https://example.com/window' })
    })
    await insertClicks(client, 'window', [
      { createdAt: '2026-07-28 10:00:00', visitorHash: 'out' },
      { createdAt: '2026-07-28 16:00:00', visitorHash: 'in' },
    ])

    const res = await request('/api/links/window/analytics?range=90')
    const body = await res.json() as { total: number; timeline: { day: string; clicks: number }[] }

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.timeline).toHaveLength(90)
    expect(body.timeline[0]).toEqual({ day: '2026-07-29', clicks: 1 })
    expect(body.timeline[89]).toEqual({ day: '2026-10-26', clicks: 0 })
  })

  it('uses a 30-day Manila timeline when range is omitted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'month', slug: 'month', url: 'https://example.com/month' })
    })

    const res = await request('/api/links/month/analytics')
    const body = await res.json() as {
      total: number
      peakHour: number | null
      timeline: { day: string }[]
      topReferrers: unknown[]
    }

    expect(res.status).toBe(200)
    expect(body.total).toBe(0)
    expect(body.peakHour).toBeNull()
    expect(body.topReferrers).toEqual([])
    expect(body.timeline).toHaveLength(30)
    expect(body.timeline[0]?.day).toBe('2026-09-27')
    expect(body.timeline[29]?.day).toBe('2026-10-26')
  })

  it('returns 404 when the link belongs to someone else', async () => {
    const { request } = await withOwner(async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [other.id, other.email, other.name, other.role],
      })
      await insertLink(db, {
        id: 'theirs',
        slug: 'theirs',
        url: 'https://example.com/theirs',
        userId: other.id,
      })
    })

    const analytics = await request('/api/links/theirs/analytics?range=7')
    const csv = await request('/api/links/theirs/analytics.csv')

    expect(analytics.status).toBe(404)
    expect(csv.status).toBe(404)
  })

  it('writes export.csv with the owner links, short urls, and status', async () => {
    const { request } = await withOwner(async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [other.id, other.email, other.name, other.role],
      })
      await insertLink(db, {
        id: 'formula',
        slug: '=sum',
        url: 'https://example.com/eq',
        clicks: 3,
        createdAt: '2026-10-02 00:00:00',
      })
      await insertLink(db, {
        id: 'promo',
        slug: 'promo',
        url: 'https://example.com/promo',
        clicks: 4,
        createdAt: '2026-10-01 00:00:00',
      })
      await insertLink(db, {
        id: 'old',
        slug: 'old',
        url: 'https://example.com/old',
        clicks: 1,
        createdAt: '2026-09-01 00:00:00',
        expiresAt: '2020-01-01 00:00:00',
      })
      await insertLink(db, {
        id: 'off',
        slug: 'off',
        url: 'https://example.com/off',
        clicks: 2,
        createdAt: '2026-08-01 00:00:00',
        disabledAt: '2026-08-02 00:00:00',
      })
      await insertLink(db, {
        id: 'lock',
        slug: 'lock',
        url: 'https://example.com/lock',
        clicks: 0,
        createdAt: '2026-07-01 00:00:00',
        passwordHash: 'pbkdf2$sha256$100000$salt$hash',
      })
      await insertLink(db, {
        id: 'hidden',
        slug: 'hidden',
        url: 'https://example.com/hidden',
        userId: other.id,
        createdAt: '2026-10-03 00:00:00',
      })
    })

    const res = await request('/api/links/export.csv')
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(text).toBe(
      'slug,short_url,destination,clicks,created_at,expires_at,status\r\n'
      + "'=sum,https://eypi.cc/=sum,https://example.com/eq,3,2026-10-02T00:00:00.000Z,,active\r\n"
      + 'promo,https://eypi.cc/promo,https://example.com/promo,4,2026-10-01T00:00:00.000Z,,active\r\n'
      + 'old,https://eypi.cc/old,https://example.com/old,1,2026-09-01T00:00:00.000Z,2020-01-01T00:00:00.000Z,expired\r\n'
      + 'off,https://eypi.cc/off,https://example.com/off,2,2026-08-01T00:00:00.000Z,,disabled\r\n'
      + 'lock,https://eypi.cc/lock,https://example.com/lock,0,2026-07-01T00:00:00.000Z,,protected\r\n',
    )
  })

  it('writes analytics.csv with a Manila timestamp and formula guard', async () => {
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'sheet', slug: 'sheet', url: 'https://example.com/sheet' })
    })
    await insertClicks(client, 'sheet', [{
      createdAt: '2026-10-25 17:00:00',
      country: 'PH',
      os: 'iOS',
      referrer: '=evil',
      source: 'qr',
    }])

    const res = await request('/api/links/sheet/analytics.csv')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(await res.text()).toBe(
      'timestamp,country,os,referrer,source\r\n'
      + "2026-10-26 01:00:00,PH,iOS,'=evil,qr\r\n",
    )
  })

  it('requires a session for the csv exports', async () => {
    const { request } = await createTestApp()

    const links = await request('/api/links/export.csv')
    const analytics = await request('/api/links/missing/analytics.csv')

    expect(links.status).toBe(401)
    expect(analytics.status).toBe(401)
  })
})
