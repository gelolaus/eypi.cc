import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'

const student: TestUser = { id: 'stu-1', email: 'stu1@student.apc.edu.ph', name: 'Sam Student', role: 'user' }

type Seed = {
  slug?: string
  mode?: string
  status?: string
  max?: number | null
  description?: string | null
  cover?: string | null
  questions?: unknown[]
}

async function seed(client: Client, o: Seed = {}) {
  const slug = o.slug ?? 'ev'
  await client.execute({ sql: "INSERT OR IGNORE INTO users (id, email, name) VALUES ('owner', 'owner@apc.edu.ph', 'Owner')", args: [] })
  await client.execute({ sql: "INSERT OR IGNORE INTO organizations (id, name, owner_id) VALUES ('org-1', 'Alpha', 'owner')", args: [] })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, end_time, location, org_id,
            selection_locked, status, admission_mode, max_attendees, waitlist_enabled, description, cover_key, cover_meta, questions)
          VALUES (?, ?, 'owner', 'Fest', '2099-01-01', '09:00', '11:00', 'Hall', 'org-1', 1, ?, ?, ?, 1, ?, ?, NULL, ?)`,
    args: [`id-${slug}`, slug, o.status ?? 'published', o.mode ?? 'fcfs', o.max === undefined ? 3 : o.max, o.description ?? null, o.cover ?? null, JSON.stringify(o.questions ?? [])],
  })
}

async function attend(client: Client, slug: string, n: number, status = 'confirmed', userId: string | null = null) {
  for (let i = 0; i < n; i++) {
    await client.execute({
      sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, user_id, status, source, registered_at)
            VALUES (?, ?, 'A', 'B', ?, ?, ?, ?, 'self', CURRENT_TIMESTAMP)`,
      args: [`${slug}-${status}-${i}-${userId}`, `id-${slug}`, `p${i}${status}@x.test`, `qr-${slug}-${status}-${i}`, i === 0 ? userId : null, status],
    })
  }
}

describe('GET /api/events/:slug/public', () => {
  it('serves a published event to an anonymous visitor with no viewer ticket', async () => {
    const { request } = await createTestApp({ seed: (c) => seed(c, { cover: 'events/id-ev/cover-ab.webp', description: 'Hello **you**' }) })
    const res = await request('/api/events/ev/public')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('max-age=30')
    const body = await res.json() as { event: Record<string, unknown>; viewer: { ticket: unknown } }
    expect(body.event).toMatchObject({
      slug: 'ev', name: 'Fest', eventDate: '2099-01-01', eventTime: '09:00', endTime: '11:00', location: 'Hall',
      descriptionHtml: '<p>Hello <strong>you</strong></p>', coverUrl: '/media/events/id-ev/cover-ab.webp', coverMeta: null,
      admissionMode: 'fcfs', waitlistEnabled: true, status: 'published', org: { slug: 'org-1', name: 'Alpha' },
    })
    expect(body.event).not.toHaveProperty('id')
    expect(body.viewer).toEqual({ ticket: null })
  })

  it('includes the registration questions', async () => {
    const questions = [
      { id: 'q1', label: 'Year level', type: 'choice', options: ['1', '2'], required: true },
      { id: 'q2', label: 'Allergies', type: 'text', required: false },
    ]
    const { request } = await createTestApp({ seed: async (c) => { await seed(c, { questions }); await seed(c, { slug: 'none' }) } })
    const body = await (await request('/api/events/ev/public')).json() as { event: { questions: unknown } }
    expect(body.event.questions).toEqual(questions)
    expect(((await (await request('/api/events/none/public')).json()) as { event: { questions: unknown } }).event.questions).toEqual([])
  })

  it('404s drafts and unknown slugs, even for an org member', async () => {
    const { request } = await createTestApp({ user: student, seed: async (c) => { await seed(c, { status: 'draft' }) } })
    expect((await request('/api/events/ev/public')).status).toBe(404)
    expect((await request('/api/events/nope/public')).status).toBe(404)
  })

  it('shows closed and cancelled events with their status', async () => {
    const { request } = await createTestApp({
      seed: async (c) => { await seed(c, { slug: 'c1', status: 'closed' }); await seed(c, { slug: 'c2', status: 'cancelled' }) },
    })
    expect(((await (await request('/api/events/c1/public')).json()) as { event: { status: string } }).event.status).toBe('closed')
    expect(((await (await request('/api/events/c2/public')).json()) as { event: { status: string } }).event.status).toBe('cancelled')
  })

  it('reports seatsLeft only for fcfs with a capacity, counting confirmed seats', async () => {
    const { request } = await createTestApp({
      seed: async (c) => {
        await seed(c, { slug: 'f', mode: 'fcfs', max: 3 })
        await attend(c, 'f', 2)
        await attend(c, 'f', 4, 'waitlisted')
        await seed(c, { slug: 'nocap', mode: 'fcfs', max: null })
        await seed(c, { slug: 'lot', mode: 'lottery', max: 3 })
        await seed(c, { slug: 'full', mode: 'fcfs', max: 1 })
        await attend(c, 'full', 2)
      },
    })
    const seats = async (slug: string) => ((await (await request(`/api/events/${slug}/public`)).json()) as { event: { seatsLeft: number | null } }).event.seatsLeft
    expect(await seats('f')).toBe(1)
    expect(await seats('nocap')).toBeNull()
    expect(await seats('lot')).toBeNull()
    expect(await seats('full')).toBe(0)
  })

  it('strips script and event handlers from the description', async () => {
    const { request } = await createTestApp({
      seed: (c) => seed(c, { description: 'Hi <script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1))' }),
    })
    const html = ((await (await request('/api/events/ev/public')).json()) as { event: { descriptionHtml: string } }).event.descriptionHtml
    expect(html).not.toMatch(/<script|<img|<[^>]*onerror|href="javascript/i)
  })

  it('includes the signed-in viewer ticket, is not cacheable, and needs no org membership', async () => {
    const { request } = await createTestApp({ user: student, seed: async (c) => { await seed(c); await c.execute({ sql: "INSERT OR IGNORE INTO users (id, email, name) VALUES ('stu-1', 'stu1@student.apc.edu.ph', 'Sam')", args: [] }); await attend(c, 'ev', 1, 'confirmed', 'stu-1') } })
    const res = await request('/api/events/ev/public')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await res.json() as { viewer: { ticket: { status: string; qrToken: string } | null } }
    expect(body.viewer.ticket).toMatchObject({ status: 'confirmed' })
  })

  it('answers the org-scoped GET /api/events/:slug with 401 for anonymous callers', async () => {
    const { request } = await createTestApp({ seed: (c) => seed(c) })
    expect((await request('/api/events/ev')).status).toBe(401)
  })
})
