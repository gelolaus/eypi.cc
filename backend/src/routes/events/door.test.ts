import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'
import { doorTimestamp } from './shared'

const member: TestUser = { id: 'mem-1', email: 'mem@student.apc.edu.ph', name: 'Mem', role: 'user' }
const outsider: TestUser = { id: 'out-1', email: 'out@student.apc.edu.ph', name: 'Out', role: 'user' }
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
  for (const [slug, org] of [['door', 'org-1'], ['other', 'org-2']]) {
    await client.execute({
      sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status, admission_mode)
            VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, 'published', 'approval')`,
      args: [`id-${slug}`, slug, org],
    })
  }
  const rows: [string, string, string, string][] = [
    ['a1', 'door', 'Ana', 'confirmed'],
    ['a2', 'door', 'Bea', 'confirmed'],
    ['p1', 'door', 'Pat', 'pending'],
    ['c1', 'door', 'Cy', 'cancelled'],
    ['o1', 'other', 'Olly', 'confirmed'],
  ]
  for (const [id, slug, first, status] of rows) {
    await client.execute({
      sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at)
            VALUES (?, ?, ?, 'Last', ?, ?, ?, '2026-01-01 00:00:00.000')`,
      args: [id, `id-${slug}`, first, `${id}@x.test`, `qr-${id}`, status],
    })
  }
}

const sync = (request: Req, items: unknown, slug = 'door') =>
  request(`/api/events/${slug}/checkins/sync`, { method: 'POST', headers: json, body: JSON.stringify({ items }) })
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const now = () => new Date().toISOString()
type Results = { results: { id: string; ok: boolean; code?: string }[] }
const rowsFor = async (client: Client, attendeeId: string) =>
  (await client.execute({ sql: 'SELECT id, action FROM check_ins WHERE attendee_id = ? ORDER BY rowid', args: [attendeeId] })).rows

const setup = (user: TestUser | undefined = member) => createTestApp({ user, seed: seed })

