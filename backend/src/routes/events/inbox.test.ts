import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'

const member: TestUser = { id: 'mem-1', email: 'mem@student.apc.edu.ph', name: 'Mem', role: 'user' }
const json = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc', 'X-Active-Org-Id': 'org-1' }

type Req = (p: string, i?: RequestInit) => Promise<Response>

async function seed(client: Client) {
  for (const [id, email] of [['mem-1', member.email], ['owner', 'owner@apc.edu.ph']]) {
    await client.execute({ sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)', args: [id, email, id] })
  }
  for (const org of ['org-1', 'org-2']) {
    await client.execute({ sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', args: [org, org, 'owner'] })
  }
  await client.execute({
    sql: "INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-1', ?, 'mem-1', CURRENT_TIMESTAMP)",
    args: [member.email],
  })
}

async function seedEvent(client: Client, slug: string, o: { org?: string; max?: number | null; mode?: string } = {}) {
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked,
            status, admission_mode, max_attendees, waitlist_enabled)
          VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, 'published', ?, ?, 1)`,
    args: [`id-${slug}`, slug, o.org ?? 'org-1', o.mode ?? 'approval', o.max === undefined ? 2 : o.max],
  })
}

async function att(client: Client, id: string, slug: string, status: string, o: { first?: string; email?: string; at?: string | null } = {}) {
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at)
          VALUES (?, ?, ?, 'Last', ?, ?, ?, ?)`,
    args: [id, `id-${slug}`, o.first ?? id, o.email ?? `${id}@x.test`, `qr-${id}`, status, o.at === undefined ? '2026-01-01 00:00:00.000' : o.at],
  })
}

const get = (request: Req, path: string) => request(path, { headers: json })
const bulk = (request: Req, slug: string, body: unknown) =>
  request(`/api/events/${slug}/attendees/bulk`, { method: 'POST', headers: json, body: JSON.stringify(body) })
const statusOf = async (client: Client, id: string) =>
  String((await client.execute({ sql: 'SELECT status FROM attendees WHERE id = ?', args: [id] })).rows[0].status)

type Page = { attendees: Record<string, unknown>[]; counts: Record<string, number>; nextCursor: string | null }

describe('attendees inbox list', () => {
  it('counts every status and hides secrets', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'a1', 'ev', 'pending'); await att(c, 'a2', 'ev', 'pending'); await att(c, 'a3', 'ev', 'confirmed') },
    })
    const body = await (await get(request, '/api/events/ev/attendees?status=pending')).json() as Page
    expect(body.counts).toEqual({ pending: 2, entered: 0, waitlisted: 0, confirmed: 1, declined: 0, cancelled: 0 })
    expect(body.attendees.map((a) => a.id)).toEqual(['a1', 'a2'])
    const text = JSON.stringify(body)
    expect(text).not.toContain('qr-a1')
    expect(text).not.toContain('guest_token_hash')
    expect(body.nextCursor).toBeNull()
  })

  it('searches name and email with LIKE wildcards escaped', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c); await seedEvent(c, 'ev')
        await att(c, 'a1', 'ev', 'pending', { first: 'Ann', email: 'ann_lee@x.test' })
        await att(c, 'a2', 'ev', 'pending', { first: 'Bob', email: 'annxlee@x.test' })
        await att(c, 'a3', 'ev', 'pending', { first: '100%', email: 'p@x.test' })
      },
    })
    const ids = async (q: string) => ((await (await get(request, `/api/events/ev/attendees?q=${encodeURIComponent(q)}`)).json()) as Page).attendees.map((a) => a.id)
    expect(await ids('ann_lee')).toEqual(['a1'])
    expect(await ids('%')).toEqual(['a3'])
    expect(await ids('BOB')).toEqual(['a2'])
    expect(await ids('\\')).toEqual([])
  })

  it('pages stably by (registered_at, id), including NULL registered_at', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c); await seedEvent(c, 'ev')
        await att(c, 'n0', 'ev', 'pending', { at: null })
        for (let i = 0; i < 29; i++) await att(c, `p${String(i).padStart(2, '0')}`, 'ev', 'pending', { at: '2026-01-01 00:00:00.000' })
      },
    })
    const first = await (await get(request, '/api/events/ev/attendees?status=pending')).json() as Page
    expect(first.attendees).toHaveLength(25)
    expect(first.nextCursor).toBeTruthy()
    const second = await (await get(request, `/api/events/ev/attendees?status=pending&cursor=${first.nextCursor}`)).json() as Page
    expect(second.attendees).toHaveLength(5)
    expect(second.nextCursor).toBeNull()
    const all = [...first.attendees, ...second.attendees].map((a) => a.id)
    expect(new Set(all).size).toBe(30)
    expect(all[0]).toBe('n0')
    expect((await get(request, '/api/events/ev/attendees?cursor=garbage')).status).toBe(400)
  })

  it('keeps the legacy unpaged shape without query params', async () => {
    const { request } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'a1', 'ev', 'confirmed') } })
    const body = await (await get(request, '/api/events/ev/attendees')).json() as Page
    expect(body.attendees[0]).toMatchObject({ id: 'a1', first_name: 'a1', qr_token: 'qr-a1', status: null, admission_status: 'confirmed' })
  })

  it('rejects other orgs', async () => {
    const { request } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'other', { org: 'org-2' }) } })
    expect((await get(request, '/api/events/other/attendees?status=pending')).status).toBe(403)
    expect((await bulk(request, 'other', { ids: ['x'], action: 'approve' })).status).toBe(403)
  })
})

