import { createClient } from '@libsql/client/node'
import type { Client as WebClient } from '@libsql/client/web'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from '../test/createTestApp'
import { runRetention } from './retention'

const NOW = new Date('2026-10-26T19:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
/** UTC calendar date 30 days before NOW. Rows on this date stay. */
const CSV_CUTOFF = '2026-09-26'
/** Instant 180 days before NOW. A report resolved at this instant stays. */
const REPORT_CUTOFF = new Date(NOW.getTime() - 180 * DAY_MS).toISOString()

async function memoryDb() {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: ['user-1', 'ada@student.apc.edu.ph', 'Ada'],
  })
  return client
}

function ids(rows: ReadonlyArray<{ readonly [name: string]: unknown }>): string[] {
  return rows.map((row) => String(row.id))
}

describe('runRetention', () => {
  it('deletes sessions at or before now and keeps a later session', async () => {
    const client = await memoryDb()
    await client.execute({
      sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES
            (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
      args: [
        'session-past', 'user-1', '2026-01-01T00:00:00.000Z',
        'session-now', 'user-1', NOW.toISOString(),
        'session-live', 'user-1', new Date(NOW.getTime() + 1).toISOString(),
      ],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT id FROM sessions ORDER BY id')
    expect(ids(left.rows)).toEqual(['session-live'])
  })

  it('deletes csv rows whose event date is before the 30-day cutoff and keeps the cutoff and later', async () => {
    const client = await memoryDb()
    await client.execute({
      sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location)
            VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'event-old', 'old', 'user-1', 'Old', '2026-09-25', '09:00', 'Hall',
        'event-cutoff', 'cutoff', 'user-1', 'Cutoff', `${CSV_CUTOFF}T23:59:59Z`, '09:00', 'Hall',
        'event-new', 'new', 'user-1', 'New', '2026-10-20', '09:00', 'Hall',
      ],
    })
    await client.execute({
      sql: `INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES
            (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      args: [
        'row-old', 'event-old', 0, '{}',
        'row-cutoff', 'event-cutoff', 0, '{}',
        'row-new', 'event-new', 0, '{}',
      ],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT id FROM event_csv_rows ORDER BY id')
    expect(ids(left.rows)).toEqual(['row-cutoff', 'row-new'])
    const events = await client.execute('SELECT id FROM events ORDER BY id')
    expect(ids(events.rows)).toEqual(['event-cutoff', 'event-new', 'event-old'])
  })

  it('deletes resolved reports strictly older than 180 days and keeps unresolved reports', async () => {
    const client = await memoryDb()
    expect(REPORT_CUTOFF).toBe('2026-04-29T19:00:00.000Z')
    await client.execute({
      sql: `INSERT INTO link_reports (id, reason, resolved_at) VALUES
            (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
      args: [
        'report-old', 'spam', '2026-04-29T18:59:59.999Z',
        'report-cutoff', 'spam', REPORT_CUTOFF,
        'report-recent', 'spam', '2026-10-01T00:00:00.000Z',
        'report-open', 'spam', null,
      ],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT id FROM link_reports ORDER BY id')
    expect(ids(left.rows)).toEqual(['report-cutoff', 'report-open', 'report-recent'])
  })
})
