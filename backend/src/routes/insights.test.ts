import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const member: TestUser = { id: 'mem-1', email: 'mem@student.apc.edu.ph', name: 'Mem', role: 'user' }
const outsider: TestUser = { id: 'out-1', email: 'out@student.apc.edu.ph', name: 'Out', role: 'user' }
const headers = { Origin: 'https://eypi.cc', 'X-Active-Org-Id': 'org-1' }
const NOW = '2026-10-26T02:00:00Z' // 10:00 on 2026-10-26 in Manila

async function seedOrgs(client: Client) {
  for (const [id, email] of [['mem-1', member.email], ['out-1', outsider.email], ['owner', 'owner@apc.edu.ph']]) {
    await client.execute({ sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)', args: [id, email, id] })
  }
  for (const org of ['org-1', 'org-2']) {
    await client.execute({ sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', args: [org, org, 'owner'] })
  }
  await client.execute({
    sql: "INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-1', ?, 'mem-1', CURRENT_TIMESTAMP)",
    args: [member.email],
  })
  await client.execute({
    sql: "INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-2', ?, 'out-1', CURRENT_TIMESTAMP)",
    args: [outsider.email],
  })
}

async function daily(client: Client, subject: string, action: string, day: string, n: number) {
  await client.execute({
    sql: "INSERT INTO module_daily (subject_id, module, action, day, n, uniques) VALUES (?, 'frames', ?, ?, ?, ?)",
    args: [subject, action, day, n, n],
  })
}

async function raw(client: Client, subject: string, action: string, day: string, count = 1) {
  for (let i = 0; i < count; i++) {
    await client.execute({
      sql: "INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day) VALUES ('org-1', 'frames', ?, ?, ?, ?)",
      args: [subject, action, `v${i}`, day],
    })
  }
}

afterEach(() => vi.useRealTimers())

async function framesApp(seed?: (client: Client) => Promise<void>, user: TestUser | null = member) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  return createTestApp({
    user: user ?? undefined,
    seed: async (client) => {
      await seedOrgs(client)
      for (const [id, org] of [['camp1', 'org-1'], ['camp10', 'org-1'], ['campx', 'org-2']]) {
        await client.execute({
          sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES (?, 'owner', ?, ?, ?, '')",
          args: [id, org, id, id],
        })
      }
      for (const [id, camp, label, pos] of [['f1', 'camp1', 'Blue', 0], ['f2', 'camp1', null, 1]] as const) {
        await client.execute({
          sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
          args: [id, camp, 'frames/x', label, pos],
        })
      }
      if (seed) await seed(client)
    },
  })
}

describe('GET /api/dp/:id/insights', () => {
  it('builds the funnel from rollups, today from raw rows, and ignores look-alike campaign ids', async () => {
    const { request } = await framesApp(async (client) => {
      await daily(client, 'camp1', 'view', '2026-10-24', 10)
      await daily(client, 'camp1', 'photo_added', '2026-10-24', 6)
      await daily(client, 'camp1', 'download', '2026-10-24', 99) // a bare-subject download is still a download
      await daily(client, 'camp1:f1', 'download', '2026-10-24', 3)
      await daily(client, 'camp1:f2', 'share', '2026-10-25', 1)
      await daily(client, 'camp1', 'view', '2026-10-25', 10)
      // a different campaign whose id shares a prefix must not leak in
      await daily(client, 'camp10', 'view', '2026-10-25', 500)
      await daily(client, 'camp10:f9', 'download', '2026-10-25', 500)
      // today: a stale rollup row must not be read; raw rows are
      await daily(client, 'camp1', 'view', '2026-10-26', 1000)
      await raw(client, 'camp1', 'view', '2026-10-26', 4)
      await raw(client, 'camp1:f1', 'download', '2026-10-26', 2)
    })
    const res = await request('/api/dp/camp1/insights?days=30', { headers })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      funnel: { view: number; photo_added: number; downloadOrShare: number }
      conversion: number
      perFrame: { frameId: string; label: string; downloads: number }[]
      daily: { day: string; views: number; downloads: number }[]
    }
    expect(body.funnel).toEqual({ view: 24, photo_added: 6, downloadOrShare: 105 })
    expect(body.conversion).toBe(1) // downloads can exceed views (bare-subject rows), the rate is capped
    expect(body.perFrame).toEqual([
      { frameId: 'f1', label: 'Blue', downloads: 5 },
      { frameId: 'f2', label: 'Frame 2', downloads: 1 },
    ])
    expect(body.daily).toHaveLength(30)
    expect(body.daily.at(-1)).toEqual({ day: '2026-10-26', views: 4, downloads: 2 })
    expect(body.daily.find((d) => d.day === '2026-10-24')).toEqual({ day: '2026-10-24', views: 10, downloads: 102 })
  })

  it('does not match campaign ids that only look alike (underscore is not a wildcard)', async () => {
    const { request } = await framesApp(async (client) => {
      await client.execute({
        sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES ('camp_1', 'owner', 'org-1', 'u', 'u', '')",
        args: [],
      })
      await daily(client, 'camp_1', 'view', '2026-10-25', 3)
      await daily(client, 'camp_1:f1', 'download', '2026-10-25', 1)
      await daily(client, 'camp11', 'view', '2026-10-25', 50)
      await daily(client, 'camp11:f1', 'download', '2026-10-25', 50)
      await daily(client, 'camp1', 'view', '2026-10-25', 7)
      await raw(client, 'camp11', 'view', '2026-10-26', 9)
    })
    const body = await (await request('/api/dp/camp_1/insights', { headers })).json() as { funnel: { view: number; downloadOrShare: number } }
    expect(body.funnel).toMatchObject({ view: 3, downloadOrShare: 1 })
  })

  it('respects the days window', async () => {
    const { request } = await framesApp(async (client) => {
      await daily(client, 'camp1', 'view', '2026-10-20', 7)
      await daily(client, 'camp1', 'view', '2026-10-25', 2)
    })
    const body = await (await request('/api/dp/camp1/insights?days=3', { headers })).json() as { funnel: { view: number }; daily: unknown[] }
    expect(body.funnel.view).toBe(2)
    expect(body.daily).toHaveLength(3)
  })

  it('returns conversion 0, not NaN, when there are no views', async () => {
    const { request } = await framesApp()
    const body = await (await request('/api/dp/camp1/insights', { headers })).json() as { conversion: number; funnel: { view: number } }
    expect(body.funnel.view).toBe(0)
    expect(body.conversion).toBe(0)
  })

  it.each(['0', '401', 'abc', '1.5', '-3'])('rejects days=%s', async (days) => {
    const { request } = await framesApp()
    const res = await request(`/api/dp/camp1/insights?days=${days}`, { headers })
    expect(res.status).toBe(400)
  })

  it('is for org members only', async () => {
    const { request } = await framesApp(undefined, outsider)
    const h = { ...headers, 'X-Active-Org-Id': 'org-2' }
    expect((await request('/api/dp/camp1/insights', { headers: h })).status).toBe(403)
    expect((await request('/api/dp/nope/insights', { headers: h })).status).toBe(404)
  })

  it('rejects anonymous callers', async () => {
    const { request } = await framesApp(undefined, null)
    expect((await request('/api/dp/camp1/insights')).status).toBe(401)
  })
})

async function tixApp(seed?: (client: Client) => Promise<void>, user: TestUser | null = member) {
  return createTestApp({
    user: user ?? undefined,
    seed: async (client) => {
      await seedOrgs(client)
      const questions = JSON.stringify([
        { id: 'year', label: 'Year', type: 'choice', options: ['1st', '2nd', '3rd'], required: true },
        { id: 'diet', label: 'Diet', type: 'checkbox', options: ['veg', 'halal'], required: false },
        { id: 'why', label: 'Why', type: 'text', required: false },
      ])
      for (const [slug, org] of [['door', 'org-1'], ['empty', 'org-1'], ['other', 'org-2']]) {
        await client.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status, admission_mode, questions)
                VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, 'published', 'approval', ?)`,
          args: [`id-${slug}`, slug, org, questions],
        })
      }
      if (seed) await seed(client)
    },
  })
}

async function attendee(client: Client, id: string, status: string, registeredAt: string, answers: unknown = {}, event = 'door') {
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at, answers)
          VALUES (?, ?, ?, 'L', ?, ?, ?, ?, ?)`,
    args: [id, `id-${event}`, id, `${id}@x.test`, `qr-${id}`, status, registeredAt, JSON.stringify(answers)],
  })
}

async function checkIn(client: Client, id: string, attendeeId: string, action: string, at: string) {
  await client.execute({
    sql: "INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at) VALUES (?, ?, 'id-door', ?, ?)",
    args: [id, attendeeId, action, at],
  })
}

describe('GET /api/events/:slug/insights', () => {
  it('computes status, daily registrations (Manila), answers, show-up rate and the check-in curve', async () => {
    const { request } = await tixApp(async (client) => {
      // 2026-10-24 17:00 UTC is already 2026-10-25 01:00 in Manila
      await attendee(client, 'a1', 'confirmed', '2026-10-24 17:00:00', { year: '1st', diet: ['veg', 'halal'], why: 'fun' })
      await attendee(client, 'a2', 'confirmed', '2026-10-25 03:00:00', { year: '1st' })
      await attendee(client, 'a3', 'confirmed', '2026-10-25 04:00:00', { year: '2nd' })
      await attendee(client, 'a4', 'confirmed', '2026-10-25 05:00:00', {})
      await attendee(client, 'p1', 'pending', '2026-10-25 06:00:00', { year: '3rd' })
      await attendee(client, 'c1', 'cancelled', '2026-10-26 06:00:00', { year: '3rd' })
      await attendee(client, 'o1', 'confirmed', '2026-10-25 06:00:00', {}, 'other')
      // 01:05 UTC = 09:05 Manila (09:00 bucket); 01:14 = 09:14 (09:10 bucket); a3 checks in twice, only the first counts
      await checkIn(client, 'k1', 'a1', 'checked_in', '2026-10-26 01:05:00.000')
      await checkIn(client, 'k2', 'a2', 'checked_in', '2026-10-26 01:14:00.000')
      await checkIn(client, 'k3', 'a3', 'checked_in', '2026-10-26 01:06:00.000')
      await checkIn(client, 'k4', 'a3', 'checked_out', '2026-10-26 01:30:00.000')
      await checkIn(client, 'k5', 'a3', 'checked_in', '2026-10-26 02:00:00.000')
    })
    const res = await request('/api/events/door/insights', { headers })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      byStatus: { status: string; n: number }[]
      registrationsDaily: { day: string; n: number }[]
      byAnswer: { questionId: string; options: { value: string; n: number }[] }[]
      showUpRate: number | null
      checkInCurve: { bucket: string; n: number }[]
    }
    expect(body.byStatus).toEqual([
      { status: 'pending', n: 1 },
      { status: 'confirmed', n: 4 },
      { status: 'cancelled', n: 1 },
    ])
    expect(body.registrationsDaily).toEqual([
      { day: '2026-10-25', n: 5 },
      { day: '2026-10-26', n: 1 },
    ])
    expect(body.byAnswer).toEqual([
      { questionId: 'year', options: [{ value: '1st', n: 2 }, { value: '2nd', n: 1 }, { value: '3rd', n: 1 }] },
      { questionId: 'diet', options: [{ value: 'veg', n: 1 }, { value: 'halal', n: 1 }] },
    ])
    expect(body.showUpRate).toBeCloseTo(3 / 4)
    expect(body.checkInCurve).toEqual([
      { bucket: '09:00', n: 2 },
      { bucket: '09:10', n: 1 },
    ])
  })

  it('returns a null show-up rate and empty lists when nobody is confirmed', async () => {
    const { request } = await tixApp()
    const body = await (await request('/api/events/empty/insights', { headers })).json() as Record<string, unknown>
    expect(body.showUpRate).toBeNull()
    expect(body.byStatus).toEqual([])
    expect(body.registrationsDaily).toEqual([])
    expect(body.checkInCurve).toEqual([])
  })

  it('is for org members only', async () => {
    const { request } = await tixApp(undefined, outsider)
    const h = { ...headers, 'X-Active-Org-Id': 'org-2' }
    expect((await request('/api/events/door/insights', { headers: h })).status).toBe(403)
    expect((await request('/api/events/nope/insights', { headers: h })).status).toBe(404)
  })

  it('rejects anonymous callers', async () => {
    const { request } = await tixApp(undefined, null)
    expect((await request('/api/events/door/insights')).status).toBe(401)
  })
})

