import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'

vi.mock('../../lib/passes/googleWallet', () => ({
  buildGoogleWalletSaveUrl: vi.fn(async () => 'https://pay.google.com/gp/v/save/jwt'),
}))

const student: TestUser = { id: 'stu-1', email: 'stu1@student.apc.edu.ph', name: 'Sam', role: 'user' }
const json = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc' }

async function seed(c: Client) {
  await c.execute("INSERT INTO users (id, email, name) VALUES ('owner', 'owner@apc.edu.ph', 'Owner')")
  await c.execute({ sql: 'INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)', args: [student.id, student.email, student.name] })
  await c.execute("INSERT INTO users (id, email, name) VALUES ('other', 'other@apc.edu.ph', 'Other')")
  await c.execute("INSERT INTO organizations (id, name, owner_id) VALUES ('org-1', 'Alpha', 'owner')")
  await c.execute(`INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status, admission_mode)
    VALUES ('id-ev', 'ev', 'owner', 'Fest', '2099-01-01', '09:00', 'Hall', 'org-1', 1, 'published', 'fcfs')`)
  await c.execute(`INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status, admission_mode)
    VALUES ('id-ev2', 'ev2', 'owner', 'Fest 2', '2099-01-02', '09:00', 'Hall', 'org-1', 1, 'published', 'fcfs')`)
  const att = (id: string, user: string, status: string, event = 'id-ev') => c.execute({
    sql: 'INSERT INTO attendees (id, event_id, user_id, first_name, last_name, email, qr_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, event, user, 'A', 'B', `${id}@x.com`, `qr-${id}`, status],
  })
  await att('mine', 'stu-1', 'confirmed')
  await att('theirs', 'other', 'confirmed')
  await att('gone', 'stu-1', 'cancelled', 'id-ev2')
}

const post = (request: (p: string, i?: RequestInit) => Promise<Response>, id: string) =>
  request(`/api/tickets/${id}/pass`, { method: 'POST', headers: json })

describe('POST /api/tickets/:id/pass', () => {
  it('returns a wallet url for the signed-in student\'s confirmed ticket, uncached', async () => {
    const { request } = await createTestApp({ user: student, seed })
    const res = await post(request, 'mine')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://pay.google.com/gp/v/save/jwt' })
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it("404s for someone else's ticket", async () => {
    const { request } = await createTestApp({ user: student, seed })
    expect((await post(request, 'theirs')).status).toBe(404)
  })

  it('404s for a cancelled ticket and an unknown id', async () => {
    const { request } = await createTestApp({ user: student, seed })
    expect((await post(request, 'gone')).status).toBe(404)
    expect((await post(request, 'nope')).status).toBe(404)
  })

  it('401s when signed out', async () => {
    const { request } = await createTestApp({ seed })
    expect((await post(request, 'mine')).status).toBe(401)
  })
})