describe('POST /checkins/sync', () => {
  it('replaying the same item id twice yields one row and ok both times', async () => {
    const { request, client } = await setup()
    const item = { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }
    const first = await (await sync(request, [item])).json() as Results
    const second = await (await sync(request, [item])).json() as Results
    expect(first.results).toEqual([{ id: uuid(1), ok: true }])
    expect(second.results).toEqual([{ id: uuid(1), ok: true }])
    expect(await rowsFor(client, 'a1')).toHaveLength(1)
  })

  it('replaying a checked_in id after a later checkout does not re-check-in', async () => {
    const { request, client } = await setup()
    await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() },
      { id: uuid(2), attendeeId: 'a1', action: 'checked_out', at: now() },
    ])
    const replay = await (await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }])).json() as Results
    expect(replay.results[0].ok).toBe(true)
    expect((await rowsFor(client, 'a1')).map((r) => r.action)).toEqual(['checked_in', 'checked_out'])
  })

  it('two devices same attendee: first ok, second already_checked_in and not inserted', async () => {
    const { request, client } = await setup()
    const body = await (await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() },
      { id: uuid(2), attendeeId: 'a1', action: 'checked_in', at: now() },
    ])).json() as Results
    expect(body.results).toEqual([{ id: uuid(1), ok: true }, { id: uuid(2), ok: false, code: 'already_checked_in' }])
    expect(await rowsFor(client, 'a1')).toHaveLength(1)
  })

  it('two concurrent syncs for the same attendee insert one row', async () => {
    const { request, client } = await setup()
    const [x, y] = await Promise.all([
      sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }]),
      sync(request, [{ id: uuid(2), attendeeId: 'a1', action: 'checked_in', at: now() }]),
    ])
    const codes = [...(await x.json() as Results).results, ...(await y.json() as Results).results].map((r) => r.code ?? 'ok').sort()
    expect(codes).toEqual(['already_checked_in', 'ok'])
    expect(await rowsFor(client, 'a1')).toHaveLength(1)
  })

  it('applies a batch in order: in, out, in works', async () => {
    const { request, client } = await setup()
    const t = Date.now()
    const body = await (await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: new Date(t - 3000).toISOString() },
      { id: uuid(2), attendeeId: 'a1', action: 'checked_out', at: new Date(t - 2000).toISOString() },
      { id: uuid(3), attendeeId: 'a1', action: 'checked_in', at: new Date(t - 1000).toISOString() },
    ])).json() as Results
    expect(body.results.every((r) => r.ok)).toBe(true)
    expect((await rowsFor(client, 'a1')).map((r) => r.action)).toEqual(['checked_in', 'checked_out', 'checked_in'])
  })

  it('reports not_checked_in, not_confirmed and unknown per item', async () => {
    const { request, client } = await setup()
    const body = await (await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_out', at: now() },
      { id: uuid(2), attendeeId: 'p1', action: 'checked_in', at: now() },
      { id: uuid(3), attendeeId: 'c1', action: 'checked_in', at: now() },
      { id: uuid(4), attendeeId: 'o1', action: 'checked_in', at: now() },
      { id: uuid(5), attendeeId: 'nope', action: 'checked_in', at: now() },
      { id: uuid(6), attendeeId: 'a2', action: 'checked_in', at: now() },
    ])).json() as Results
    expect(body.results.map((r) => r.code ?? 'ok')).toEqual(['not_checked_in', 'not_confirmed', 'not_confirmed', 'unknown', 'unknown', 'ok'])
    const all = await client.execute('SELECT attendee_id FROM check_ins')
    expect(all.rows.map((r) => r.attendee_id)).toEqual(['a2'])
  })

  it('keeps an offline row at the latest end of the timeline even with an older clock', async () => {
    const { request, client } = await setup()
    await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }])
    await sync(request, [{ id: uuid(2), attendeeId: 'a1', action: 'checked_out', at: new Date(Date.now() - 60_000).toISOString() }])
    const rows = await rowsFor(client, 'a1')
    expect(rows.map((r) => r.action)).toEqual(['checked_in', 'checked_out'])
    const live = await (await request('/api/events/door/live', { headers: json })).json() as { checkedIn: number }
    expect(live.checkedIn).toBe(0)
  })

  it('rejects malformed requests', async () => {
    const { request } = await setup()
    expect((await sync(request, 'x')).status).toBe(400)
    expect((await sync(request, [])).status).toBe(400)
    expect((await sync(request, Array.from({ length: 101 }, (_, i) => ({ id: uuid(i), attendeeId: 'a1', action: 'checked_in', at: now() })))).status).toBe(400)
    expect((await sync(request, [{ id: 'x'.repeat(200), attendeeId: 'a1', action: 'checked_in', at: now() }])).status).toBe(400)
    expect((await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'removed', at: now() }])).status).toBe(400)
  })

  it('syncs a full batch of 100 in one request', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        for (let i = 0; i < 100; i++) {
          await c.execute({
            sql: "INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status) VALUES (?, 'id-door', 'N', 'L', ?, ?, 'confirmed')",
            args: [`bulk-${i}`, `b${i}@x.test`, `qr-bulk-${i}`],
          })
        }
      },
    })
    const items = Array.from({ length: 100 }, (_, i) => ({ id: uuid(i + 10), attendeeId: `bulk-${i}`, action: 'checked_in', at: now() }))
    const body = await (await sync(request, items)).json() as Results
    expect(body.results).toHaveLength(100)
    expect(body.results.every((r) => r.ok)).toBe(true)
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM check_ins WHERE attendee_id LIKE 'bulk-%'")).rows[0].n)).toBe(100)
  })

  it('never writes the legacy removed action', async () => {
    const { request, client } = await setup()
    await request('/api/events/door/remove', { method: 'POST', headers: json, body: JSON.stringify({ attendeeId: 'a1' }) })
    await request('/api/events/door/restore', { method: 'POST', headers: json, body: JSON.stringify({ attendeeId: 'a1' }) })
    expect((await client.execute('SELECT * FROM check_ins')).rows).toHaveLength(0)
    expect(String((await client.execute("SELECT status FROM attendees WHERE id = 'a1'")).rows[0].status)).toBe('confirmed')
  })
})

describe('sync id collisions', () => {
  it('an existing client id used for another attendee is unknown, not a conflict', async () => {
    const { request, client } = await setup()
    await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }])
    const body = await (await sync(request, [{ id: uuid(1), attendeeId: 'a2', action: 'checked_in', at: now() }])).json() as Results
    expect(body.results).toEqual([{ id: uuid(1), ok: false, code: 'unknown' }])
    expect(await rowsFor(client, 'a2')).toHaveLength(0)
  })
})

