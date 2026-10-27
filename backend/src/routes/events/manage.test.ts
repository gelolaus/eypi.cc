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

const base = { name: 'Fest', slug: 'fest', date: '2099-01-01', time: '09:00', location: 'Hall' }

const send = (request: Req, method: string, path: string, body?: unknown, headers: Record<string, string> = json) =>
  request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })

async function create(request: Req, extra: Record<string, unknown> = {}) {
  const res = await send(request, 'POST', '/api/events', { ...base, ...extra })
  return { res, body: await res.json() as { event?: { id: string; slug: string; status: string }; error?: { code: string; fields?: Record<string, string> } } }
}

async function row(client: Client, slug = 'fest') {
  return (await client.execute({ sql: 'SELECT * FROM events WHERE slug = ?', args: [slug] })).rows[0]
}

async function seedEvent(client: Client, o: { slug?: string; org?: string; status?: string; max?: number | null; waitlist?: number } = {}) {
  const slug = o.slug ?? 'ev'
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked,
            status, admission_mode, max_attendees, waitlist_enabled)
          VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, ?, 'fcfs', ?, ?)`,
    args: [`id-${slug}`, slug, o.org ?? 'org-1', o.status ?? 'published', o.max === undefined ? 2 : o.max, o.waitlist ?? 0],
  })
}

async function seedAttendee(client: Client, n: number, status: string, eventSlug = 'ev') {
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at)
          VALUES (?, ?, 'A', ?, ?, ?, ?, ?)`,
    args: [`a${n}`, `id-${eventSlug}`, `${n}`, `a${n}@x.test`, `qr-${n}`, status, `2026-01-01 00:00:0${n}.000`],
  })
}

const statusOf = async (client: Client, id: string) =>
  String((await client.execute({ sql: 'SELECT status FROM attendees WHERE id = ?', args: [id] })).rows[0].status)

