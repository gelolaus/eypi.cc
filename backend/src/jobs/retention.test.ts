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

  it('deletes rum samples older than 30 days', async () => {
    const client = await memoryDb()
    await client.execute({
      sql: `INSERT INTO rum_samples (day, route, metric, value, rating, device) VALUES
            (?, '/', 'LCP', 1, 'good', 'mobile'),
            (?, '/', 'LCP', 2, 'good', 'mobile'),
            (?, '/', 'LCP', 3, 'good', 'mobile')`,
      args: ['2026-09-25', CSV_CUTOFF, '2026-10-26'],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT day FROM rum_samples ORDER BY day')
    expect(left.rows.map((row) => String(row.day))).toEqual([CSV_CUTOFF, '2026-10-26'])
  })

  it('deletes raw clicks older than 400 days only when their day is rolled up', async () => {
    const client = await memoryDb()
    await client.execute({
      sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      args: ['link-a', 'user-1', 'https://a.example', 'a', 'link-b', 'user-1', 'https://b.example', 'b'],
    })
    // 400 days before NOW is 2025-09-21T19:00:00Z, which is Manila day 2025-09-22.
    await client.execute({
      sql: `INSERT INTO analytics (link_id, os, country, referrer, created_at) VALUES
            ('link-a', 'x', 'PH', 'd', '2025-09-10 04:00:00'),
            ('link-a', 'x', 'PH', 'd', '2025-09-11 04:00:00'),
            ('link-b', 'x', 'PH', 'd', '2025-09-10 04:00:00'),
            ('link-a', 'x', 'PH', 'd', '2025-09-21 18:59:59'),
            ('link-a', 'x', 'PH', 'd', '2025-09-21 19:00:00'),
            ('link-a', 'x', 'PH', 'd', '2026-10-01 04:00:00')`,
      args: [],
    })
    await client.execute({
      sql: `INSERT INTO analytics_daily (link_id, day, clicks) VALUES
            ('link-a', '2025-09-10', 1), ('link-a', '2025-09-22', 2), ('link-a', '2026-10-01', 1)`,
      args: [],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT link_id, created_at FROM analytics ORDER BY id')
    expect(left.rows.map((r) => [String(r.link_id), String(r.created_at)])).toEqual([
      ['link-a', '2025-09-11 04:00:00'], // day 2025-09-11 has no rollup
      ['link-b', '2025-09-10 04:00:00'], // other link has no rollup
      ['link-a', '2025-09-21 19:00:00'], // exactly 400 days old stays
      ['link-a', '2026-10-01 04:00:00'],
    ])
  })

  it('deletes module events older than 400 days only when their day is rolled up', async () => {
    const client = await memoryDb()
    // 400 days before NOW (2026-10-26 19:00Z) is Manila day 2025-09-22. Older days are candidates.
    await client.execute({
      sql: `INSERT INTO module_events (module, subject_id, action, visitor_hash, day) VALUES
            ('frames', 'c1', 'view', 'v1', '2025-09-10'),
            ('frames', 'c1', 'view', 'v2', '2025-09-10'),
            ('frames', 'c1', 'download', 'v1', '2025-09-10'),
            ('frames', 'c2', 'view', 'v1', '2025-09-10'),
            ('frames', 'c1', 'view', 'v1', '2025-09-11'),
            ('org', 'o1', 'view', 'v1', '2025-09-22'),
            ('org', 'o1', 'view', 'v1', '2026-10-01')`,
      args: [],
    })
    await client.execute({
      sql: `INSERT INTO module_daily (subject_id, module, action, day, n, uniques) VALUES
            ('c1', 'frames', 'view', '2025-09-10', 2, 2),
            ('o1', 'org', 'view', '2025-09-22', 1, 1),
            ('o1', 'org', 'view', '2026-10-01', 1, 1)`,
      args: [],
    })

    await runRetention(client as unknown as WebClient, NOW)

    const left = await client.execute('SELECT subject_id, action, day FROM module_events ORDER BY id')
    expect(left.rows.map((r) => [String(r.subject_id), String(r.action), String(r.day)])).toEqual([
      ['c1', 'download', '2025-09-10'], // no rollup for this action
      ['c2', 'view', '2025-09-10'], // no rollup for this subject
      ['c1', 'view', '2025-09-11'], // no rollup for this day
      ['o1', 'view', '2025-09-22'], // exactly 400 days old stays
      ['o1', 'view', '2026-10-01'],
    ])
  })
})