describe('show-up rate with door check-outs', () => {
  it('counts a confirmed attendee who checked in and then out as shown up', async () => {
    const { request } = await tixApp(async (client) => {
      await attendee(client, 'a1', 'confirmed', '2026-10-25 03:00:00')
      await attendee(client, 'a2', 'confirmed', '2026-10-25 03:00:00')
      await checkIn(client, 'k1', 'a1', 'checked_in', '2026-10-26 01:05:00.000')
      await checkIn(client, 'k2', 'a1', 'checked_out', '2026-10-26 01:30:00.000')
    })
    const body = await (await request('/api/events/door/insights', { headers })).json() as { showUpRate: number | null; checkInCurve: { n: number }[] }
    expect(body.showUpRate).toBe(0.5)
    expect(body.checkInCurve.reduce((sum, b) => sum + b.n, 0)).toBe(1)
  })
})

async function orgApp(seed?: (client: Client) => Promise<void>, user: TestUser | null = member) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  return createTestApp({
    user: user ?? undefined,
    seed: async (client) => {
      await seedOrgs(client)
      for (const [id, org] of [['camp1', 'org-1'], ['camp10', 'org-1'], ['campx', 'org-2']]) {
        await client.execute({
          sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES (?, 'owner', ?, ?, ?, '')",
          args: [id, org, id, id],
        })
      }
      for (const [slug, org] of [['e1', 'org-1'], ['e2', 'org-1'], ['ex', 'org-2']]) {
        await client.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status, admission_mode)
                VALUES (?, ?, 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', ?, 1, 'published', 'approval')`,
          args: [`id-${slug}`, slug, org],
        })
      }
      if (seed) await seed(client)
    },
  })
}

