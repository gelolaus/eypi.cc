import { describe, expect, it } from 'vitest'
import type { Client, InArgs, InStatement } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const lead: TestUser = {
  id: 'user-lead',
  email: 'lead@student.apc.edu.ph',
  name: 'Lead',
  role: 'user',
}

const officer: TestUser = {
  id: 'user-officer',
  email: 'officer@student.apc.edu.ph',
  name: 'Officer',
  role: 'user',
}

const headers = {
  'Content-Type': 'application/json',
  'X-Active-Org-Id': 'org-1',
  Origin: 'https://eypi.cc',
}

async function seedOrg(client: Client, member?: TestUser) {
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
  if (!member) return
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: [member.id, member.email, member.name],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', member.email, member.id, '2026-01-01T00:00:00Z'],
  })
}

async function seedDoor(client: Client, member?: TestUser) {
  await seedOrg(client, member)
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked)
          VALUES ('event-1', 'door', ?, 'Door Night', '2026-11-01', '09:00', 'Hall', 'org-1', 1)`,
    args: [lead.id],
  })
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token)
          VALUES ('att-1', 'event-1', 'Ana', 'Santos', 'ana@x.com', 'qr-ana')`,
  })
}

function post(path: string, body: object): RequestInit {
  return { method: 'POST', headers, body: JSON.stringify(body) }
}

function isLatestActionRead(sql: string): boolean {
  const text = sql.replace(/\s+/g, ' ').trim()
  return /^SELECT action FROM check_ins/i.test(text) && /ORDER BY actioned_at DESC/i.test(text)
}

describe('check-in actions', () => {
  it('two parallel check-ins yield one 200 and one 409 already_checked_in', async () => {
    const { client, request } = await createTestApp({
      user: lead,
      seed: (db) => seedDoor(db),
    })

    const originalExecute = client.execute.bind(client)
    let observed = 0
    let releaseObserved: () => void = () => {}
    const bothObserved = new Promise<void>((resolve) => {
      releaseObserved = resolve
    })
    client.execute = (async (stmt: InStatement, args?: InArgs) => {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql
      const result = typeof stmt === 'string' ? await originalExecute(stmt, args) : await originalExecute(stmt)
      if (isLatestActionRead(sql)) {
        observed += 1
        if (observed >= 2) releaseObserved()
        else await bothObserved
      }
      return result
    }) as Client['execute']

    const [first, second] = await Promise.all([
      request('/api/events/door/checkin', post('/api/events/door/checkin', { qrToken: 'qr-ana' })),
      request('/api/events/door/checkin', post('/api/events/door/checkin', { qrToken: 'qr-ana' })),
    ])

    const statuses = [first.status, second.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 409])

    const loser = first.status === 409 ? first : second
    expect(await loser.json()).toMatchObject({
      error: { code: 'already_checked_in' },
    })

    const rows = await client.execute({
      sql: "SELECT action FROM check_ins WHERE attendee_id = 'att-1'",
    })
    expect(rows.rows.map((row) => row.action)).toEqual(['checked_in'])
  })

  it('checkout of a removed attendee is 409', async () => {
    const { client, request } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedDoor(db)
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
                VALUES ('ci-removed', 'att-1', 'event-1', 'removed', '2026-10-26 01:00:00')`,
        })
      },
    })

    const res = await request('/api/events/door/checkout', post('/api/events/door/checkout', { attendeeId: 'att-1' }))
    expect(res.status).toBe(409)

    const rows = await client.execute({
      sql: "SELECT action FROM check_ins WHERE attendee_id = 'att-1' ORDER BY rowid",
    })
    expect(rows.rows.map((row) => row.action)).toEqual(['removed'])
  })

  it('restore returns a cancelled attendee to not_checked_in (legacy removed row ignored)', async () => {
    const { request, client } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedDoor(db)
        await db.execute("UPDATE attendees SET status = 'cancelled', decided_by = 'user-lead' WHERE id = 'att-1'")
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
                VALUES ('ci-removed', 'att-1', 'event-1', 'removed', '2026-10-26 01:00:00')`,
        })
      },
    })

    const restored = await request('/api/events/door/restore', post('/api/events/door/restore', { attendeeId: 'att-1' }))
    expect(restored.status).toBe(200)

    const listed = await request('/api/events/door/attendees', { headers })
    const body = await listed.json() as { attendees: { id: string; status: string | null }[] }
    expect(body.attendees.find((row) => row.id === 'att-1')?.status).toBe('not_checked_in')
    const written = await client.execute('SELECT action FROM check_ins')
    expect(written.rows.map((row) => row.action)).toEqual(['removed'])
  })

  it('remove cancels the attendee without writing a check_ins row and lists as removed', async () => {
    const { request, client } = await createTestApp({ user: lead, seed: (db) => seedDoor(db) })
    const res = await request('/api/events/door/remove', post('/api/events/door/remove', { attendeeId: 'att-1' }))
    expect(res.status).toBe(200)
    expect((await client.execute('SELECT * FROM check_ins')).rows).toHaveLength(0)
    const listed = await request('/api/events/door/attendees', { headers })
    const body = await listed.json() as { attendees: { id: string; status: string | null }[] }
    expect(body.attendees[0]?.status).toBe('removed')
    const scan = await request('/api/events/door/checkin', post('/api/events/door/checkin', { qrToken: 'qr-ana' }))
    expect(scan.status).toBe(403)
  })

  it('lets an org member who is not the lead add a guest', async () => {
    const { request } = await createTestApp({
      user: officer,
      seed: (db) => seedDoor(db, officer),
    })

    const res = await request('/api/events/door/add-guest', post('/api/events/door/add-guest', {
      firstName: 'Bea',
      lastName: 'Cruz',
      email: 'bea@x.com',
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { attendee?: { email?: string } }
    expect(body.attendee?.email).toBe('bea@x.com')
  })

  it('uses the higher rowid when two actions share actioned_at', async () => {
    const { request } = await createTestApp({
      user: lead,
      seed: async (db) => {
        await seedDoor(db)
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
                VALUES ('ci-in', 'att-1', 'event-1', 'checked_in', '2026-10-26 01:00:00')`,
        })
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
                VALUES ('ci-out', 'att-1', 'event-1', 'checked_out', '2026-10-26 01:00:00')`,
        })
      },
    })

    const listed = await request('/api/events/door/attendees', { headers })
    const body = await listed.json() as { attendees: { status: string | null }[] }
    expect(body.attendees[0]?.status).toBe('checked_out')

    const checkout = await request('/api/events/door/checkout', post('/api/events/door/checkout', { attendeeId: 'att-1' }))
    expect(checkout.status).toBe(409)
  })
})
