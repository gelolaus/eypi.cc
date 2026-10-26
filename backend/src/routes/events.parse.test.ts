import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
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

describe('event spreadsheet upload', () => {
  it('5,001 rows returns 422 too_many_rows', async () => {
    const { client, request } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedLead(db)
        await db.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked)
                VALUES ('event-1', 'sheet-night', ?, 'Sheet Night', '2026-11-01', '09:00', 'Hall', 'org-1', 0)`,
          args: [lead.id],
        })
        await db.execute({
          sql: `INSERT INTO event_csv_rows (id, event_id, row_index, raw_data, is_selected)
                VALUES ('row-kept', 'event-1', 0, ?, 0)`,
          args: [JSON.stringify({ email: 'kept@x.com' })],
        })
      },
    })

    const rows = Array.from({ length: 5001 }, (_, index) => ({ email: `person${index}@x.com` }))
    const res = await request('/api/events/sheet-night/upload-csv', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rows,
        columnMapping: {
          emailCol: 'email',
          firstNameCol: 'first',
          lastNameCol: 'last',
          fullNameCol: null,
          clusterCol: null,
          criteriaColumns: [],
        },
      }),
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'too_many_rows' } })

    const kept = await client.execute({
      sql: 'SELECT id FROM event_csv_rows WHERE event_id = ?',
      args: ['event-1'],
    })
    expect(kept.rows.map((row) => row.id)).toEqual(['row-kept'])
  })

  it('rejects a missing firstName', async () => {
    const { client, request } = await createTestApp({ user: lead, seed: seedLead })

    const res = await request('/api/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Door Night',
        slug: 'doornight',
        date: '2026-11-01',
        time: '09:00',
        location: 'Hall',
        attendees: [{ lastName: 'Santos', email: 'ana@x.com' }],
      }),
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'missing_first_name' } })

    const events = await client.execute({
      sql: 'SELECT id FROM events WHERE slug = ?',
      args: ['doornight'],
    })
    expect(events.rows).toHaveLength(0)
  })

  it('does not append csv rows after the event is finalized', async () => {
    const { client, request } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedLead(db)
        await db.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked)
                VALUES ('event-1', 'sheet-night', ?, 'Sheet Night', '2026-11-01', '09:00', 'Hall', 'org-1', 1)`,
          args: [lead.id],
        })
        await db.execute({
          sql: `INSERT INTO event_csv_rows (id, event_id, row_index, raw_data, is_selected)
                VALUES ('row-kept', 'event-1', 0, ?, 1)`,
          args: [JSON.stringify({ email: 'kept@x.com' })],
        })
      },
    })

    const res = await request('/api/events/sheet-night/upload-csv', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rows: [{ email: 'new@x.com' }],
        columnMapping: {
          emailCol: 'email',
          firstNameCol: null,
          lastNameCol: null,
          fullNameCol: null,
          clusterCol: null,
          criteriaColumns: [],
        },
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'already_finalized' } })
    const kept = await client.execute({
      sql: 'SELECT id FROM event_csv_rows WHERE event_id = ? ORDER BY row_index',
      args: ['event-1'],
    })
    expect(kept.rows.map((row) => row.id)).toEqual(['row-kept'])
  })
})