describe('create validation', () => {
  it('rejects more than 5 questions', async () => {
    const { request } = await createTestApp({ user: member, seed })
    const questions = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, label: 'Q', type: 'text' }))
    const { res, body } = await create(request, { questions })
    expect(res.status).toBe(422)
    expect(body.error?.code).toBe('invalid_event')
    expect(body.error?.fields?.questions).toBeTruthy()
  })

  it.each([
    ['choice without options', [{ id: 'q', label: 'Q', type: 'choice' }]],
    ['checkbox with empty options', [{ id: 'q', label: 'Q', type: 'checkbox', options: [] }]],
    ['more than 20 options', [{ id: 'q', label: 'Q', type: 'choice', options: Array.from({ length: 21 }, (_, i) => `o${i}`) }]],
    ['option over 100 chars', [{ id: 'q', label: 'Q', type: 'choice', options: ['x'.repeat(101)] }]],
    ['label over 200 chars', [{ id: 'q', label: 'x'.repeat(201), type: 'text' }]],
    ['unknown type', [{ id: 'q', label: 'Q', type: 'file' }]],
    ['duplicate ids', [{ id: 'q', label: 'A', type: 'text' }, { id: 'q', label: 'B', type: 'text' }]],
    ['__proto__ id', [{ id: '__proto__', label: 'Q', type: 'text' }]],
    ['constructor id', [{ id: 'constructor', label: 'Q', type: 'text' }]],
    ['id with spaces', [{ id: 'a b', label: 'Q', type: 'text' }]],
  ])('rejects %s', async (_name, questions) => {
    const { request, client } = await createTestApp({ user: member, seed })
    const { res, body } = await create(request, { questions })
    expect(res.status).toBe(422)
    expect(body.error?.fields?.questions).toBeTruthy()
    expect(await row(client)).toBeUndefined()
  })

  it('rejects registration closing before it opens', async () => {
    const { request } = await createTestApp({ user: member, seed })
    const { res, body } = await create(request, {
      admissionMode: 'fcfs',
      registrationOpensAt: '2026-12-02T00:00:00Z',
      registrationClosesAt: '2026-12-01T00:00:00Z',
    })
    expect(res.status).toBe(422)
    expect(body.error?.fields?.registrationClosesAt).toBeTruthy()
  })

  it('rejects a description over 4000 characters and accepts exactly 4000', async () => {
    const { request } = await createTestApp({ user: member, seed })
    const long = await create(request, { description: 'x'.repeat(4001) })
    expect(long.res.status).toBe(422)
    expect(long.body.error?.fields?.description).toBeTruthy()
    const ok = await create(request, { description: 'x'.repeat(4000) })
    expect(ok.res.status).toBe(201)
  })

  it('rejects an unknown admission mode, bad time and waitlist on approval events', async () => {
    const { request } = await createTestApp({ user: member, seed })
    expect((await create(request, { admissionMode: 'raffle' })).res.status).toBe(422)
    expect((await create(request, { time: '25:00' })).res.status).toBe(422)
    const waitlist = await create(request, { admissionMode: 'approval', waitlistEnabled: true })
    expect(waitlist.res.status).toBe(422)
    expect(waitlist.body.error?.fields?.waitlistEnabled).toBeTruthy()
  })

  it('keeps the old required-field and slug failures as errors', async () => {
    const { request } = await createTestApp({ user: member, seed })
    expect((await create(request, { name: '' })).res.status).toBeGreaterThanOrEqual(400)
    expect((await create(request, { slug: 'Bad Slug' })).res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('create and update', () => {
  it('stores a draft with the admission settings and raw Markdown', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    const { res, body } = await create(request, {
      description: '# Hello <script>alert(1)</script>',
      admissionMode: 'fcfs',
      visibility: 'public',
      capacity: 50,
      waitlistEnabled: true,
      endTime: '12:30',
      registrationOpensAt: '2026-12-01T00:00:00+08:00',
      questions: [{ id: 'diet', label: 'Diet', type: 'choice', options: ['Veg', 'Any'], required: true }],
    })
    expect(res.status).toBe(201)
    expect(body.event?.status).toBe('draft')
    const r = await row(client)
    expect(r).toMatchObject({
      status: 'draft', admission_mode: 'fcfs', visibility: 'public', max_attendees: 50, waitlist_enabled: 1,
      end_time: '12:30', description: '# Hello <script>alert(1)</script>', org_id: 'org-1',
      registration_opens_at: '2026-11-30 16:00:00',
    })
    expect(JSON.parse(String(r.questions))).toEqual([{ id: 'diet', label: 'Diet', type: 'choice', options: ['Veg', 'Any'], required: true }])
  })

  it('defaults to a draft import event for callers that send only the old fields', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    const { res, body } = await create(request, { maxAttendees: 10 })
    expect(res.status).toBe(201)
    expect(body.event?.status).toBe('draft')
    expect(await row(client)).toMatchObject({ admission_mode: 'import', visibility: 'unlisted', max_attendees: 10, status: 'draft' })
  })

  it('still runs the old import flow end to end for a draft event', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    expect((await create(request)).res.status).toBe(201)
    const id = String((await row(client)).id)
    await client.execute({ sql: "INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES ('r1', ?, 0, ?)", args: [id, JSON.stringify({ Email: 'a@x.test', Name: 'Ann Lee' })] })
    const fin = await send(request, 'POST', '/api/events/fest/finalize', {
      selectedRows: [{ rowId: 'r1', clusterValue: null }],
      maxAttendees: 5,
      columnMapping: { emailCol: 'Email', firstNameCol: null, lastNameCol: null, fullNameCol: 'Name' },
    })
    expect(fin.status).toBe(200)
    const list = await send(request, 'GET', '/api/events/fest/attendees')
    expect(((await list.json()) as { attendees: unknown[] }).attendees).toHaveLength(1)
    expect((await row(client)).selection_locked).toBe(1)
  })

  it('creates with legacy attendees in a draft', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    const { res } = await create(request, { attendees: [{ firstName: 'A', lastName: 'B', email: 'a@x.test' }] })
    expect(res.status).toBe(201)
    expect((await client.execute('SELECT COUNT(*) AS n FROM attendees')).rows[0].n).toBe(1)
  })

  it('patches fields, clears nullable ones and validates the result', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs', description: 'x', endTime: '10:00', capacity: 5 })
    const ok = await send(request, 'PATCH', '/api/events/fest', { name: 'New', description: null, endTime: null, capacity: null, visibility: 'public' })
    expect(ok.status).toBe(200)
    expect(await row(client)).toMatchObject({ name: 'New', description: null, end_time: null, max_attendees: null, visibility: 'public' })
    const bad = await send(request, 'PATCH', '/api/events/fest', { description: 'x'.repeat(4001) })
    expect(bad.status).toBe(422)
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('invalid_event')
    expect((await send(request, 'PATCH', '/api/events/fest', {})).status).toBe(400)
  })

  it('checks the registration window against the stored value on a partial patch', async () => {
    const { request } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs', registrationOpensAt: '2026-12-01T00:00:00Z' })
    const res = await send(request, 'PATCH', '/api/events/fest', { registrationClosesAt: '2026-11-01T00:00:00Z' })
    expect(res.status).toBe(422)
  })

  it('allows an admission mode change after publishing while nobody has registered, then locks it', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    await send(request, 'POST', '/api/events/fest/publish')
    expect((await send(request, 'PATCH', '/api/events/fest', { admissionMode: 'lottery' })).status).toBe(200)
    expect((await row(client)).admission_mode).toBe('lottery')
    const id = String((await row(client)).id)
    await client.execute({ sql: "INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, source) VALUES ('s1', ?, 'A', 'B', 'a@x.test', 'q1', 'entered', 'self')", args: [id] })
    const res = await send(request, 'PATCH', '/api/events/fest', { admissionMode: 'approval' })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('admission_locked')
    expect((await row(client)).admission_mode).toBe('lottery')
    // A cancelled self-registration or an imported row does not lock it.
    await client.execute("UPDATE attendees SET status = 'cancelled' WHERE id = 's1'")
    expect((await send(request, 'PATCH', '/api/events/fest', { admissionMode: 'approval' })).status).toBe(200)
  })

  it('reopens a closed event through publish', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    await send(request, 'POST', '/api/events/fest/publish')
    await send(request, 'POST', '/api/events/fest/close')
    expect((await send(request, 'POST', '/api/events/fest/publish')).status).toBe(200)
    expect((await row(client)).status).toBe('published')
  })

  it('answers a slug that is taken with 409 slug_taken', async () => {
    const { request } = await createTestApp({ user: member, seed })
    await create(request)
    const again = await create(request)
    expect(again.res.status).toBe(409)
    expect(again.body.error?.code).toBe('slug_taken')
  })

  it('ignores a stale invalid pair the patch does not touch', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    await client.execute("UPDATE events SET waitlist_enabled = 1, admission_mode = 'approval' WHERE slug = 'fest'")
    expect((await send(request, 'PATCH', '/api/events/fest', { name: 'Renamed' })).status).toBe(200)
  })

  it('refuses edits to a cancelled event', async () => {
    const { request } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    await send(request, 'POST', '/api/events/fest/publish')
    await send(request, 'POST', '/api/events/fest/cancel')
    expect((await send(request, 'PATCH', '/api/events/fest', { name: 'Again' })).status).toBe(409)
  })
})

