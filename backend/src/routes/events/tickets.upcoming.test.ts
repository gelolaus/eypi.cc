import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'

const student: TestUser = { id: 'stu-1', email: 'stu1@student.apc.edu.ph', name: 'Sam Student', role: 'user' }
const other: TestUser = { id: 'stu-2', email: 'stu2@student.apc.edu.ph', name: 'Other', role: 'user' }

async function seedUsers(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    args: [student.id, student.email, student.name, student.role, other.id, other.email, other.name, other.role],
  })
}

async function seedEvent(client: Client, o: { slug?: string; date?: string; mode?: string } = {}) {
  const slug = o.slug ?? 'ev'
  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, email, name) VALUES ('owner', 'owner@apc.edu.ph', 'Owner')",
    args: [],
  })
  await client.execute({
    sql: "INSERT OR IGNORE INTO organizations (id, name, owner_id) VALUES ('org-1', 'Alpha', 'owner')",
    args: [],
  })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id,
            selection_locked, status, admission_mode, max_attendees, waitlist_enabled, questions)
          VALUES (?, ?, 'owner', ?, ?, '09:00', 'Hall', 'org-1', 1, 'published', ?, 100, 0, '[]')`,
    args: [`id-${slug}`, slug, `Event ${slug}`, o.date ?? '2099-01-01', o.mode ?? 'fcfs'],
  })
}

async function insertAttendee(
  client: Client,
  o: { id: string; slug: string; userId: string; status: string },
) {
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token, user_id, status, source, registered_at)
          VALUES (?, ?, 'S', ?, ?, ?, ?, 'self', CURRENT_TIMESTAMP)`,
    args: [o.id, `id-${o.slug}`, `${o.id}@x.test`, `qr-${o.id}`, o.userId, o.status],
  })
}

describe('GET /api/tickets/upcoming', () => {
  it('returns 401 when unauthenticated', async () => {
    const { request } = await createTestApp()
    expect((await request('/api/tickets/upcoming')).status).toBe(401)
  })

  it('returns only the signed-in user tickets, capped at 3, soonest first', async () => {
    const { request } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedUsers(c)
        await seedEvent(c, { slug: 'a', date: '2099-03-01' })
        await seedEvent(c, { slug: 'b', date: '2099-01-01' })
        await seedEvent(c, { slug: 'c', date: '2099-02-01' })
        await seedEvent(c, { slug: 'd', date: '2099-04-01' })
        await seedEvent(c, { slug: 'other', date: '2099-01-15' })
        await insertAttendee(c, { id: 't-a', slug: 'a', userId: student.id, status: 'confirmed' })
        await insertAttendee(c, { id: 't-b', slug: 'b', userId: student.id, status: 'pending' })
        await insertAttendee(c, { id: 't-c', slug: 'c', userId: student.id, status: 'entered' })
        await insertAttendee(c, { id: 't-d', slug: 'd', userId: student.id, status: 'waitlisted' })
        await insertAttendee(c, { id: 't-o', slug: 'other', userId: other.id, status: 'confirmed' })
      },
    })

    const res = await request('/api/tickets/upcoming')
    expect(res.status).toBe(200)
    const { tickets } = await res.json() as { tickets: { id: string; event: { slug: string } }[] }
    expect(tickets.map((t) => t.event.slug)).toEqual(['b', 'c', 'a'])
    expect(tickets).toHaveLength(3)
  })

  it('excludes past events and cancelled or declined rows', async () => {
    const { request } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedUsers(c)
        await seedEvent(c, { slug: 'past', date: '2001-01-01' })
        await seedEvent(c, { slug: 'ok', date: '2099-06-01' })
        await seedEvent(c, { slug: 'cx', date: '2099-07-01' })
        await seedEvent(c, { slug: 'dc', date: '2099-08-01' })
        await insertAttendee(c, { id: 't-past', slug: 'past', userId: student.id, status: 'confirmed' })
        await insertAttendee(c, { id: 't-ok', slug: 'ok', userId: student.id, status: 'confirmed' })
        await insertAttendee(c, { id: 't-cx', slug: 'cx', userId: student.id, status: 'cancelled' })
        await insertAttendee(c, { id: 't-dc', slug: 'dc', userId: student.id, status: 'declined' })
      },
    })

    const { tickets } = await (await request('/api/tickets/upcoming')).json() as {
      tickets: { event: { slug: string } }[]
    }
    expect(tickets.map((t) => t.event.slug)).toEqual(['ok'])
  })

  it('does not update tickets_seen_at or ticketUpdates after two calls', async () => {
    const { request, client } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedUsers(c)
        await seedEvent(c, { slug: 'soon', date: '2099-01-01', mode: 'approval' })
        await c.execute({
          sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token, user_id, status, source, registered_at, decided_at)
                VALUES ('t1', 'id-soon', 'S', ?, 'qr-1', ?, 'confirmed', 'self', CURRENT_TIMESTAMP, strftime('%Y-%m-%d %H:%M:%f','now'))`,
          args: [student.email, student.id],
        })
      },
    })

    const beforeSeen = await client.execute({
      sql: 'SELECT tickets_seen_at FROM users WHERE id = ?',
      args: [student.id],
    })
    const beforeUpdates = ((await (await request('/api/me')).json()) as { ticketUpdates: number }).ticketUpdates

    expect((await request('/api/tickets/upcoming')).status).toBe(200)
    expect((await request('/api/tickets/upcoming')).status).toBe(200)

    const afterSeen = await client.execute({
      sql: 'SELECT tickets_seen_at FROM users WHERE id = ?',
      args: [student.id],
    })
    const afterUpdates = ((await (await request('/api/me')).json()) as { ticketUpdates: number }).ticketUpdates

    expect(afterSeen.rows[0].tickets_seen_at).toBe(beforeSeen.rows[0].tickets_seen_at)
    expect(afterUpdates).toBe(beforeUpdates)
  })
})