describe('bulk decisions', () => {
  it('approves within capacity and skips the excess as event_full', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'ev', { max: 2 }); await att(c, 'c0', 'ev', 'confirmed'); for (const i of [1, 2, 3]) await att(c, `p${i}`, 'ev', 'pending') },
    })
    const body = await (await bulk(request, 'ev', { ids: ['p1', 'p2', 'p3'], action: 'approve' })).json() as { updated: number; skipped: { id: string; reason: string }[] }
    expect(body.updated).toBe(1)
    expect(body.skipped).toEqual([{ id: 'p2', reason: 'event_full' }, { id: 'p3', reason: 'event_full' }])
    expect(await statusOf(client, 'p1')).toBe('confirmed')
    expect(await statusOf(client, 'p2')).toBe('pending')
    const row = (await client.execute("SELECT decided_by, decided_at FROM attendees WHERE id = 'p1'")).rows[0]
    expect(row.decided_by).toBe('mem-1')
    expect(row.decided_at).toBeTruthy()
  })

  it('does not oversell under concurrent approvals', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'ev', { max: 1 }); for (const i of [1, 2, 3, 4]) await att(c, `p${i}`, 'ev', 'pending') },
    })
    await get(request, '/api/me')
    await Promise.all([1, 2, 3, 4].map((i) => bulk(request, 'ev', { ids: [`p${i}`], action: 'approve' })))
    const n = await client.execute("SELECT COUNT(*) AS n FROM attendees WHERE status = 'confirmed'")
    expect(Number(n.rows[0].n)).toBe(1)
  })

  it('skips invalid transitions and foreign or unknown ids', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c); await seedEvent(c, 'ev'); await seedEvent(c, 'other', { org: 'org-2' })
        await att(c, 'd1', 'ev', 'declined'); await att(c, 'w1', 'ev', 'waitlisted'); await att(c, 'f1', 'other', 'pending'); await att(c, 'p1', 'ev', 'pending')
      },
    })
    const body = await (await bulk(request, 'ev', { ids: ['d1', 'w1', 'f1', 'nope', 'p1'], action: 'approve' })).json() as { updated: number; skipped: { id: string; reason: string }[] }
    expect(body.updated).toBe(1)
    expect(body.skipped).toEqual([
      { id: 'd1', reason: 'invalid_transition' },
      { id: 'w1', reason: 'invalid_transition' },
      { id: 'f1', reason: 'not_found' },
      { id: 'nope', reason: 'not_found' },
    ])
    expect(await statusOf(client, 'f1')).toBe('pending')
  })

  it('declines pending attendees', async () => {
    const { request, client } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'p1', 'ev', 'pending') } })
    expect(((await (await bulk(request, 'ev', { ids: ['p1'], action: 'decline' })).json()) as { updated: number }).updated).toBe(1)
    expect(await statusOf(client, 'p1')).toBe('declined')
  })

  it('promotes the waitlist when a confirmed attendee is cancelled', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c); await seedEvent(c, 'ev', { max: 1, mode: 'fcfs' })
        await att(c, 'c1', 'ev', 'confirmed'); await att(c, 'w1', 'ev', 'waitlisted', { at: '2026-01-02 00:00:00.000' })
      },
    })
    const body = await (await bulk(request, 'ev', { ids: ['c1'], action: 'cancel' })).json() as { updated: number }
    expect(body.updated).toBe(1)
    expect(await statusOf(client, 'c1')).toBe('cancelled')
    expect(await statusOf(client, 'w1')).toBe('confirmed')
  })

  it('writes one tix.bulk audit event without personal data', async () => {
    const { request, client } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'p1', 'ev', 'pending'); await att(c, 'p2', 'ev', 'pending') } })
    await bulk(request, 'ev', { ids: ['p1', 'p2'], action: 'decline' })
    const rows = (await client.execute("SELECT * FROM audit_events WHERE action = 'tix.bulk'")).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ actor_user_id: 'mem-1', target_type: 'event', target_id: 'id-ev' })
    const meta = JSON.parse(String(rows[0].meta))
    expect(meta).toMatchObject({ action: 'decline', updated: 2, skipped: 0 })
    expect(JSON.stringify(meta)).not.toContain('@')
  })

  it('validates the body', async () => {
    const { request } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev') } })
    expect((await bulk(request, 'ev', { ids: [], action: 'approve' })).status).toBe(400)
    expect((await bulk(request, 'ev', { ids: Array.from({ length: 201 }, (_, i) => `x${i}`), action: 'approve' })).status).toBe(400)
    expect((await bulk(request, 'ev', { ids: ['a'], action: 'delete' })).status).toBe(400)
  })

  it('skips an entered (lottery) attendee as invalid_transition', async () => {
    const { request, client } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev', { mode: 'lottery' }); await att(c, 'e1', 'ev', 'entered') } })
    const body = await (await bulk(request, 'ev', { ids: ['e1'], action: 'approve' })).json() as { updated: number; skipped: { id: string; reason: string }[] }
    expect(body).toMatchObject({ updated: 0, skipped: [{ id: 'e1', reason: 'invalid_transition' }] })
    expect(await statusOf(client, 'e1')).toBe('entered')
    expect((await client.execute("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'tix.bulk'")).rows[0].n).toBe(0)
  })

  it('still returns 200 when the audit write fails', async () => {
    const { request, client } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'p1', 'ev', 'pending') } })
    await client.execute('DROP TABLE audit_events')
    const res = await bulk(request, 'ev', { ids: ['p1'], action: 'decline' })
    expect(res.status).toBe(200)
    expect(await statusOf(client, 'p1')).toBe('declined')
  })
})

