import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createSession, sessionCookieName } from '../../lib/auth/session'
import { createTestApp, grantCurrentConsent, type TestUser } from '../../test/createTestApp'

const student: TestUser = { id: 'stu-1', email: 'stu1@student.apc.edu.ph', name: 'Sam Student', role: 'user' }
const json = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc' }

type EventSeed = {
  slug?: string
  mode?: string
  status?: string
  max?: number | null
  waitlist?: number
  opens?: string | null
  closes?: string | null
  date?: string
  questions?: unknown[]
}

async function seedEvent(client: Client, o: EventSeed = {}) {
  const slug = o.slug ?? 'ev'
  await client.execute({ sql: "INSERT OR IGNORE INTO users (id, email, name) VALUES ('owner', 'owner@apc.edu.ph', 'Owner')", args: [] })
  await client.execute({ sql: "INSERT OR IGNORE INTO organizations (id, name, owner_id) VALUES ('org-1', 'Alpha', 'owner')", args: [] })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id,
            selection_locked, status, admission_mode, max_attendees, waitlist_enabled,
            registration_opens_at, registration_closes_at, questions)
          VALUES (?, ?, 'owner', 'Fest', ?, '09:00', 'Hall', 'org-1', 1, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `id-${slug}`, slug, o.date ?? '2099-01-01', o.status ?? 'published', o.mode ?? 'fcfs',
      o.max === undefined ? 1 : o.max, o.waitlist ?? 0, o.opens ?? null, o.closes ?? null,
      JSON.stringify(o.questions ?? []),
    ],
  })
}

async function cookieFor(client: Client, env: Parameters<typeof sessionCookieName>[0], id: string, email: string) {
  await client.execute({ sql: 'INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)', args: [id, email, id] })
  await grantCurrentConsent(client, id)
  const { token } = await createSession(client as never, env as never, id, new Request('https://eypi.cc/'))
  return `${sessionCookieName(env)}=${token}`
}

// createTestApp creates the user lazily, so warm it up before firing parallel requests.
const warm = (request: (p: string, i?: RequestInit) => Promise<Response>) => request('/api/me')

const register = (request: (p: string, i?: RequestInit) => Promise<Response>, slug: string, answers: unknown = {}, cookie?: string) =>
  request(`/api/events/${slug}/register`, {
    method: 'POST',
    headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ answers }),
  })

async function ticketOf(res: Response) {
  return (await res.json() as { ticket: { id: string; status: string; qrToken: string | null; waitlistPosition: number | null } }).ticket
}

