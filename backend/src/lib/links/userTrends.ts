import type { Client } from '@libsql/client'
import { addDays, loadPeriod, userScope, type TopItem } from './analyticsQuery'
import { manilaDay, manilaDayRange } from '../manilaTime'

export type TrendsPeriod = {
  totals: { clicks: number; uniques: number; qr: number; activeLinks: number }
  timeline: { day: string; clicks: number; uniques: number }[]
}

export type UserTrends = TrendsPeriod & {
  totals: TrendsPeriod['totals'] & { links: number }
  top: {
    links: { slug: string; clicks: number }[]
    device: TopItem[]
    country: TopItem[]
    referrer: TopItem[]
    app: TopItem[]
  }
  heat: number[]
  previous?: TrendsPeriod
}

const TOP_LINK_N = 5

async function loadTopLinks(
  database: Client,
  userId: string,
  from: string,
  to: string,
  today: string,
): Promise<{ links: { slug: string; clicks: number }[]; activeLinks: number }> {
  const rollupTo = to < today ? to : addDays(today, -1)
  const clicksByLink = new Map<string, { slug: string; clicks: number }>()

  if (from <= rollupTo) {
    const result = await database.execute({
      sql: `SELECT l.id AS id, l.slug AS slug, SUM(d.clicks) AS clicks
            FROM analytics_daily d
            INNER JOIN links l ON l.id = d.link_id
            WHERE l.user_id = ? AND d.day >= ? AND d.day <= ?
            GROUP BY l.id, l.slug`,
      args: [userId, from, rollupTo],
    })
    for (const row of result.rows) {
      const id = String(row.id)
      clicksByLink.set(id, { slug: String(row.slug), clicks: Number(row.clicks) })
    }
  }

  if (from <= today && to >= today) {
    const range = manilaDayRange(today)
    const result = await database.execute({
      sql: `SELECT l.id AS id, l.slug AS slug, COUNT(*) AS clicks
            FROM analytics a
            INNER JOIN links l ON l.id = a.link_id
            WHERE l.user_id = ? AND a.created_at >= ? AND a.created_at < ?
            GROUP BY l.id, l.slug`,
      args: [userId, ...range],
    })
    for (const row of result.rows) {
      const id = String(row.id)
      const prev = clicksByLink.get(id)
      const clicks = Number(row.clicks) + (prev?.clicks ?? 0)
      clicksByLink.set(id, { slug: String(row.slug), clicks })
    }
  }

  const ranked = [...clicksByLink.values()]
    .filter((row) => row.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks || a.slug.localeCompare(b.slug))

  return {
    links: ranked.slice(0, TOP_LINK_N),
    activeLinks: ranked.length,
  }
}

function toTrendsPeriod(
  period: Awaited<ReturnType<typeof loadPeriod>>,
  activeLinks: number,
): TrendsPeriod {
  return {
    totals: {
      clicks: period.totals.clicks,
      uniques: period.totals.uniques,
      qr: period.totals.qr,
      activeLinks,
    },
    timeline: period.timeline,
  }
}

export async function loadUserTrends(
  database: Client,
  userId: string,
  range: 7 | 30 | 90,
  compare: boolean,
  today: string = manilaDay(new Date()),
): Promise<UserTrends> {
  const from = addDays(today, -(range - 1))
  const to = today
  const scope = userScope(userId)

  const [current, linkCountResult, topLinks] = await Promise.all([
    loadPeriod(database, scope, from, to, today),
    database.execute({
      sql: 'SELECT COUNT(*) AS count FROM links WHERE user_id = ?',
      args: [userId],
    }),
    loadTopLinks(database, userId, from, to, today),
  ])

  const links = Number(linkCountResult.rows[0]?.count ?? 0)
  const result: UserTrends = {
    totals: {
      clicks: current.totals.clicks,
      uniques: current.totals.uniques,
      qr: current.totals.qr,
      activeLinks: topLinks.activeLinks,
      links,
    },
    timeline: current.timeline,
    top: {
      links: topLinks.links,
      device: current.top.device,
      country: current.top.country,
      referrer: current.top.referrer,
      app: current.top.app,
    },
    heat: current.heat,
  }

  if (compare) {
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(range - 1))
    const [previous, prevTop] = await Promise.all([
      loadPeriod(database, scope, prevFrom, prevTo, today),
      loadTopLinks(database, userId, prevFrom, prevTo, today),
    ])
    result.previous = toTrendsPeriod(previous, prevTop.activeLinks)
  }

  return result
}
