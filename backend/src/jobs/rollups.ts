import type { Client, InStatement } from '@libsql/client/web'
import { manilaHour } from '../lib/manilaTime'

/** Nearest-rank 75th percentile: sort ascending, take index `ceil(0.75 * n) - 1`. */
export function p75(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(0.75 * sorted.length) - 1]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Rebuilds `rum_daily` for one UTC day from `rum_samples`. Safe to repeat. */
async function rollUpRumDay(database: Client, day: string): Promise<void> {
  const result = await database.execute({
    sql: 'SELECT route, metric, device, value FROM rum_samples WHERE day = ?',
    args: [day],
  })

  const groups = new Map<string, { route: string; metric: string; device: string; values: number[] }>()
  for (const row of result.rows) {
    const route = String(row.route)
    const metric = String(row.metric)
    const device = String(row.device)
    const key = JSON.stringify([route, metric, device])
    let group = groups.get(key)
    if (!group) {
      group = { route, metric, device, values: [] }
      groups.set(key, group)
    }
    group.values.push(Number(row.value))
  }

  const statements: InStatement[] = [{ sql: 'DELETE FROM rum_daily WHERE day = ?', args: [day] }]
  for (const group of groups.values()) {
    statements.push({
      sql: `INSERT INTO rum_daily (day, route, metric, device, p75, samples)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [day, group.route, group.metric, group.device, p75(group.values), group.values.length],
    })
  }
  await database.batch(statements, 'write')
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** Manila calendar day (UTC+8, no DST) of an instant, as `YYYY-MM-DD`. */
export function manilaDay(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Hour of week in Manila, 0-167, with Monday 00:00 Manila = 0. */
export function manilaHourOfWeek(date: Date): number {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS)
  return ((manila.getUTCDay() + 6) % 7) * 24 + manila.getUTCHours()
}

/** SQLite `CURRENT_TIMESTAMP` text (`YYYY-MM-DD HH:MM:SS`, UTC) for an instant. */
function sqlTimestamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/** UTC range `[day-1 16:00, day 16:00)` of a Manila day, as `created_at` text. */
export function manilaDayRange(day: string): [string, string] {
  const end = Date.parse(`${day}T00:00:00Z`) - MANILA_OFFSET_MS + DAY_MS
  return [sqlTimestamp(end - DAY_MS), sqlTimestamp(end)]
}

const LINK_DIMS = ['country', 'os', 'device', 'browser', 'app', 'referrer'] as const

/** Rebuilds `analytics_daily` and `analytics_daily_dim` for Manila days. One batch per day, safe to repeat. */
export async function rollupLinks(database: Client, days: string[]): Promise<void> {
  for (const day of days) {
    const [from, to] = manilaDayRange(day)
    const range = [from, to]
    const statements: InStatement[] = [
      { sql: 'DELETE FROM analytics_daily WHERE day = ?', args: [day] },
      { sql: 'DELETE FROM analytics_daily_dim WHERE day = ?', args: [day] },
      {
        sql: `INSERT INTO analytics_daily (link_id, day, clicks, uniques, qr)
              SELECT link_id, ?, COUNT(*), COUNT(DISTINCT visitor_hash),
                     COALESCE(SUM(source = 'qr'), 0)
              FROM analytics
              WHERE created_at >= ? AND created_at < ?
              GROUP BY link_id`,
        args: [day, ...range],
      },
    ]
    for (const dim of LINK_DIMS) {
      // A missing app means no in-app browser, so it is not a bucket. Other gaps become Unknown.
      const value = dim === 'app' ? 'app' : `COALESCE(NULLIF(${dim}, ''), 'Unknown')`
      statements.push({
        sql: `INSERT INTO analytics_daily_dim (link_id, day, dim, value, clicks)
              SELECT link_id, ?, '${dim}', ${value}, COUNT(*)
              FROM analytics
              WHERE created_at >= ? AND created_at < ?${dim === 'app' ? ' AND app IS NOT NULL' : ''}
              GROUP BY link_id, 4`,
        args: [day, ...range],
      })
    }
    statements.push({
      sql: `INSERT INTO analytics_daily_dim (link_id, day, dim, value, clicks)
            SELECT link_id, ?, 'how',
                   CAST(((CAST(strftime('%w', datetime(created_at, '+8 hours')) AS INTEGER) + 6) % 7) * 24
                        + CAST(strftime('%H', datetime(created_at, '+8 hours')) AS INTEGER) AS TEXT),
                   COUNT(*)
            FROM analytics
            WHERE created_at >= ? AND created_at < ?
            GROUP BY link_id, 4`,
      args: [day, ...range],
    })
    await database.batch(statements, 'write')
  }
}

/** Rebuilds `module_daily` from `module_events` for days. One batch per day, safe to repeat. */
export async function rollupModules(database: Client, days: string[]): Promise<void> {
  for (const day of days) {
    await database.batch([
      { sql: 'DELETE FROM module_daily WHERE day = ?', args: [day] },
      {
        sql: `INSERT INTO module_daily (subject_id, module, action, day, n, uniques)
              SELECT subject_id, module, action, day, COUNT(*), COUNT(DISTINCT visitor_hash)
              FROM module_events
              WHERE day = ?
              GROUP BY subject_id, module, action, day`,
        args: [day],
      },
    ], 'write')
  }
}

/** Most missing Manila days rebuilt per run, so a first backfill spreads over a few hours. */
export const BACKFILL_DAYS_PER_RUN = 14

/** Manila hour at which the full hole scan runs once a day. */
const FULL_SCAN_HOUR = 3

/**
 * Rebuilds link rollups for old Manila days that have raw clicks but no `analytics_daily` row for that link.
 * Each step reads the newest unrolled click through `idx_analytics_created` (a backward scan with one primary-key
 * probe on `analytics_daily` per row) and stops at the first hit, then rebuilds that whole day. A hit disappears once
 * its day is rebuilt, so the loop is bounded, idempotent and finds nothing when everything is rolled up.
 *
 * That scan walks up to 400 days of clicks when nothing is missing, so outside the daily scan hour it first probes
 * the oldest click: if that day is rolled up the backlog is done (oldest days are rebuilt last) and the run stops.
 * Holes in the middle, for example from a cron outage, are found by the full scan at `FULL_SCAN_HOUR`:00 Manila.
 */
export async function backfillLinkRollups(database: Client, now: Date): Promise<void> {
  if (manilaHour(now) !== FULL_SCAN_HOUR) {
    const oldest = await database.execute(
      "SELECT link_id, date(created_at, '+8 hours') AS day FROM analytics ORDER BY created_at ASC LIMIT 1",
    )
    const first = oldest.rows[0]
    if (!first) return
    const probe = await database.execute({
      sql: 'SELECT 1 FROM analytics_daily WHERE link_id = ? AND day = ?',
      args: [String(first.link_id), String(first.day)],
    })
    if (probe.rows.length > 0) return
  }
  const yesterday = manilaDay(new Date(now.getTime() - DAY_MS))
  const [before] = manilaDayRange(yesterday)
  for (let i = 0; i < BACKFILL_DAYS_PER_RUN; i++) {
    const found = await database.execute({
      sql: `SELECT date(a.created_at, '+8 hours') AS day
            FROM analytics a
            WHERE a.created_at < ?
              AND NOT EXISTS (
                SELECT 1 FROM analytics_daily d
                WHERE d.link_id = a.link_id AND d.day = date(a.created_at, '+8 hours')
              )
            ORDER BY a.created_at DESC
            LIMIT 1`,
      args: [before],
    })
    const day = found.rows[0]?.day
    if (typeof day !== 'string') return
    await rollupLinks(database, [day])
  }
}

/**
 * Hourly job: refreshes yesterday's and today's speed (UTC) and link and module (Manila) rollups, then backfills old
 * link days. Each stage runs on its own so one failure does not starve the others; the errors are rethrown together.
 */
export async function runHourlyRollups(database: Client, now: Date): Promise<void> {
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
  const manilaDays = [manilaDay(new Date(now.getTime() - DAY_MS)), manilaDay(now)]
  const stages: Array<() => Promise<void>> = [
    async () => {
      await rollUpRumDay(database, yesterday)
      await rollUpRumDay(database, today)
    },
    () => rollupLinks(database, manilaDays),
    () => rollupModules(database, manilaDays),
    () => backfillLinkRollups(database, now),
  ]
  const errors: unknown[] = []
  for (const stage of stages) {
    try {
      await stage()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Hourly rollups failed in ' + errors.length + ' stages')
}