describe('draft visibility', () => {
  it('hides a draft from signed-in people outside the event org until it is published', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await c.execute("INSERT INTO organizations (id, name, owner_id) VALUES ('org-3', 'org-3', 'owner')")
        await c.execute("INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-3', 'mem@student.apc.edu.ph', 'mem-1', CURRENT_TIMESTAMP)")
        await seedEvent(c, { status: 'draft', org: 'org-3' })
      },
    })
    const asOrg1 = { ...json }
    const draft = await send(request, 'GET', '/api/events/ev', undefined, asOrg1)
    expect(draft.status).toBe(404)
    const lead = await send(request, 'GET', '/api/events/ev', undefined, { ...json, 'X-Active-Org-Id': 'org-3' })
    expect(lead.status).toBe(200)
    await client.execute("UPDATE events SET status = 'published' WHERE slug = 'ev'")
    expect((await send(request, 'GET', '/api/events/ev', undefined, asOrg1)).status).toBe(200)
  })
})

describe('state changes', () => {
  it('walks draft -> published -> closed -> cancelled', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    const pub = await send(request, 'POST', '/api/events/fest/publish')
    expect(pub.status).toBe(200)
    expect(((await pub.json()) as { event: { status: string } }).event.status).toBe('published')
    expect((await row(client)).status).toBe('published')
    expect((await send(request, 'POST', '/api/events/fest/close')).status).toBe(200)
    expect((await row(client)).status).toBe('closed')
    expect((await send(request, 'POST', '/api/events/fest/cancel')).status).toBe(200)
    expect((await row(client)).status).toBe('cancelled')
  })

  it('refuses transitions the machine does not allow with 409 invalid_transition', async () => {
    const { request, client } = await createTestApp({ user: member, seed })
    await create(request, { admissionMode: 'fcfs' })
    for (const action of ['close', 'cancel']) {
      const res = await send(request, 'POST', `/api/events/fest/${action}`)
      expect(res.status).toBe(409)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_transition')
    }
    await send(request, 'POST', '/api/events/fest/publish')
    expect((await send(request, 'POST', '/api/events/fest/publish')).status).toBe(409)
    await send(request, 'POST', '/api/events/fest/cancel')
    for (const action of ['publish', 'close', 'cancel']) {
      expect((await send(request, 'POST', `/api/events/fest/${action}`)).status).toBe(409)
    }
    expect((await row(client)).status).toBe('cancelled')
  })

  it('cancelling the event cancels every non-cancelled attendee', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, { waitlist: 1 })
        await seedEvent(c, { slug: 'other' })
        const statuses = ['confirmed', 'waitlisted', 'pending', 'entered', 'declined', 'cancelled']
        for (const [i, s] of statuses.entries()) await seedAttendee(c, i + 1, s)
        await seedAttendee(c, 9, 'confirmed', 'other')
      },
    })
    const res = await send(request, 'POST', '/api/events/ev/cancel')
    expect(res.status).toBe(200)
    for (const i of [1, 2, 3, 4, 6]) expect(await statusOf(client, `a${i}`)).toBe('cancelled')
    expect(await statusOf(client, 'a5')).toBe('declined')
    expect(await statusOf(client, 'a9')).toBe('confirmed')
    const decided = await client.execute("SELECT id, decided_at, decided_by FROM attendees WHERE id IN ('a1', 'a5', 'a6') ORDER BY id")
    expect(decided.rows[0].decided_at).toBeTruthy()
    expect(decided.rows[0].decided_by).toBe('mem-1')
    expect(decided.rows[1].decided_at).toBeNull()
    expect(decided.rows[2].decided_at).toBeNull()
  })

  it('does not touch attendees when the cancel is refused', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, { status: 'draft' })
        await seedAttendee(c, 1, 'confirmed')
      },
    })
    expect((await send(request, 'POST', '/api/events/ev/cancel')).status).toBe(409)
    expect(await statusOf(client, 'a1')).toBe('confirmed')
  })
})