describe('remove and restore', () => {
  const act = (request: Req, what: 'remove' | 'restore', attendeeId: string) =>
    request(`/api/events/door/${what}`, { method: 'POST', headers: json, body: JSON.stringify({ attendeeId }) })
  const row = async (client: Client, id: string) => (await client.execute({ sql: 'SELECT status, decided_by FROM attendees WHERE id = ?', args: [id] })).rows[0]
  const codeOf = async (res: Response) => ((await res.json()) as { error?: { code: string } }).error?.code

  it('remove sets decided_by, and promotes the waitlist when a confirmed seat frees up', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE events SET max_attendees = 2, waitlist_enabled = 1 WHERE id = 'id-door'")
    await client.execute("UPDATE attendees SET status = 'waitlisted', registered_at = '2026-01-02 00:00:00.000' WHERE id = 'p1'")
    expect((await act(request, 'remove', 'a1')).status).toBe(200)
    expect(await row(client, 'a1')).toMatchObject({ status: 'cancelled', decided_by: 'mem-1' })
    expect((await row(client, 'p1')).status).toBe('confirmed')
    const audit = await client.execute("SELECT action FROM audit_events WHERE action = 'tix.remove'")
    expect(audit.rows).toHaveLength(1)
  })

  it('remove refuses declined and already cancelled attendees', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE attendees SET status = 'declined' WHERE id = 'p1'")
    const declined = await act(request, 'remove', 'p1')
    expect(declined.status).toBe(409)
    expect(await codeOf(declined)).toBe('invalid_transition')
    const cancelled = await act(request, 'remove', 'c1')
    expect(cancelled.status).toBe(409)
    expect(await codeOf(cancelled)).toBe('invalid_transition')
  })

  it('remove does not promote when a pending attendee is removed', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE attendees SET status = 'waitlisted' WHERE id = 'a2'")
    expect((await act(request, 'remove', 'p1')).status).toBe(200)
    expect((await row(client, 'a2')).status).toBe('waitlisted')
  })

  it('restore reinstates an org-removed attendee', async () => {
    const { request, client } = await setup()
    await act(request, 'remove', 'a1')
    expect((await act(request, 'restore', 'a1')).status).toBe(200)
    expect(await row(client, 'a1')).toMatchObject({ status: 'confirmed', decided_by: 'mem-1' })
    expect((await client.execute("SELECT 1 FROM audit_events WHERE action = 'tix.restore'")).rows).toHaveLength(1)
  })

  it('restore allows a legacy-removed imported attendee with decided_by NULL', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE attendees SET source = 'import', decided_by = NULL WHERE id = 'c1'")
    expect((await act(request, 'restore', 'c1')).status).toBe(200)
    expect(await row(client, 'c1')).toMatchObject({ status: 'confirmed', decided_by: 'mem-1' })
  })

  it('restore refuses a self-cancelled attendee (self source, decided_by NULL)', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE attendees SET source = 'self', decided_by = NULL WHERE id = 'c1'")
    const res = await act(request, 'restore', 'c1')
    expect(res.status).toBe(409)
    expect(await codeOf(res)).toBe('self_cancelled')
    expect((await row(client, 'c1')).status).toBe('cancelled')
  })

  it('restore refuses on a cancelled event', async () => {
    const { request, client } = await setup()
    await client.execute("UPDATE attendees SET source = 'import', decided_by = 'mem-1' WHERE id = 'c1'")
    await client.execute("UPDATE events SET status = 'cancelled' WHERE slug = 'door'")
    const res = await act(request, 'restore', 'c1')
    expect(res.status).toBe(409)
    expect(await codeOf(res)).toBe('event_cancelled')
    expect((await row(client, 'c1')).status).toBe('cancelled')
  })

  it('restore refuses a non-cancelled attendee', async () => {
    const { request } = await setup()
    const res = await act(request, 'restore', 'a1')
    expect(res.status).toBe(409)
    expect(await codeOf(res)).toBe('not_removed')
  })

  it('restore is refused with event_full when no seat is free', async () => {
    const { request, client } = await setup()
    await act(request, 'remove', 'a1')
    await client.execute("UPDATE events SET max_attendees = 1 WHERE id = 'id-door'")
    const res = await act(request, 'restore', 'a1')
    expect(res.status).toBe(409)
    expect(await codeOf(res)).toBe('event_full')
    expect((await row(client, 'a1')).status).toBe('cancelled')
  })
})