describe('student registration', () => {
  it('fcfs confirms while seats remain', async () => {
    const { request, client } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 2 }) })
    const res = await register(request, 'ev')
    expect(res.status).toBe(201)
    const ticket = await ticketOf(res)
    expect(ticket.status).toBe('confirmed')
    expect(ticket.qrToken).toBeTruthy()
    const row = await client.execute("SELECT source, user_id FROM attendees WHERE event_id = 'id-ev'")
    expect(row.rows[0]).toMatchObject({ source: 'self', user_id: student.id })
  })

  it('lets a user who belongs to no org register, while org routes stay forbidden', async () => {
    const { request } = await createTestApp({ user: student, seed: (c) => seedEvent(c) })
    expect((await register(request, 'ev')).status).toBe(201)
    const manage = await request('/api/events/ev/attendees', { headers: { 'X-Active-Org-Id': 'org-1' } })
    expect(manage.status).toBe(403)
  })

  it('last seat race: one confirmed, one waitlisted', async () => {
    const { request, client, env } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1, waitlist: 1 }) })
    const other = await cookieFor(client, env, 'stu-2', 'stu2@student.apc.edu.ph')
    await warm(request)
    const [a, b] = await Promise.all([register(request, 'ev'), register(request, 'ev', {}, other)])
    const statuses = [(await ticketOf(a)).status, (await ticketOf(b)).status].sort()
    expect(statuses).toEqual(['confirmed', 'waitlisted'])
    const confirmed = await client.execute("SELECT COUNT(*) AS n FROM attendees WHERE status = 'confirmed'")
    expect(Number(confirmed.rows[0].n)).toBe(1)
  })

  it('last seat race: waitlist off gives one 409 event_full', async () => {
    const { request, client, env } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1 }) })
    const other = await cookieFor(client, env, 'stu-2', 'stu2@student.apc.edu.ph')
    await warm(request)
    const [a, b] = await Promise.all([register(request, 'ev'), register(request, 'ev', {}, other)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const failed = a.status === 409 ? a : b
    expect((await failed.json() as { error: { code: string } }).error.code).toBe('event_full')
  })

  it('register is idempotent per user', async () => {
    const { request, client } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 5 }) })
    const first = await register(request, 'ev')
    const second = await register(request, 'ev')
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect((await ticketOf(second)).id).toBe((await ticketOf(first)).id)
    const [x, y] = await Promise.all([register(request, 'ev'), register(request, 'ev')])
    expect([x.status, y.status]).toEqual([200, 200])
    const n = await client.execute("SELECT COUNT(*) AS n FROM attendees WHERE user_id = 'stu-1'")
    expect(Number(n.rows[0].n)).toBe(1)
  })

  it('concurrent first registrations by one user create one row', async () => {
    const { request, client } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 5 }) })
    await warm(request)
    const [x, y] = await Promise.all([register(request, 'ev'), register(request, 'ev')])
    expect([x.status, y.status].sort()).toEqual([200, 201])
    const n = await client.execute("SELECT COUNT(*) AS n FROM attendees WHERE user_id = 'stu-1'")
    expect(Number(n.rows[0].n)).toBe(1)
  })

  it('refuses outside the window', async () => {
    const cases: [EventSeed, number, string][] = [
      [{ status: 'draft' }, 404, 'not_found'],
      [{ status: 'closed' }, 409, 'registration_closed'],
      [{ status: 'cancelled' }, 409, 'registration_closed'],
      [{ mode: 'import' }, 403, 'invite_only'],
      [{ opens: '2099-01-01 00:00:00' }, 409, 'not_open_yet'],
      [{ closes: '2000-01-01 00:00:00' }, 409, 'registration_closed'],
    ]
    for (const [seed, status, code] of cases) {
      const { request } = await createTestApp({ user: student, seed: (c) => seedEvent(c, seed) })
      const res = await register(request, 'ev')
      expect(res.status).toBe(status)
      expect((await res.json() as { error: { code: string } }).error.code).toBe(code)
    }
  })

  it('approval goes to pending and lottery to entered, with no qr token', async () => {
    for (const [mode, expected] of [['approval', 'pending'], ['lottery', 'entered']]) {
      const { request } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { mode, max: 1 }) })
      const ticket = await ticketOf(await register(request, 'ev'))
      expect(ticket.status).toBe(expected)
      expect(ticket.qrToken).toBeNull()
    }
  })

  it('required question missing gives 422 with fields', async () => {
    const questions = [
      { id: 'q1', label: 'Year', type: 'text', required: true },
      { id: 'q2', label: 'Diet', type: 'choice', options: ['none', 'veg'], required: false },
      { id: 'q3', label: 'Days', type: 'checkbox', options: ['a', 'b'], required: false },
    ]
    const { request } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 9, questions }) })
    const missing = await register(request, 'ev', {})
    expect(missing.status).toBe(422)
    expect((await missing.json() as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty('q1')
    const bad = await register(request, 'ev', { q1: 'x', q2: 'meat', q3: ['z'] })
    expect(bad.status).toBe(422)
    expect(Object.keys((await bad.json() as { error: { fields: object } }).error.fields).sort()).toEqual(['q2', 'q3'])
    const ok = await register(request, 'ev', { q1: ' 3rd ', q2: 'veg', q3: ['a'], junk: 'x' })
    expect(ok.status).toBe(201)
  })

  it('anonymous register is 401', async () => {
    const { request } = await createTestApp({ seed: (c) => seedEvent(c) })
    expect((await register(request, 'ev')).status).toBe(401)
    const del = await request('/api/events/ev/registration', { method: 'DELETE', headers: json })
    expect(del.status).toBe(401)
  })

  it('cancel promotes the oldest waitlisted', async () => {
    const { request, client, env } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1, waitlist: 1 }) })
    const second = await cookieFor(client, env, 'stu-2', 'stu2@student.apc.edu.ph')
    const third = await cookieFor(client, env, 'stu-3', 'stu3@student.apc.edu.ph')
    expect((await ticketOf(await register(request, 'ev'))).status).toBe('confirmed')
    const w2 = await ticketOf(await register(request, 'ev', {}, second))
    const w3 = await ticketOf(await register(request, 'ev', {}, third))
    expect([w2.waitlistPosition, w3.waitlistPosition]).toEqual([1, 2])

    const del = await request('/api/events/ev/registration', { method: 'DELETE', headers: json })
    expect(del.status).toBe(200)
    expect((await ticketOf(del)).status).toBe('cancelled')
    const rows = await client.execute('SELECT user_id, status FROM attendees ORDER BY user_id')
    expect(rows.rows.map((r) => [r.user_id, r.status])).toEqual([
      ['stu-1', 'cancelled'], ['stu-2', 'confirmed'], ['stu-3', 'waitlisted'],
    ])
    const own = await client.execute("SELECT decided_by FROM attendees WHERE user_id = 'stu-1'")
    expect(own.rows[0].decided_by).toBeNull()
  })
})