describe('capacity changes', () => {
  const waitlistSeed = async (c: Client, cap: number | null, waitlistEnabled = 1) => {
    await seed(c)
    await seedEvent(c, { max: cap, waitlist: waitlistEnabled })
    await seedAttendee(c, 1, 'confirmed')
    await seedAttendee(c, 2, 'waitlisted')
    await seedAttendee(c, 3, 'waitlisted')
    await seedAttendee(c, 4, 'waitlisted')
  }

  it('promotes the oldest waitlisted attendees in the same call as the increase', async () => {
    const { request, client } = await createTestApp({ user: member, seed: (c) => waitlistSeed(c, 1) })
    const res = await send(request, 'PATCH', '/api/events/ev', { capacity: 3 })
    expect(res.status).toBe(200)
    expect(await statusOf(client, 'a2')).toBe('confirmed')
    expect(await statusOf(client, 'a3')).toBe('confirmed')
    expect(await statusOf(client, 'a4')).toBe('waitlisted')
    expect((await row(client, 'ev')).max_attendees).toBe(3)
    const promoted = await client.execute("SELECT decided_at FROM attendees WHERE id = 'a2'")
    expect(promoted.rows[0].decided_at).toBeTruthy()
  })

  it('promotes everyone when the limit is removed', async () => {
    const { request, client } = await createTestApp({ user: member, seed: (c) => waitlistSeed(c, 1) })
    await send(request, 'PATCH', '/api/events/ev', { capacity: null })
    expect(await statusOf(client, 'a4')).toBe('confirmed')
  })

  it('promotes when enabling the waitlist leaves seats free', async () => {
    const { request, client } = await createTestApp({ user: member, seed: (c) => waitlistSeed(c, 2, 0) })
    const res = await send(request, 'PATCH', '/api/events/ev', { waitlistEnabled: true })
    expect(res.status).toBe(200)
    expect(await statusOf(client, 'a2')).toBe('confirmed')
    expect(await statusOf(client, 'a3')).toBe('waitlisted')
  })

  it('does not auto-cancel anyone when capacity drops below the confirmed count', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, { max: 3, waitlist: 1 })
        await seedAttendee(c, 1, 'confirmed')
        await seedAttendee(c, 2, 'confirmed')
        await seedAttendee(c, 3, 'confirmed')
        await seedAttendee(c, 4, 'waitlisted')
      },
    })
    const res = await send(request, 'PATCH', '/api/events/ev', { capacity: 1 })
    expect(res.status).toBe(200)
    for (const id of ['a1', 'a2', 'a3']) expect(await statusOf(client, id)).toBe('confirmed')
    expect(await statusOf(client, 'a4')).toBe('waitlisted')
    expect((await row(client, 'ev')).max_attendees).toBe(1)
  })
})

