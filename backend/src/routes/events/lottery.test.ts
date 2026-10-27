import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { promoteWaitlist } from '../../lib/tix/registration'
import { createTestApp, type TestUser } from '../../test/createTestApp'

const member: TestUser = { id: 'mem-1', email: 'mem@student.apc.edu.ph', name: 'Mem', role: 'user' }
const json = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc', 'X-Active-Org-Id': 'org-1' }
const PAST = '2020-01-01 00:00:00'

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

type EventOpts = { org?: string; max?: number | null; mode?: string; waitlist?: number; closes?: string | null; questions?: unknown[] }

async function seedEvent(client: Client, slug: string, o: EventOpts = {}) {
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked,
            status, admission_mode, max_attendees, waitlist_enabled, registration_closes_at, questions)
          VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, 'published', ?, ?, ?, ?, ?)`,
    args: [
      `id-${slug}`, slug, o.org ?? 'org-1', o.mode ?? 'lottery', o.max === undefined ? 2 : o.max,
      o.waitlist ?? 0, o.closes === undefined ? PAST : o.closes, JSON.stringify(o.questions ?? []),
    ],
  })
}

async function entrants(client: Client, slug: string, n: number, answerFor?: (i: number) => Record<string, string>, prefix = 'a') {
  for (let i = 0; i < n; i++) {
    const id = `${prefix}${String(i).padStart(2, '0')}`
    await client.execute({
      sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, answers, registered_at)
            VALUES (?, ?, ?, 'L', ?, ?, 'entered', ?, ?)`,
      args: [id, `id-${slug}`, id, `${id}@x.test`, `qr-${id}`, JSON.stringify(answerFor?.(i) ?? {}), `2026-01-01 00:00:${String(i).padStart(2, '0')}.000`],
    })
  }
}

const draw = (request: Req, slug: string, body: unknown = {}) =>
  request(`/api/events/${slug}/draw`, { method: 'POST', headers: json, body: JSON.stringify(body) })

async function statuses(client: Client, slug: string): Promise<Record<string, string>> {
  const res = await client.execute({ sql: 'SELECT id, status FROM attendees WHERE event_id = ? ORDER BY id', args: [`id-${slug}`] })
  return Object.fromEntries(res.rows.map((r) => [String(r.id), String(r.status)]))
}

const winnersOf = (s: Record<string, string>) => Object.keys(s).filter((id) => s[id] === 'confirmed')