async function orgDaily(client: Client, moduleName: string, subject: string, action: string, day: string, n: number) {
  await client.execute({
    sql: 'INSERT INTO module_daily (subject_id, module, action, day, n, uniques) VALUES (?, ?, ?, ?, ?, ?)',
    args: [subject, moduleName, action, day, n, n],
  })
}

async function orgRaw(client: Client, moduleName: string, subject: string, action: string, day: string, count: number) {
  for (let i = 0; i < count; i++) {
    await client.execute({
      sql: 'INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['org-1', moduleName, subject, action, `v${i}`, day],
    })
  }
}

async function orgAttendee(client: Client, id: string, event: string, status: string) {
  await client.execute({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at)
          VALUES (?, ?, ?, 'L', ?, ?, ?, '2026-10-25 03:00:00')`,
    args: [id, `id-${event}`, id, `${id}@x.test`, `qr-${id}`, status],
  })
}

describe('GET /api/orgs/:org_id/insights', () => {
  it('totals profile views, frames, tix and the member trend for the org only', async () => {
    const { request } = await orgApp(async (client) => {
      await orgDaily(client, 'org', 'org-1', 'view', '2026-10-24', 5)
      await orgDaily(client, 'org', 'org-1', 'view', '2026-10-26', 99) // today's rollup row is never read
      await orgDaily(client, 'org', 'org-2', 'view', '2026-10-24', 40)
      await orgRaw(client, 'org', 'org-1', 'view', '2026-10-26', 3)
      await orgDaily(client, 'frames', 'camp1', 'view', '2026-10-25', 10)
      await orgDaily(client, 'frames', 'camp10:f1', 'download', '2026-10-25', 4)
      await orgDaily(client, 'frames', 'camp1:f1', 'share', '2026-10-24', 2)
      await orgDaily(client, 'frames', 'camp1', 'view', '2026-01-01', 1000) // outside 30 days
      await orgDaily(client, 'frames', 'campx', 'view', '2026-10-25', 500)
      await orgRaw(client, 'frames', 'camp1', 'view', '2026-10-26', 2)
      await orgAttendee(client, 'a1', 'e1', 'confirmed')
      await orgAttendee(client, 'a2', 'e1', 'pending')
      await orgAttendee(client, 'a3', 'e2', 'cancelled')
      await orgAttendee(client, 'a4', 'e2', 'declined')
      await orgAttendee(client, 'a5', 'e2', 'confirmed')
      await orgAttendee(client, 'ax', 'ex', 'confirmed')
      for (const [id, a, action] of [['k1', 'a1', 'checked_in'], ['k2', 'a1', 'checked_out'], ['k3', 'a1', 'checked_in'], ['k4', 'a5', 'checked_in']]) {
        await client.execute({
          sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)',
          args: [id, a, a === 'a1' ? 'id-e1' : 'id-e2', action],
        })
      }
      await client.execute({ sql: "UPDATE org_members SET activated_at = '2026-10-24 17:00:00' WHERE user_id = 'mem-1'", args: [] })
      await client.execute({
        sql: "INSERT INTO org_members (org_id, email, activated_at) VALUES ('org-1', 'pending@x.test', NULL)",
        args: [],
      })
    })
    const res = await request('/api/orgs/org-1/insights', { headers })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await res.json() as {
      profileViews: { total: number; daily: { day: string; n: number }[] }
      frames: { campaigns: number; views: number; downloads: number }
      tix: { events: number; registrations: number; checkIns: number }
      members: { daily: { day: string; count: number }[] }
    }
    expect(body.profileViews.total).toBe(8)
    expect(body.profileViews.daily).toHaveLength(30)
    expect(body.profileViews.daily.at(-1)).toEqual({ day: '2026-10-26', n: 3 })
    expect(body.profileViews.daily.find((d) => d.day === '2026-10-24')).toEqual({ day: '2026-10-24', n: 5 })
    expect(body.frames).toEqual({ campaigns: 2, views: 12, downloads: 6 })
    expect(body.tix).toEqual({ events: 2, registrations: 3, checkIns: 2 })
    expect(body.members.daily).toHaveLength(30)
    // cumulative activated members at the end of each Manila day
    expect(body.members.daily.find((d) => d.day === '2026-10-24')).toEqual({ day: '2026-10-24', count: 0 })
    expect(body.members.daily.find((d) => d.day === '2026-10-25')).toEqual({ day: '2026-10-25', count: 1 })
    expect(body.members.daily.at(-1)).toEqual({ day: '2026-10-26', count: 1 })
  })

  it('exposes only aggregate keys: no links data, names or emails', async () => {
    const { request } = await orgApp()
    const res = await request('/api/orgs/org-1/insights?days=7', { headers })
    const body = await res.json() as Record<string, Record<string, unknown>>
    expect(Object.keys(body).sort()).toEqual(['frames', 'members', 'profileViews', 'tix'])
    expect(Object.keys(body.profileViews).sort()).toEqual(['daily', 'total'])
    expect(Object.keys(body.frames).sort()).toEqual(['campaigns', 'downloads', 'views'])
    expect(Object.keys(body.tix).sort()).toEqual(['checkIns', 'events', 'registrations'])
    expect(Object.keys(body.members)).toEqual(['daily'])
    const memberDaily = body.members.daily as unknown as Record<string, unknown>[]
    expect(Object.keys(memberDaily[0]).sort()).toEqual(['count', 'day'])
    const viewDaily = body.profileViews.daily as unknown as Record<string, unknown>[]
    expect(Object.keys(viewDaily[0]).sort()).toEqual(['day', 'n'])
    const text = JSON.stringify(body)
    expect(text).not.toContain('@')
    expect(text).not.toContain('mem-1')
  })

  it('rejects non-members and anonymous callers, and 404s unknown orgs', async () => {
    const outsiderApp = await orgApp(undefined, outsider)
    const denied = await outsiderApp.request('/api/orgs/org-1/insights', { headers })
    expect(denied.status).toBe(403)
    expect((await denied.json() as { error: { code: string } }).error.code).toBe('forbidden')
    expect((await outsiderApp.request('/api/orgs/nope/insights', { headers })).status).toBe(404)
    const anon = await orgApp(undefined, null)
    expect((await anon.request('/api/orgs/org-1/insights')).status).toBe(401)
  })

  it('does not treat an invited but not activated member as a member', async () => {
    const { request } = await orgApp(async (client) => {
      await client.execute({ sql: "UPDATE org_members SET activated_at = NULL WHERE user_id = 'mem-1'", args: [] })
    })
    expect((await request('/api/orgs/org-1/insights', { headers })).status).toBe(403)
  })

  it('validates days', async () => {
    const { request } = await orgApp()
    expect((await request('/api/orgs/org-1/insights?days=0', { headers })).status).toBe(400)
  })

  it('lets the owner in without an org_members row', async () => {
    const owner: TestUser = { id: 'owner', email: 'owner@apc.edu.ph', name: 'Owner', role: 'user' }
    const { request } = await orgApp(undefined, owner)
    expect((await request('/api/orgs/org-1/insights', { headers })).status).toBe(200)
  })

  it('returns a single day for days=1, counting today only', async () => {
    const { request } = await orgApp(async (client) => {
      await orgDaily(client, 'org', 'org-1', 'view', '2026-10-25', 8)
      await orgRaw(client, 'org', 'org-1', 'view', '2026-10-26', 2)
    })
    const body = await (await request('/api/orgs/org-1/insights?days=1', { headers })).json() as {
      profileViews: { total: number; daily: { day: string; n: number }[] }
      members: { daily: unknown[] }
    }
    expect(body.profileViews.daily).toEqual([{ day: '2026-10-26', n: 2 }])
    expect(body.profileViews.total).toBe(2)
    expect(body.members.daily).toHaveLength(1)
  })
})