describe('authorization and errors', () => {
  it('forbids members of another org from every write', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (c) => {
        await seed(c)
        await seedEvent(c, { org: 'org-2' })
      },
    })
    const calls: [string, string, unknown?][] = [
      ['PATCH', '/api/events/ev', { name: 'Hacked' }],
      ['POST', '/api/events/ev/publish'],
      ['POST', '/api/events/ev/close'],
      ['POST', '/api/events/ev/cancel'],
      ['PUT', '/api/events/ev/cover', { image: 'data:image/png;base64,AAAA' }],
      ['DELETE', '/api/events/ev/cover'],
    ]
    for (const [method, path, body] of calls) {
      const res = await send(request, method, path, body)
      expect(res.status, `${method} ${path}`).toBe(403)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('forbidden')
    }
    expect((await row(client, 'ev')).name).toBe('Ev')
    expect((await row(client, 'ev')).status).toBe('published')
  })

  it('answers 404 for an unknown event and 401 when signed out', async () => {
    const { request } = await createTestApp({ user: member, seed })
    const res = await send(request, 'POST', '/api/events/nope/publish')
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found')
    const anon = await createTestApp({ seed })
    for (const [method, path, body] of [
      ['POST', '/api/events/nope/publish'], ['POST', '/api/events/nope/close'], ['POST', '/api/events/nope/cancel'],
      ['PATCH', '/api/events/nope', { name: 'x' }], ['PUT', '/api/events/nope/cover', {}], ['DELETE', '/api/events/nope/cover'],
    ] as [string, string, unknown?][]) {
      const out = await send(anon.request, method, path, body)
      expect(out.status, `${method} ${path}`).toBe(401)
      expect(await out.json(), path).toMatchObject({ error: { code: 'unauthorized' } })
    }
  })
})