describe('lottery draw', () => {
  it('respects capacity and is deterministic per seed', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 3 }); await seedEvent(c, 'b', { max: 3 }); await entrants(c, 'a', 10); await entrants(c, 'b', 10, undefined, 'b') },
    })
    const ra = await draw(request, 'a', { seed: 'fixed' })
    expect(ra.status).toBe(200)
    expect(await ra.json()).toEqual({ confirmed: 3, waitlisted: 0, declined: 7, seed: 'fixed' })
    await draw(request, 'b', { seed: 'fixed' })
    const a = winnersOf(await statuses(client, 'a'))
    const b = winnersOf(await statuses(client, 'b')).map((id) => id.replace(/^b/, 'a'))
    expect(a).toHaveLength(3)
    expect(b).toEqual(a)
    const decided = await client.execute("SELECT decided_at, decided_by FROM attendees WHERE id = 'a00'")
    expect(decided.rows[0].decided_at).not.toBeNull()
    expect(decided.rows[0].decided_by).toBe('mem-1')
  })

  it('generates and returns a seed when none is given', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 1 }); await entrants(c, 'a', 3) },
    })
    const body = await (await draw(request, 'a')).json() as { seed: string }
    expect(body.seed.length).toBeGreaterThan(8)
    const audit = await client.execute("SELECT meta FROM audit_events WHERE action = 'tix.draw'")
    expect(audit.rows).toHaveLength(1)
    const meta = String(audit.rows[0].meta)
    expect(JSON.parse(meta)).toEqual({ confirmed: 1, waitlisted: 0, declined: 2, seed: body.seed })
    expect(meta).not.toContain('@')
  })

  it('waitlists losers in draw order when the waitlist is on, and promotion follows that order', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 2, waitlist: 1 }); await entrants(c, 'a', 6) },
    })
    expect(await (await draw(request, 'a', { seed: 's1' })).json()).toMatchObject({ confirmed: 2, waitlisted: 4, declined: 0 })
    const s = await statuses(client, 'a')
    expect(Object.values(s).filter((v) => v === 'waitlisted')).toHaveLength(4)
    const order = await client.execute("SELECT id FROM attendees WHERE status = 'waitlisted' ORDER BY decided_at")
    expect(order.rows).toHaveLength(4)
    const ids = order.rows.map((r) => String(r.id))
    expect(new Set(ids).size).toBe(4)
    // a confirmed attendee cancels: the first in draw order is promoted
    const winner = winnersOf(s)[0]
    await promoteWaitlist(client as never, 'id-a', 2, [{ sql: "UPDATE attendees SET status = 'cancelled' WHERE id = ?", args: [winner] }])
    expect((await statuses(client, 'a'))[ids[0]]).toBe('confirmed')
  })

  it('declines losers when the waitlist is off', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 2, waitlist: 0 }); await entrants(c, 'a', 5) },
    })
    expect(await (await draw(request, 'a', { seed: 's' })).json()).toMatchObject({ confirmed: 2, waitlisted: 0, declined: 3 })
    expect(Object.values(await statuses(client, 'a')).filter((v) => v === 'declined')).toHaveLength(3)
  })

  it('confirms everyone when capacity is unlimited and leaves other statuses alone', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c); await seedEvent(c, 'a', { max: null }); await entrants(c, 'a', 3)
        await client0(c, 'x1', 'cancelled')
      },
    })
    expect(await (await draw(request, 'a')).json()).toMatchObject({ confirmed: 3, waitlisted: 0, declined: 0 })
    expect((await statuses(client, 'a')).x1).toBe('cancelled')
  })

  it('subtracts seats already confirmed (imports, guests)', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 3 }); await entrants(c, 'a', 5); await client0(c, 'x1', 'confirmed') },
    })
    expect(await (await draw(request, 'a', { seed: 's' })).json()).toMatchObject({ confirmed: 2, declined: 3 })
  })

  it('applies cluster quotas from a choice question', async () => {
    const questions = [{ id: 'q1', label: 'Year', type: 'choice', options: ['1st', '2nd'] }]
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, 'a', { max: 4, waitlist: 1, questions })
        await entrants(c, 'a', 8, (i) => ({ q1: i < 6 ? '1st' : '2nd' }))
        for (const [v, n] of [['1st', 1], ['2nd', 2]] as const) {
          await c.execute({ sql: "INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count) VALUES (?, 'id-a', 'q1', ?, ?)", args: [`c-${v}`, v, n] })
        }
      },
    })
    const res = await draw(request, 'a', { seed: 's', clusterQuestionId: 'q1' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ confirmed: 3, waitlisted: 5, declined: 0 })
    const s = await statuses(client, 'a')
    const won = winnersOf(s)
    expect(won.filter((id) => Number(id.slice(1)) < 6)).toHaveLength(1)
    expect(won.filter((id) => Number(id.slice(1)) >= 6)).toHaveLength(2)
    const cv = await client.execute("SELECT cluster_value FROM attendees WHERE id = 'a00'")
    expect(cv.rows[0].cluster_value).toBe('1st')
  })

  it('rejects a cluster question that is not a choice question', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { questions: [{ id: 'q1', label: 'Why', type: 'text' }] }); await entrants(c, 'a', 2) },
    })
    const res = await draw(request, 'a', { clusterQuestionId: 'q1' })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_cluster_question')
    expect((await draw(request, 'a', { clusterQuestionId: 'nope' })).status).toBe(400)
  })

  it('refuses a second draw', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a'); await entrants(c, 'a', 4) },
    })
    expect((await draw(request, 'a')).status).toBe(200)
    const again = await draw(request, 'a')
    expect(again.status).toBe(409)
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe('already_drawn')
  })

  it('lets exactly one of two concurrent draws win and leaves no undecided entrants', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'a', { max: 2, waitlist: 1 }); await entrants(c, 'a', 6) },
    })
    const rs = await Promise.all([draw(request, 'a', { seed: 'one' }), draw(request, 'a', { seed: 'two' })])
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409])
    const s = await statuses(client, 'a')
    expect(Object.values(s).filter((v) => v === 'entered')).toHaveLength(0)
    expect(winnersOf(s)).toHaveLength(2)
  })

  it('refuses before registration closes, for other modes, and for unknown events', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, 'open', { closes: '2099-01-01 00:00:00' })
        await seedEvent(c, 'noclose', { closes: null })
        await seedEvent(c, 'appr', { mode: 'approval' })
        await entrants(c, 'open', 2)
      },
    })
    const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code
    const open = await draw(request, 'open')
    expect(open.status).toBe(409)
    expect(await code(open)).toBe('registration_open')
    expect(await code(await draw(request, 'noclose'))).toBe('registration_open')
    const appr = await draw(request, 'appr')
    expect(appr.status).toBe(409)
    expect(await code(appr)).toBe('not_lottery')
    expect((await draw(request, 'missing')).status).toBe(404)
    expect((await statuses(client, 'open')).a00).toBe('entered')
    const drawn = await client.execute("SELECT lottery_drawn_at FROM events WHERE id = 'id-open'")
    expect(drawn.rows[0].lottery_drawn_at).toBeNull()
  })

  it('answers 401 signed out, 403 for another org', async () => {
    const { request } = await createTestApp({
      user: member,
      seed: async (c) => { await seed(c); await seedEvent(c, 'other', { org: 'org-2' }); await seedEvent(c, 'a') },
    })
    expect((await draw(request, 'other')).status).toBe(403)
    const signedOut = await createTestApp({ seed: async (c) => { await seed(c); await seedEvent(c, 'a'); await entrants(c, 'a', 2) } })
    expect((await draw(signedOut.request, 'a')).status).toBe(401)
    expect((await statuses(signedOut.client, 'a')).a00).toBe('entered')
  })
})

async function client0(c: Client, id: string, status: string) {
  await c.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token, status) VALUES (?, 'id-a', ?, ?, ?, ?)`,
    args: [id, id, `${id}@x.test`, `qr-${id}`, status],
  })
}
