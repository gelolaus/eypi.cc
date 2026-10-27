import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp, type TestUser } from '../test/createTestApp'

const owner: TestUser = { id: 'owner-1', email: 'owner@apc.edu.ph', name: 'Omar', role: 'user' }
const stranger: TestUser = { id: 'stranger-1', email: 's@student.apc.edu.ph', name: 'Sam', role: 'user' }

async function seed(client: Client) {
  const run = (sql: string, args: (string | number | null)[] = []) => client.execute({ sql, args })
  for (const u of [owner, stranger]) {
    await run('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)', [u.id, u.email, u.name, u.role])
  }
  await run('INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', ['org1', 'One', owner.id])
  await run('INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', ['org2', 'Two', owner.id])
  await run('INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', ['org1', owner.email, owner.id])
  await run('INSERT INTO org_members (org_id, email) VALUES (?, ?)', ['org1', 'pending@student.apc.edu.ph'])
  await run('INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['e1', 'e-one', owner.id, 'E', '2026-01-01', '09:00', 'Hall', 'org1'])
  await run('INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['e2', 'e-two', owner.id, 'E2', '2026-01-01', '09:00', 'Hall', 'org2'])
  await run('INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)', ['t1', 'e1', 'X', 'x@example.com', 'q1'])
  await run('INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)', ['t2', 'e2', 'Y', 'y@example.com', 'q2'])
  await run('INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, org_id) VALUES (?, ?, ?, ?, ?)', ['d1', owner.id, 'D', '/x.png', 'org1'])
}

describe('GET /api/orgs/:org_id/summary', () => {
  it('counts only this org: activated members, events, tickets, frames', async () => {
    const { request } = await createTestApp({ user: owner, seed })
    const res = await request('/api/orgs/org1/summary')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ members: 1, events: 1, tickets: 1, frames: 1 })
  })

  it('refuses a user who is not a member', async () => {
    const { request } = await createTestApp({ user: stranger, seed })
    const res = await request('/api/orgs/org1/summary')
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown org', async () => {
    const { request } = await createTestApp({ user: owner, seed })
    expect((await request('/api/orgs/nope/summary')).status).toBe(404)
  })
})