// Smallest buffer the image sniffer reads as a PNG.
function png(width: number, height: number, salt = 0): Uint8Array {
  const bytes = new Uint8Array(25)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = salt
  return bytes
}
const dataUrl = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`

describe('cover images', () => {
  const objectKeys = async (env: { MEDIA: R2Bucket }) =>
    ((await env.MEDIA.list()).objects.map((o) => o.key)).sort()

  it('stores a content-addressed cover under events/{eventId}/ and replaces it cleanly', async () => {
    const { request, client, env } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c) } })
    const first = await send(request, 'PUT', '/api/events/ev/cover', { image: dataUrl(png(1600, 800, 1)) })
    expect(first.status).toBe(200)
    const body = await first.json() as { coverKey: string; coverUrl: string }
    expect(body.coverKey).toMatch(/^events\/id-ev\/cover-[0-9a-f]{8}\.png$/)
    expect(body.coverUrl).toBe(`/media/${body.coverKey}`)
    expect((await row(client, 'ev')).cover_key).toBe(body.coverKey)

    // Pretend variants were made for it, then replace.
    await client.execute({ sql: 'UPDATE events SET cover_meta = ? WHERE id = ?', args: [JSON.stringify({ w: 1600, h: 800, fmt: 'webp', widths: [640], ph: '' }), 'id-ev'] })
    await env.MEDIA.put(body.coverKey.replace('.png', '-640.webp'), new Uint8Array([1]))
    const second = await send(request, 'PUT', '/api/events/ev/cover', { image: dataUrl(png(1600, 800, 2)) })
    expect(second.status).toBe(200)
    const next = await second.json() as { coverKey: string }
    expect(next.coverKey).not.toBe(body.coverKey)
    expect(await objectKeys(env as never)).toEqual([next.coverKey])
    expect((await row(client, 'ev')).cover_meta).toBeNull()
  })

  it('rejects non-images with the error shape and writes nothing', async () => {
    const { request, client, env } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c) } })
    const res = await send(request, 'PUT', '/api/events/ev/cover', { image: 'data:image/png;base64,AAAA' })
    expect(res.status).toBe(422)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_image')
    expect((await send(request, 'PUT', '/api/events/ev/cover', {})).status).toBe(422)
    const huge = await send(request, 'PUT', '/api/events/ev/cover', { image: `data:image/png;base64,${'A'.repeat(15 * 1024 * 1024)}` })
    expect(huge.status).toBe(422)
    expect(await objectKeys(env as never)).toEqual([])
    expect((await row(client, 'ev')).cover_key).toBeNull()
  })

  it('removes the cover and its variants on DELETE', async () => {
    const { request, client, env } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c) } })
    const put = await send(request, 'PUT', '/api/events/ev/cover', { image: dataUrl(png(1600, 800, 1)) })
    const { coverKey } = await put.json() as { coverKey: string }
    await client.execute({ sql: 'UPDATE events SET cover_meta = ? WHERE id = ?', args: [JSON.stringify({ w: 1600, h: 800, fmt: 'webp', widths: [640], ph: '' }), 'id-ev'] })
    await env.MEDIA.put(coverKey.replace('.png', '-640.webp'), new Uint8Array([1]))
    expect((await send(request, 'DELETE', '/api/events/ev/cover')).status).toBe(200)
    expect(await objectKeys(env as never)).toEqual([])
    expect(await row(client, 'ev')).toMatchObject({ cover_key: null, cover_meta: null })
  })

  it('deletes the cover with the event', async () => {
    const { request, client, env } = await createTestApp({ user: member, seed: async (c) => { await seed(c); await seedEvent(c) } })
    await send(request, 'PUT', '/api/events/ev/cover', { image: dataUrl(png(1600, 800, 1)) })
    expect((await send(request, 'DELETE', '/api/events/ev')).status).toBe(200)
    expect(await objectKeys(env as never)).toEqual([])
    expect(await row(client, 'ev')).toBeUndefined()
  })
})