describe('inbox authorization', () => {
  const anon = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc', 'X-Active-Org-Id': 'org-1' }
  const outsider: TestUser = { id: 'out-1', email: 'out@student.apc.edu.ph', name: 'Out', role: 'user' }

  it('answers 401 when signed out', async () => {
    const { request } = await createTestApp({ seed: async (c) => { await seed(c); await seedEvent(c, 'ev') } })
    expect((await request('/api/events/ev/attendees?status=pending', { headers: anon })).status).toBe(401)
    expect((await request('/api/events/ev/attendees/bulk', { method: 'POST', headers: anon, body: JSON.stringify({ ids: ['a'], action: 'approve' }) })).status).toBe(401)
  })

  it('answers 403 for a signed-in user who is not in the org', async () => {
    const { request, client } = await createTestApp({ user: outsider, seed: async (c) => { await seed(c); await seedEvent(c, 'ev'); await att(c, 'p1', 'ev', 'pending') } })
    expect((await get(request, '/api/events/ev/attendees?status=pending')).status).toBe(403)
    expect((await bulk(request, 'ev', { ids: ['p1'], action: 'approve' })).status).toBe(403)
    expect(await statusOf(client, 'p1')).toBe('pending')
  })

  it('answers 403 for another org event and 404 for an unknown slug', async () => {
    const { request } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c, 'other', { org: 'org-2' }) } })
    expect((await get(request, '/api/events/other/attendees?status=pending')).status).toBe(403)
    expect((await bulk(request, 'other', { ids: ['x'], action: 'approve' })).status).toBe(403)
    expect((await get(request, '/api/events/missing/attendees?status=pending')).status).toBe(404)
    expect((await bulk(request, 'missing', { ids: ['x'], action: 'approve' })).status).toBe(404)
  })
})
