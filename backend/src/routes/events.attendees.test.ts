import { describe, expect, it } from 'vitest'
import type { Client, InStatement } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const lead: TestUser = { id: 'user-lead', email: 'lead@student.apc.edu.ph', name: 'Lead', role: 'user' }
const headers = { 'Content-Type': 'application/json', 'X-Active-Org-Id': 'org-1', Origin: 'https://eypi.cc' }

async function seed(client: Client) {
  await client.execute({ sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)', args: [lead.id, lead.email, lead.name] })
  await client.execute({ sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', args: ['org-1', 'Alpha', lead.id] })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', lead.email, lead.id, '2026-01-01T00:00:00Z'],
  })
  for (const [id, slug] of [['event-1', 'one'], ['event-2', 'two']]) {
    await client.execute({
      sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked)
            VALUES (?, ?, ?, 'E', '2026-11-01', '09:00', 'Hall', 'org-1', 1)`,
      args: [id, slug, lead.id],
    })
  }
  const rows: [string, string, string][] = [['a1', 'event-1', 'Ana'], ['a2', 'event-1', 'Ben'], ['b1', 'event-2', 'Cy']]
  for (const [id, eventId, name] of rows) {
    await client.execute({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, eventId, name, 'X', `${id}@x.com`, `qr-${id}`],
    })
  }
  const actions: [string, string, string, string, string][] = [
    ['c1', 'a1', 'event-1', 'checked_in', '2026-10-26 01:00:00'],
    ['c2', 'a1', 'event-1', 'checked_out', '2026-10-26 02:00:00'],
    ['c3', 'b1', 'event-2', 'checked_in', '2026-10-26 01:00:00'],
  ]
  for (const [id, att, ev, action, at] of actions) {
    await client.execute({
      sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, att, ev, action, at],
    })
  }
}

describe('GET /api/events/:slug/attendees', () => {
  it('returns only the event rows with each latest status', async () => {
    const { request } = await createTestApp({ user: lead, seed })
    const res = await request('/api/events/one/attendees', { headers })
    const body = await res.json() as { attendees: { id: string; status: string | null }[] }
    expect(res.status).toBe(200)
    expect(body.attendees.map((row) => [row.id, row.status])).toEqual([['a1', 'checked_out'], ['a2', null]])
  })

  it('scopes the check_ins subquery by event_id with an index', async () => {
    const { client, request } = await createTestApp({ user: lead, seed })
    let sql = ''
    let args: unknown[] = []
    const original = client.execute.bind(client) as (stmt: InStatement) => ReturnType<Client['execute']>
    ;(client as { execute: unknown }).execute = (stmt: InStatement) => {
      if (typeof stmt !== 'string' && /ROW_NUMBER/.test(stmt.sql)) {
        sql = stmt.sql
        args = stmt.args as unknown[]
      }
      return original(stmt)
    }
    await request('/api/events/one/attendees', { headers })
    expect(sql).toMatch(/FROM check_ins\s+WHERE event_id = \?/)
    const plan = await original({ sql: `EXPLAIN QUERY PLAN ${sql}`, args: args as never })
    const details = plan.rows.map((row) => String(row.detail)).join('\n')
    expect(details).toMatch(/check_ins USING (COVERING )?INDEX \w+\s*\(event_id=\?\)/)
  })
})