describe('doorTimestamp', () => {
  const at = Date.parse('2026-10-27T12:00:00Z')
  it('keeps a sane client time in stored format', () => {
    expect(doorTimestamp('2026-10-27T11:59:00.000Z', at)).toBe('2026-10-27 11:59:00.000')
  })
  it('falls back to server time for garbage, far future and ancient values', () => {
    const server = '2026-10-27 12:00:00.000'
    expect(doorTimestamp('nope', at)).toBe(server)
    expect(doorTimestamp(undefined, at)).toBe(server)
    expect(doorTimestamp('2026-10-27T12:10:00Z', at)).toBe(server)
    expect(doorTimestamp('2026-10-20T11:00:00Z', at)).toBe(server)
    expect(doorTimestamp('2026-10-27T12:04:00Z', at)).toBe('2026-10-27 12:04:00.000')
  })
})

describe('GET /roster', () => {
  it('lists confirmed attendees only, with qr tokens, checkedIn and no emails', async () => {
    const { request } = await setup()
    await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }])
    const res = await request('/api/events/door/roster', { headers: json })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    const body = await res.json() as { attendees: Record<string, unknown>[]; generatedAt: string }
    expect(body.attendees).toEqual([
      { id: 'a1', qrToken: 'qr-a1', firstName: 'Ana', lastName: 'Last', status: 'confirmed', checkedIn: true },
      { id: 'a2', qrToken: 'qr-a2', firstName: 'Bea', lastName: 'Last', status: 'confirmed', checkedIn: false },
    ])
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false)
    expect(JSON.stringify(body)).not.toContain('@x.test')
  })

  it('a checked-out attendee is not checkedIn', async () => {
    const { request } = await setup()
    await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() },
      { id: uuid(2), attendeeId: 'a1', action: 'checked_out', at: now() },
    ])
    const body = await (await request('/api/events/door/roster', { headers: json })).json() as { attendees: { id: string; checkedIn: boolean }[] }
    expect(body.attendees.find((a) => a.id === 'a1')?.checkedIn).toBe(false)
  })
})

describe('GET /live', () => {
  it('counts confirmed, checked in and the last ten minutes', async () => {
    const { request, client } = await setup()
    await sync(request, [
      { id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() },
      { id: uuid(2), attendeeId: 'a2', action: 'checked_in', at: now() },
    ])
    await client.execute("UPDATE check_ins SET actioned_at = strftime('%Y-%m-%d %H:%M:%f','now','-30 minutes') WHERE attendee_id = 'a2'")
    const res = await request('/api/events/door/live', { headers: json })
    expect(await res.json()).toEqual({ confirmed: 2, checkedIn: 2, last10min: 1 })
    expect(res.headers.get('Cache-Control')).toMatch(/no-cache/)
  })

  it('answers 304 when If-None-Match matches and 200 once counts change', async () => {
    const { request } = await setup()
    const first = await request('/api/events/door/live', { headers: json })
    const etag = first.headers.get('ETag')
    expect(etag).toMatch(/^W\/"/)
    const again = await request('/api/events/door/live', { headers: { ...json, 'If-None-Match': etag! } })
    expect(again.status).toBe(304)
    expect(again.headers.get('ETag')).toBe(etag)
    await sync(request, [{ id: uuid(1), attendeeId: 'a1', action: 'checked_in', at: now() }])
    const changed = await request('/api/events/door/live', { headers: { ...json, 'If-None-Match': etag! } })
    expect(changed.status).toBe(200)
    expect(changed.headers.get('ETag')).not.toBe(etag)
  })
})

describe('door authorization', () => {
  const paths: [string, string][] = [
    ['roster', 'GET'],
    ['live', 'GET'],
    ['checkins/sync', 'POST'],
  ]
  const call = (request: Req, slug: string, [p, method]: [string, string], headers: Record<string, string> = json) =>
    request(`/api/events/${slug}/${p}`, { method, headers, ...(method === 'POST' ? { body: JSON.stringify({ items: [] }) } : {}) })

  it('answers 401 when signed out', async () => {
    const { request } = await createTestApp({ seed })
    for (const p of paths) expect((await call(request, 'door', p)).status).toBe(401)
  })
  it('answers 403 for a non-member and for another org event', async () => {
    const out = await createTestApp({ user: outsider, seed })
    for (const p of paths) expect((await call(out.request, 'door', p)).status).toBe(403)
    const { request } = await setup()
    for (const p of paths) expect((await call(request, 'other', p)).status).toBe(403)
  })
  it('answers 404 for an unknown event', async () => {
    const { request } = await setup()
    for (const p of paths) expect((await call(request, 'missing', p)).status).toBe(404)
  })
})
