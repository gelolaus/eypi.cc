import { describe, expect, it } from 'vitest'
import type { Client, InArgs, InStatement } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const lead: TestUser = {
  id: 'user-lead',
  email: 'lead@student.apc.edu.ph',
  name: 'Lead',
  role: 'user',
}

const headers = {
  'Content-Type': 'application/json',
  'X-Active-Org-Id': 'org-1',
  Origin: 'https://eypi.cc',
}

type CsvSeed = { id: string; email: string; first: string; last: string }

async function seedLead(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: [lead.id, lead.email, lead.name],
  })
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
    args: ['org-1', 'Alpha', lead.id],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', lead.email, lead.id, '2026-01-01T00:00:00Z'],
  })
}

async function seedOpenEvent(client: Client, event: { id: string; slug: string; name: string }, rows: CsvSeed[]) {
  await seedLead(client)
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked)
          VALUES (?, ?, ?, ?, '2026-11-01', '09:00', 'Hall', 'org-1', 0)`,
    args: [event.id, event.slug, lead.id, event.name],
  })
  await client.execute({
    sql: `INSERT INTO event_column_mappings (id, event_id, first_name_col, last_name_col, email_col)
          VALUES (?, ?, 'first', 'last', 'email')`,
    args: [`map-${event.id}`, event.id],
  })
  if (rows.length === 0) return
  await client.batch(rows.map((row, index) => ({
    sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES (?, ?, ?, ?)',
    args: [row.id, event.id, index, JSON.stringify({ email: row.email, first: row.first, last: row.last })],
  })))
}

function finalizeInit(rowIds: string[]): RequestInit {
  return {
    method: 'POST',
    headers,
    body: JSON.stringify({
      selectedRows: rowIds.map((rowId) => ({ rowId, clusterValue: null })),
      maxAttendees: rowIds.length,
      columnMapping: {
        emailCol: 'email',
        firstNameCol: 'first',
        lastNameCol: 'last',
        fullNameCol: null,
      },
    }),
  }
}

async function attendeeCount(client: Client, eventId: string): Promise<number> {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM attendees WHERE event_id = ?',
    args: [eventId],
  })
  return Number(result.rows[0]?.cnt ?? 0)
}

async function selectionLocked(client: Client, eventId: string): Promise<number> {
  const result = await client.execute({
    sql: 'SELECT selection_locked FROM events WHERE id = ?',
    args: [eventId],
  })
  return Number(result.rows[0]?.selection_locked ?? -1)
}

describe('finalize', () => {
  it('concurrent finalize accepts one request and returns already_finalized for the other', async () => {
    const eventId = 'event-race'
    const { client, request } = await createTestApp({
      user: lead,
      seed: (db) => seedOpenEvent(db, { id: eventId, slug: 'race-night', name: 'Race Night' }, [
        { id: 'row-1', email: 'one@x.com', first: 'One', last: 'A' },
        { id: 'row-2', email: 'two@x.com', first: 'Two', last: 'B' },
      ]),
    })

    // Both requests must observe selection_locked=0 before either writes the lock.
    const originalExecute = client.execute.bind(client)
    let leadReads = 0
    let releaseLeadReads: () => void = () => {}
    const bothLeadReads = new Promise<void>((resolve) => {
      releaseLeadReads = resolve
    })
    client.execute = (async (stmt: InStatement, args?: InArgs) => {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql
      if (sql.startsWith('SELECT id, org_id, selection_locked')) {
        leadReads += 1
        if (leadReads >= 2) releaseLeadReads()
        else await bothLeadReads
      }
      return typeof stmt === 'string' ? originalExecute(stmt, args) : originalExecute(stmt)
    }) as Client['execute']

    const [first, second] = await Promise.all([
      request('/api/events/race-night/finalize', finalizeInit(['row-1', 'row-2'])),
      request('/api/events/race-night/finalize', finalizeInit(['row-1', 'row-2'])),
    ])

    const statuses = [first.status, second.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 409])

    const loser = first.status === 409 ? first : second
    expect(await loser.json()).toMatchObject({
      error: { code: 'already_finalized' },
    })
    expect(await attendeeCount(client, eventId)).toBe(2)
    expect(await selectionLocked(client, eventId)).toBe(1)
  })

  it('a failure mid-batch leaves the event unlocked with zero attendees', async () => {
    const eventId = 'event-fail'
    const { client, request } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedOpenEvent(db, { id: eventId, slug: 'fail-night', name: 'Fail Night' }, [
          { id: 'row-1', email: 'one@x.com', first: 'One', last: 'A' },
          { id: 'row-2', email: 'two@x.com', first: 'Two', last: 'B' },
        ])
        await db.execute(`
          CREATE TRIGGER fail_finalize_mark_selected
          BEFORE UPDATE OF is_selected ON event_csv_rows
          WHEN NEW.is_selected = 1
          BEGIN
            SELECT RAISE(ABORT, 'mid-batch failure');
          END
        `)
      },
    })

    const res = await request('/api/events/fail-night/finalize', finalizeInit(['row-1', 'row-2']))

    expect(res.status).not.toBe(200)
    expect(await selectionLocked(client, eventId)).toBe(0)
    expect(await attendeeCount(client, eventId)).toBe(0)
  })

  it('a duplicate email in the selection becomes one attendee', async () => {
    const eventId = 'event-dup'
    const { client, request } = await createTestApp({
      user: lead,
      seed: (db) => seedOpenEvent(db, { id: eventId, slug: 'dup-night', name: 'Dup Night' }, [
        { id: 'row-ada', email: 'Ada@X.com', first: 'Ada', last: 'Lovelace' },
        { id: 'row-ada-2', email: 'ada@x.com', first: 'Ada', last: 'Again' },
      ]),
    })

    const res = await request('/api/events/dup-night/finalize', finalizeInit(['row-ada', 'row-ada-2']))
    expect(res.status).toBe(200)
    const body = await res.json() as { attendees: { email: string }[] }
    expect(body.attendees.map((attendee) => attendee.email)).toEqual(['ada@x.com'])
    expect(await attendeeCount(client, eventId)).toBe(1)

    await expect(client.execute({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['att-dup', eventId, 'Other', 'Person', 'ADA@x.com', 'qr-dup'],
    })).rejects.toThrow()

    const columns = (await client.execute('PRAGMA table_info(attendees)')).rows.map((row) => String(row.name))
    expect(columns).toContain('csv_row_id')
    const stored = await client.execute({
      sql: 'SELECT csv_row_id FROM attendees WHERE event_id = ?',
      args: [eventId],
    })
    expect(String(stored.rows[0]?.csv_row_id)).toBe('row-ada')
    const stamped = await client.execute({ sql: 'SELECT registered_at FROM attendees WHERE event_id = ?', args: [eventId] })
    expect(stamped.rows[0]?.registered_at).not.toBeNull()
  })
})

describe('tix migration', () => {
  it('adds csv_row_id and a pass field allowlist defaulting to an empty list', async () => {
    const { client } = await createTestApp()
    const attendees = await client.execute('PRAGMA table_info(attendees)')
    const events = await client.execute('PRAGMA table_info(events)')
    expect(attendees.rows.map((row) => String(row.name))).toContain('csv_row_id')
    const passFields = events.rows.find((row) => String(row.name) === 'pass_fields')
    expect(String(passFields?.dflt_value ?? '')).toContain('[]')
  })
})
