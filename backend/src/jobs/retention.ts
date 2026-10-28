import type { Client } from '@libsql/client/web'

const DAY_MS = 24 * 60 * 60 * 1000

/** UTC calendar date `days` before `now`, as `YYYY-MM-DD`. */
function utcDateBefore(now: Date, days: number): string {
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - days,
  ))
  return cutoff.toISOString().slice(0, 10)
}

/** Deletes expired sessions, old event CSV rows, old speed samples, rolled-up raw clicks, and long-resolved link reports. */
export async function runRetention(database: Client, now: Date): Promise<void> {
  const csvCutoff = utcDateBefore(now, 30)
  const reportCutoff = new Date(now.getTime() - 180 * DAY_MS).toISOString()

  await database.execute({
    sql: 'DELETE FROM sessions WHERE expires_at <= ?',
    args: [now.toISOString()],
  })
  // event_date may include a time. Only the UTC calendar day counts, and that day stays.
  await database.execute({
    sql: `DELETE FROM event_csv_rows
          WHERE event_id IN (
            SELECT id FROM events WHERE substr(event_date, 1, 10) < ?
          )`,
    args: [csvCutoff],
  })
  await database.execute({
    sql: 'DELETE FROM rum_samples WHERE day < ?',
    args: [csvCutoff],
  })
  // Raw clicks go 400 days after their Manila day has a rollup row. Unrolled days stay.
  const clickCutoff = new Date(now.getTime() - 400 * DAY_MS).toISOString().slice(0, 19).replace('T', ' ')
  await database.execute({
    sql: `DELETE FROM analytics
          WHERE created_at < ?
            AND EXISTS (
              SELECT 1 FROM analytics_daily d
              WHERE d.link_id = analytics.link_id
                AND d.day = date(analytics.created_at, '+8 hours')
            )`,
    args: [clickCutoff],
  })
  await database.execute({
    sql: `DELETE FROM link_reports
          WHERE resolved_at IS NOT NULL AND resolved_at < ?`,
    args: [reportCutoff],
  })
}
