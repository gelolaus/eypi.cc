import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp } from '../test/createTestApp'
import { rollupLinks } from '../jobs/rollups'

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
  device?: string | null
  browser?: string | null
  app?: string | null
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
      sql: `INSERT INTO analytics (link_id, os, country, referrer, created_at, visitor_hash, source, device, browser, app)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        linkId,
        click.os ?? null,
        click.country ?? null,
        click.referrer ?? null,
        click.createdAt ?? '2026-10-26 00:00:00',
        click.visitorHash ?? null,
        click.source ?? null,
        click.device ?? null,
        click.browser ?? null,
        click.app ?? null,
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

  it('counts today once when a rollup row for today already exists', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'once', slug: 'once', url: 'https://example.com/once' })
    })
    await insertClicks(client, 'once', [
      { createdAt: '2026-10-25 02:00:00', visitorHash: 'y1' },
      { createdAt: '2026-10-25 03:00:00', visitorHash: 'y2' },
      { createdAt: '2026-10-26 00:00:00', visitorHash: 't1', source: 'qr' },
    ])
    await rollupLinks(client as never, ['2026-10-25', '2026-10-26'])
    // A click lands after the hourly job ran, and yesterday's raw rows are gone.
    await insertClicks(client, 'once', [{ createdAt: '2026-10-26 01:00:00', visitorHash: 't2' }])
    await client.execute("DELETE FROM analytics WHERE created_at < '2026-10-25 16:00:00'")

    const res = await request('/api/links/once/analytics?from=2026-10-25&to=2026-10-26')
    const body = await res.json() as {
      totals: { clicks: number; avgDailyUniques: number; qrShare: number }
      timeline: { day: string; clicks: number; uniques: number }[]
    }

    expect(res.status).toBe(200)
    expect(body.timeline).toEqual([
      { day: '2026-10-25', clicks: 2, uniques: 2 },
      { day: '2026-10-26', clicks: 2, uniques: 2 },
    ])
    expect(body.totals.clicks).toBe(4)
    expect(body.totals.avgDailyUniques).toBe(2)
    expect(body.totals.qrShare).toBe(0.25)
  })

  it('defaults to the last 30 Manila days and returns an empty 168-hour heat grid', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'month', slug: 'month', url: 'https://example.com/month' })
    })

    const res = await request('/api/links/month/analytics')
    const body = await res.json() as {
      totals: { clicks: number; avgDailyUniques: number; qrShare: number }
      previous?: unknown
      timeline: { day: string }[]
      heat: number[]
      top: Record<string, unknown[]>
    }

    expect(res.status).toBe(200)
    expect(body.totals).toEqual({ clicks: 0, avgDailyUniques: 0, qrShare: 0, uniques: 0, qr: 0 })
    expect(body.previous).toBeUndefined()
    expect(body.timeline).toHaveLength(30)
    expect(body.timeline[0]?.day).toBe('2026-09-27')
    expect(body.timeline[29]?.day).toBe('2026-10-26')
    expect(body.heat).toHaveLength(168)
    expect(body.heat.every((n) => n === 0)).toBe(true)
    expect(Object.keys(body.top).sort()).toEqual(['app', 'browser', 'country', 'device', 'os', 'referrer'])
  })

  it('puts Monday 01:00 Manila at heat index 1 for raw and rolled-up days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'heat', slug: 'heat', url: 'https://example.com/heat' })
    })
    await insertClicks(client, 'heat', [
      { createdAt: '2026-10-25 17:00:00' }, // Mon 2026-10-26 01:00 Manila, today (raw)
      { createdAt: '2026-10-18 17:00:00' }, // Mon 2026-10-19 01:00 Manila, rolled up
      { createdAt: '2026-10-18 16:00:00' }, // Mon 2026-10-19 00:00 Manila
    ])
    await rollupLinks(client as never, ['2026-10-19'])
    await client.execute("DELETE FROM analytics WHERE created_at < '2026-10-25 16:00:00'")

    const res = await request('/api/links/heat/analytics')
    const body = await res.json() as { heat: number[] }

    expect(body.heat).toHaveLength(168)
    expect(body.heat[0]).toBe(1)
    expect(body.heat[1]).toBe(2)
    expect(body.heat.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('puts Sunday 23:00 Manila at heat index 167 for raw and rolled-up days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW)) // Monday 2026-10-26 10:00 Manila
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'sun', slug: 'sun', url: 'https://example.com/sun' })
    })
    // Sunday 2026-10-25 23:00 Manila
    await insertClicks(client, 'sun', [{ createdAt: '2026-10-25 15:00:00' }])
    await rollupLinks(client as never, ['2026-10-25'])
    await client.execute("DELETE FROM analytics WHERE created_at < '2026-10-25 16:00:00'")
    const body = await (await request('/api/links/sun/analytics?from=2026-10-25&to=2026-10-25')).json() as { heat: number[] }
    expect(body.heat[167]).toBe(1)
    expect(body.heat.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('reads a range that starts today from raw rows only', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'now', slug: 'now', url: 'https://example.com/now' })
    })
    await insertClicks(client, 'now', [
      { createdAt: '2026-10-25 15:00:00', visitorHash: 'old' }, // yesterday
      { createdAt: '2026-10-26 01:00:00', visitorHash: 'a' },
      { createdAt: '2026-10-26 02:00:00', visitorHash: 'b' },
    ])
    const body = await (await request('/api/links/now/analytics?from=2026-10-26&to=2026-10-26')).json() as {
      totals: { clicks: number }
      timeline: { day: string; clicks: number }[]
    }
    expect(body.timeline).toEqual([{ day: '2026-10-26', clicks: 2, uniques: 2 }])
    expect(body.totals.clicks).toBe(2)
  })

  it('ignores a rollup row for today when the range ends before today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'past', slug: 'past', url: 'https://example.com/past' })
    })
    await insertClicks(client, 'past', [
      { createdAt: '2026-10-24 02:00:00', visitorHash: 'a' },
      { createdAt: '2026-10-26 01:00:00', visitorHash: 'b' },
    ])
    await rollupLinks(client as never, ['2026-10-24', '2026-10-26'])
    const body = await (await request('/api/links/past/analytics?from=2026-10-24&to=2026-10-25')).json() as {
      totals: { clicks: number }
      timeline: { day: string; clicks: number }[]
    }
    expect(body.timeline).toEqual([
      { day: '2026-10-24', clicks: 1, uniques: 1 },
      { day: '2026-10-25', clicks: 0, uniques: 0 },
    ])
    expect(body.totals.clicks).toBe(1)
  })

  it('clamps a future end date to today so the daily average is not diluted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'clamp', slug: 'clamp', url: 'https://example.com/clamp' })
    })
    await insertClicks(client, 'clamp', [
      { createdAt: '2026-10-24 02:00:00', visitorHash: 'a' },
      { createdAt: '2026-10-25 02:00:00', visitorHash: 'b' },
      { createdAt: '2026-10-26 01:00:00', visitorHash: 'c' },
    ])
    await rollupLinks(client as never, ['2026-10-24', '2026-10-25'])
    const res = await request('/api/links/clamp/analytics?from=2026-10-24&to=2026-12-31&compare=1')
    expect(res.status).toBe(200)
    const body = await res.json() as {
      totals: { avgDailyUniques: number }
      timeline: { day: string }[]
      previous: { timeline: { day: string }[] }
    }
    expect(body.timeline.map((d) => d.day)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    expect(body.totals.avgDailyUniques).toBe(1)
    expect(body.previous.timeline.map((d) => d.day)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23'])
    // a start date after today is still rejected
    expect((await request('/api/links/clamp/analytics?from=2026-11-01&to=2026-12-31')).status).toBe(422)
  })

  it('is never cached', async () => {
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'nc', slug: 'nc', url: 'https://example.com/nc' })
    })
    const res = await request('/api/links/nc/analytics')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('ranks the top 8 per dimension, buckets gaps as Unknown, and skips a missing app', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'ranked', slug: 'ranked', url: 'https://example.com/ranked' })
    })
    const countries = ['PH', 'US', 'JP', 'DE', 'FR', 'GB', 'CA', 'AU', 'NZ']
    await insertClicks(client, 'ranked', [
      ...countries.flatMap((country, i) => repeat(20 - i, {
        country, createdAt: '2026-10-26 00:00:00', device: 'mobile', browser: 'Safari', os: 'iOS', app: 'messenger',
      })),
      ...repeat(2, { country: null, createdAt: '2026-10-25 20:00:00', device: '', browser: null, os: null, referrer: 'x.com' }),
    ])
    await rollupLinks(client as never, ['2026-10-25'])

    const res = await request('/api/links/ranked/analytics?from=2026-10-25&to=2026-10-26')
    const body = await res.json() as { top: Record<string, { value: string; clicks: number }[]> }

    expect(body.top.country).toHaveLength(8)
    expect(body.top.country[0]).toEqual({ value: 'PH', clicks: 20 })
    expect(body.top.country.some((item) => item.value === 'NZ')).toBe(false)
    expect(body.top.device).toEqual([{ value: 'mobile', clicks: 144 }, { value: 'Unknown', clicks: 2 }])
    expect(body.top.referrer).toEqual([{ value: 'Unknown', clicks: 144 }, { value: 'x.com', clicks: 2 }])
    expect(body.top.app).toEqual([{ value: 'messenger', clicks: 144 }])
  })

  it('compares against an equal-length period ending the day before from', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request, client } = await withOwner(async (db) => {
      await insertLink(db, { id: 'cmp', slug: 'cmp', url: 'https://example.com/cmp' })
    })
    await insertClicks(client, 'cmp', [
      { createdAt: '2026-10-22 04:00:00', visitorHash: 'a' },
      { createdAt: '2026-10-15 04:00:00', visitorHash: 'b' },
      { createdAt: '2026-10-15 05:00:00', visitorHash: 'c' },
      { createdAt: '2026-10-12 04:00:00', visitorHash: 'd' }, // before the previous period
    ])
    await rollupLinks(client as never, ['2026-10-15', '2026-10-22'])

    const res = await request('/api/links/cmp/analytics?from=2026-10-20&to=2026-10-26&compare=1')
    const body = await res.json() as {
      totals: { clicks: number }
      previous: { totals: { clicks: number }; timeline: { day: string; clicks: number }[]; heat: number[] }
    }

    expect(body.totals.clicks).toBe(1)
    expect(body.previous.timeline.map((p) => p.day)).toEqual([
      '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19',
    ])
    expect(body.previous.totals.clicks).toBe(2)
    expect(body.previous.heat).toHaveLength(168)
  })

  it('rejects a range over 400 days and malformed dates with a 422', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    const { request } = await withOwner(async (db) => {
      await insertLink(db, { id: 'cap', slug: 'cap', url: 'https://example.com/cap' })
    })

    const ok = await request('/api/links/cap/analytics?from=2025-09-22&to=2026-10-26')
    const tooLong = await request('/api/links/cap/analytics?from=2025-09-21&to=2026-10-26')
    const backwards = await request('/api/links/cap/analytics?from=2026-10-26&to=2026-10-20')
    const malformed = await request('/api/links/cap/analytics?from=yesterday&to=2026-10-26')

    expect(ok.status).toBe(200)
    expect(tooLong.status).toBe(422)
    expect((await tooLong.json() as { error: { code: string } }).error.code).toBe('invalid_range')
    expect(backwards.status).toBe(422)
    expect(malformed.status).toBe(422)
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
      device: 'mobile',
      browser: 'Safari',
      app: 'messenger',
    }])

    const res = await request('/api/links/sheet/analytics.csv')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(await res.text()).toBe(
      'timestamp,country,os,referrer,source,device,browser,app\r\n'
      + "2026-10-26 01:00:00,PH,iOS,'=evil,qr,mobile,Safari,messenger\r\n",
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
