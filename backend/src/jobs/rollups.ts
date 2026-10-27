import type { Client, InStatement } from '@libsql/client/web'

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

/** Hourly job: refreshes yesterday's and today's (UTC) speed rollups. */
export async function runHourlyRollups(database: Client, now: Date): Promise<void> {
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
  await rollUpRumDay(database, yesterday)
  await rollUpRumDay(database, today)
}
