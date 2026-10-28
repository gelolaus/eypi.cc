import type { Client } from '@libsql/client'
import { manilaDay, manilaDayRange } from '../manilaTime'

export const MAX_RANGE_DAYS = 400
const DAY_MS = 24 * 60 * 60 * 1000
const TOP_N = 8
const TOP_DIMS = ['referrer', 'app', 'country', 'device', 'browser', 'os'] as const

export type TopItem = { value: string; clicks: number }
export type AnalyticsPeriod = {
  totals: { clicks: number; avgDailyUniques: number; qrShare: number }
  timeline: { day: string; clicks: number; uniques: number }[]
  heat: number[]
  top: Record<(typeof TOP_DIMS)[number], TopItem[]>
}

export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

type DimRow = { dim: string; value: string; clicks: number }

/** Same gap handling as the rollup: empty becomes Unknown, a missing app is not a bucket. */
function rawDimSql(dim: string): string {
  const value = dim === 'app' ? 'app' : `COALESCE(NULLIF(${dim}, ''), 'Unknown')`
  return `SELECT '${dim}' AS dim, ${value} AS value, COUNT(*) AS clicks
          FROM analytics
          WHERE link_id = ? AND created_at >= ? AND created_at < ?${dim === 'app' ? ' AND app IS NOT NULL' : ''}
          GROUP BY 2`
}

const RAW_HOW_SQL = `SELECT 'how' AS dim,
          CAST(((CAST(strftime('%w', datetime(created_at, '+8 hours')) AS INTEGER) + 6) % 7) * 24
               + CAST(strftime('%H', datetime(created_at, '+8 hours')) AS INTEGER) AS TEXT) AS value,
          COUNT(*) AS clicks
        FROM analytics
        WHERE link_id = ? AND created_at >= ? AND created_at < ?
        GROUP BY 2`

/**
 * Link analytics for Manila days `from`..`to` (inclusive). Days before today come from the rollup tables;
 * today comes from raw rows, so a rollup row for today (written by the hourly job) is never read.
 */
export async function loadLinkPeriod(
  database: Client,
  linkId: string,
  from: string,
  to: string,
  today: string = manilaDay(new Date()),
): Promise<AnalyticsPeriod> {
  const dayCount = daysBetween(from, to)
  const rollupTo = to < today ? to : addDays(today, -1)
  const includesToday = from <= today && to >= today

  const daily = new Map<string, { clicks: number; uniques: number; qr: number }>()
  const dims: DimRow[] = []

  if (from <= rollupTo) {
    const [dailyResult, dimResult] = await Promise.all([
      database.execute({
        sql: `SELECT day, clicks, uniques, qr FROM analytics_daily
              WHERE link_id = ? AND day >= ? AND day <= ?`,
        args: [linkId, from, rollupTo],
      }),
      database.execute({
        sql: `SELECT dim, value, SUM(clicks) AS clicks FROM analytics_daily_dim
              WHERE link_id = ? AND day >= ? AND day <= ?
              GROUP BY dim, value`,
        args: [linkId, from, rollupTo],
      }),
    ])
    for (const row of dailyResult.rows) {
      daily.set(String(row.day), { clicks: Number(row.clicks), uniques: Number(row.uniques), qr: Number(row.qr) })
    }
    for (const row of dimResult.rows) {
      dims.push({ dim: String(row.dim), value: String(row.value), clicks: Number(row.clicks) })
    }
  }

  if (includesToday) {
    const range = manilaDayRange(today)
    const rawArgs = [linkId, ...range]
    const [dailyResult, ...dimResults] = await Promise.all([
      database.execute({
        sql: `SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_hash) AS uniques,
                     COALESCE(SUM(source = 'qr'), 0) AS qr
              FROM analytics WHERE link_id = ? AND created_at >= ? AND created_at < ?`,
        args: rawArgs,
      }),
      ...[...TOP_DIMS.map(rawDimSql), RAW_HOW_SQL].map((sql) => database.execute({ sql, args: rawArgs })),
    ])
    const todayRow = dailyResult.rows[0]
    if (todayRow && Number(todayRow.clicks) > 0) {
      daily.set(today, { clicks: Number(todayRow.clicks), uniques: Number(todayRow.uniques), qr: Number(todayRow.qr) })
    }
    for (const result of dimResults) {
      for (const row of result.rows) {
        dims.push({ dim: String(row.dim), value: String(row.value), clicks: Number(row.clicks) })
      }
    }
  }

  const timeline: AnalyticsPeriod['timeline'] = []
  let clicks = 0
  let uniques = 0
  let qr = 0
  for (let i = 0; i < dayCount; i++) {
    const day = addDays(from, i)
    const row = daily.get(day)
    timeline.push({ day, clicks: row?.clicks ?? 0, uniques: row?.uniques ?? 0 })
    clicks += row?.clicks ?? 0
    uniques += row?.uniques ?? 0
    qr += row?.qr ?? 0
  }

  const heat = new Array<number>(168).fill(0)
  const merged = new Map<string, Map<string, number>>()
  for (const row of dims) {
    if (row.dim === 'how') {
      const hour = Number(row.value)
      if (Number.isInteger(hour) && hour >= 0 && hour < 168) heat[hour] += row.clicks
      continue
    }
    let values = merged.get(row.dim)
    if (!values) {
      values = new Map()
      merged.set(row.dim, values)
    }
    values.set(row.value, (values.get(row.value) ?? 0) + row.clicks)
  }

  const top = {} as AnalyticsPeriod['top']
  for (const dim of TOP_DIMS) {
    top[dim] = [...(merged.get(dim) ?? [])]
      .map(([value, count]) => ({ value, clicks: count }))
      .sort((a, b) => b.clicks - a.clicks || a.value.localeCompare(b.value))
      .slice(0, TOP_N)
  }

  return {
    totals: {
      clicks,
      avgDailyUniques: Math.round((uniques / dayCount) * 10) / 10,
      qrShare: clicks > 0 ? qr / clicks : 0,
    },
    timeline,
    heat,
    top,
  }
}