describe('imported rows and re-registration', () => {
  const seedImported = async (c: Client, mode = 'fcfs') => {
    await seedEvent(c, { mode, max: 5 })
    await c.execute({
      sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES ('imp', 'id-ev', 'Sam', ?, 'qr-imp')`,
      args: [student.email.toUpperCase()],
    })
  }

  it('register links an unlinked imported row with the same email and returns it', async () => {
    const { request, client } = await createTestApp({ user: student, seed: seedImported })
    const res = await register(request, 'ev')
    expect(res.status).toBe(200)
    expect((await ticketOf(res)).id).toBe('imp')
    const rows = await client.execute('SELECT id, user_id FROM attendees')
    expect(rows.rows.map((r) => [r.id, r.user_id])).toEqual([['imp', student.id]])
  })

  it('the public page links the imported row and returns it as the viewer ticket', async () => {
    const { request } = await createTestApp({ user: student, seed: (c) => seedImported(c, 'import') })
    const res = await request('/api/events/ev/public')
    const body = await res.json() as { viewer: { ticket: { id: string } | null } }
    expect(body.viewer.ticket?.id).toBe('imp')
  })

  it('a student who cancelled can register again and goes to the back of the queue', async () => {
    const { request, client, env } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1, waitlist: 1 }) })
    const other = await cookieFor(client, env, 'stu-2', 'stu2@student.apc.edu.ph')
    await register(request, 'ev')
    expect((await ticketOf(await register(request, 'ev', {}, other))).status).toBe('waitlisted')
    await client.execute("UPDATE attendees SET decided_by = 'someone' WHERE user_id = 'stu-1'")
    const del = await request('/api/events/ev/registration', { method: 'DELETE', headers: json })
    expect((await ticketOf(del)).status).toBe('cancelled')
    const cancelled = await client.execute("SELECT decided_by FROM attendees WHERE user_id = 'stu-1'")
    expect(cancelled.rows[0].decided_by).toBeNull()
    // stu-2 was promoted into the freed seat; stu-1 now joins the waitlist behind it
    const again = await register(request, 'ev')
    expect(again.status).toBe(201)
    const ticket = await ticketOf(again)
    expect(ticket.status).toBe('waitlisted')
    const rows = await client.execute({ sql: 'SELECT COUNT(*) AS n FROM attendees WHERE user_id = ?', args: ['stu-1'] })
    expect(Number(rows.rows[0].n)).toBe(1)
  })

  it('an organiser-cancelled registration stays cancelled', async () => {
    const { request, client } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 5 }) })
    await register(request, 'ev')
    await client.execute("UPDATE attendees SET status = 'cancelled', decided_by = 'org-user' WHERE user_id = 'stu-1'")
    const res = await register(request, 'ev')
    expect(res.status).toBe(409)
    const err = (await res.json() as { error: { code: string; message: string } }).error
    expect(err.code).toBe('registration_cancelled')
    expect(err.message).toBe('The organisers cancelled this registration.')
  })

  it('does not oversell when two cancelled students re-register for one seat', async () => {
    const { request, client, env } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1 }) })
    const other = await cookieFor(client, env, 'stu-2', 'stu2@student.apc.edu.ph')
    await warm(request)
    await register(request, 'ev')
    await request('/api/events/ev/registration', { method: 'DELETE', headers: json })
    await register(request, 'ev', {}, other)
    await request('/api/events/ev/registration', { method: 'DELETE', headers: { ...json, Cookie: other } })
    const [a, b] = await Promise.all([register(request, 'ev'), register(request, 'ev', {}, other)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const confirmed = await client.execute("SELECT COUNT(*) AS n FROM attendees WHERE status = 'confirmed'")
    expect(Number(confirmed.rows[0].n)).toBe(1)
  })

  it('concurrent repeats by the same cancelled student reactivate once', async () => {
    const { request, client } = await createTestApp({ user: student, seed: (c) => seedEvent(c, { max: 1 }) })
    await register(request, 'ev')
    await request('/api/events/ev/registration', { method: 'DELETE', headers: json })
    const [a, b] = await Promise.all([register(request, 'ev'), register(request, 'ev')])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    const rows = await client.execute("SELECT status FROM attendees WHERE user_id = 'stu-1'")
    expect(rows.rows.map((r) => r.status)).toEqual(['confirmed'])
  })
})

describe('GET /api/tickets', () => {
  it('links an imported row by email and sets user_id', async () => {
    const { request, client } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedEvent(c, { mode: 'import' })
        await c.execute({
          sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES ('imp', 'id-ev', 'Sam', ?, 'qr-imp')`,
          args: [student.email.toUpperCase()],
        })
      },
    })
    const res = await request('/api/tickets')
    expect(res.status).toBe(200)
    const { tickets } = await res.json() as { tickets: { id: string; status: string; qrToken: string | null; event: { slug: string } }[] }
    expect(tickets).toHaveLength(1)
    expect(tickets[0]).toMatchObject({ id: 'imp', status: 'confirmed', qrToken: 'qr-imp' })
    expect(tickets[0].event.slug).toBe('ev')
    const row = await client.execute("SELECT user_id FROM attendees WHERE id = 'imp'")
    expect(row.rows[0].user_id).toBe(student.id)
  })

  it('hides qrToken unless confirmed, lists upcoming before past', async () => {
    const { request, client } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedEvent(c, { slug: 'past', date: '2001-01-01', mode: 'approval' })
        await seedEvent(c, { slug: 'soon', date: '2099-01-01', mode: 'approval' })
      },
    })
    await register(request, 'soon')
    await client.execute("UPDATE events SET registration_closes_at = '2099-12-31 00:00:00' WHERE slug = 'past'")
    await register(request, 'past')
    const { tickets } = await (await request('/api/tickets')).json() as { tickets: { status: string; qrToken: string | null; event: { slug: string } }[] }
    expect(tickets.map((t) => t.event.slug)).toEqual(['soon', 'past'])
    expect(tickets.every((t) => t.status === 'pending' && t.qrToken === null)).toBe(true)
  })

  it('keeps yesterday evening events upcoming until 06:00 Manila the next day', async () => {
    const { request, client } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedEvent(c, { slug: 'late', date: '2099-01-01' })
        await seedEvent(c, { slug: 'old', date: '2001-01-01' })
      },
    })
    await warm(request)
    for (const slug of ['late', 'old']) {
      await client.execute({
        sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token, user_id, status, source, registered_at)
              VALUES (?, ?, 'S', ?, ?, ?, 'confirmed', 'self', CURRENT_TIMESTAMP)`,
        args: [`a-${slug}`, `id-${slug}`, `${slug}@x.test`, `qr-${slug}`, student.id],
      })
    }
    // The cutoff is date('now', '+2 hours'): an event dated on that day is still upcoming.
    const day = String((await client.execute("SELECT date('now', '+2 hours') AS d")).rows[0].d)
    await client.execute({ sql: "UPDATE events SET event_date = ? WHERE slug = 'late'", args: [day] })
    const { tickets } = await (await request('/api/tickets')).json() as { tickets: { event: { slug: string } }[] }
    expect(tickets.map((t) => t.event.slug)).toEqual(['late', 'old'])
  })

  it('anonymous is 401', async () => {
    const { request } = await createTestApp()
    expect((await request('/api/tickets')).status).toBe(401)
  })
})

describe('GET /api/me ticketUpdates', () => {
  it('counts decisions after tickets_seen_at', async () => {
    const { request, client } = await createTestApp({
      user: student,
      seed: async (c) => {
        await seedEvent(c, { mode: 'approval' })
      },
    })
    await register(request, 'ev')
    const count = async () => ((await (await request('/api/me')).json()) as { ticketUpdates: number }).ticketUpdates
    expect(await count()).toBe(0)
    await client.execute("UPDATE attendees SET status = 'confirmed', decided_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE user_id = 'stu-1'")
    expect(await count()).toBe(1)
    await request('/api/tickets')
    expect(await count()).toBe(0)
    await new Promise((r) => setTimeout(r, 5))
    await client.execute("UPDATE attendees SET decided_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE user_id = 'stu-1'")
    expect(await count()).toBe(1)
  })
})
