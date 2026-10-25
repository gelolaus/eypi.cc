import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { signPassToken } from '../lib/passes/context'
import { createTestApp, type TestUser } from '../test/createTestApp'

const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.'
const IP = '203.0.113.10'

const lead: TestUser = {
  id: 'user-lead',
  email: 'lead@student.apc.edu.ph',
  name: 'Lead',
  role: 'user',
}

type Person = { id: string; first: string; last: string; email: string }

function person(index: number): Person {
  return {
    id: `att-${index}`,
    first: 'Stu',
    last: String(index),
    email: `stu${index}@x.com`,
  }
}

async function seedOrg(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: [lead.id, lead.email, lead.name],
  })
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
    args: ['org-1', 'Alpha', lead.id],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', lead.email, lead.id, '2026-01-01T00:00:00Z'],
  })
}

async function seedEvent(
  client: Client,
  event: { id: string; slug: string; passFields?: string },
  people: Person[],
) {
  await seedOrg(client)
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, pass_fields)
          VALUES (?, ?, ?, 'Launch', '2026-11-01', '09:00', 'Hall', 'org-1', 1, ?)`,
    args: [event.id, event.slug, lead.id, event.passFields ?? '[]'],
  })
  if (people.length === 0) return
  await client.batch(people.map((attendee) => ({
    sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [attendee.id, event.id, attendee.first, attendee.last, attendee.email, `qr-${attendee.id}`],
  })))
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('ticket lookup rate limits', () => {
  it('allows 60 different students from one IP and rejects the next', async () => {
    const people = Array.from({ length: 61 }, (_, index) => person(index))
    const { request } = await createTestApp({
      seed: (db) => seedEvent(db, { id: 'event-ip', slug: 'door' }, people),
    })

    const statuses: number[] = []
    for (const attendee of people.slice(0, 60)) {
      const res = await lookup(request, 'door', attendee)
      statuses.push(res.status)
    }

    expect(statuses.every((status) => status === 200)).toBe(true)

    const blocked = await lookup(request, 'door', people[60])
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toMatchObject({ status: 'error', message: TOO_MANY })
  })

  it('rejects the 11th lookup of one email and still allows a different email', async () => {
    const ada = person(0)
    ada.email = 'ada@x.com'
    const grace = person(1)
    grace.email = 'grace@x.com'
    const { request, env } = await createTestApp({
      seed: (db) => seedEvent(db, { id: 'event-email', slug: 'door' }, [ada, grace]),
    })

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await lookup(request, 'door', ada)
      expect(res.status).toBe(200)
    }

    const blocked = await lookup(request, 'door', ada)
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toMatchObject({ status: 'error', message: TOO_MANY })

    const other = await lookup(request, 'door', grace)
    expect(other.status).toBe(200)

    const emailHash = await sha256Hex('ada@x.com')
    const stored = await env.RATE_LIMIT_KV.get(`lookup:event-email:${emailHash}`)
    expect(stored?.startsWith('10:')).toBe(true)
  })

  it('allows 20 pass downloads for one attendee and rejects the next without blocking another', async () => {
    const ada = { ...person(0), id: 'att-a', email: 'ada@x.com' }
    const grace = { ...person(1), id: 'att-b', email: 'grace@x.com' }
    const { request, env } = await createTestApp({
      seed: (db) => seedEvent(db, { id: 'event-pass', slug: 'passes' }, [ada, grace]),
    })
    const tokenA = await signPassToken(env, { attendeeId: ada.id, eventId: 'event-pass', slug: 'passes' })
    const tokenB = await signPassToken(env, { attendeeId: grace.id, eventId: 'event-pass', slug: 'passes' })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const res = await passDownload(request, 'passes', 'google', tokenA)
        expect(res.status).not.toBe(429)
      }

      const blocked = await passDownload(request, 'passes', 'apple', tokenA)
      expect(blocked.status).toBe(429)
      expect(await blocked.json()).toMatchObject({ status: 'error', message: TOO_MANY })

      const other = await passDownload(request, 'passes', 'google', tokenB)
      expect(other.status).not.toBe(429)

      const stored = await env.RATE_LIMIT_KV.get(`pass:${ada.id}`)
      expect(stored?.startsWith('20:')).toBe(true)
    } finally {
      errorLog.mockRestore()
    }
  })
})

describe('removed attendee lookup', () => {
  it('returns 404 for a removed attendee and still finds an active one', async () => {
    const active = { ...person(0), id: 'att-active', email: 'active@x.com', first: 'Active', last: 'One' }
    const removed = { ...person(1), id: 'att-removed', email: 'removed@x.com', first: 'Removed', last: 'Two' }
    const { request, env } = await createTestApp({
      seed: async (db) => {
        await seedEvent(db, { id: 'event-removed', slug: 'door' }, [active, removed])
        await db.execute({
          sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
                VALUES (?, ?, ?, 'removed', ?)`,
          args: ['check-1', removed.id, 'event-removed', '2026-10-25 00:00:00'],
        })
      },
    })

    const denied = await lookup(request, 'door', removed)
    expect(denied.status).toBe(404)
    const deniedBody = await denied.json() as { passToken?: string }
    expect(deniedBody.passToken).toBeUndefined()

    const allowed = await lookup(request, 'door', active)
    expect(allowed.status).toBe(200)

    const token = await signPassToken(env, {
      attendeeId: removed.id,
      eventId: 'event-removed',
      slug: 'door',
    })
    const pass = await passDownload(request, 'door', 'google', token)
    expect(pass.status).toBe(404)
  })
})

describe('pass field allowlist', () => {
  it('saves the lead pass field list on the event', async () => {
    const { request } = await createTestApp({
      user: lead,
      seed: (db) => seedEvent(db, { id: 'event-fields', slug: 'launch' }, []),
    })

    const saved = await request('/api/events/launch', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://eypi.cc',
        'X-Active-Org-Id': 'org-1',
      },
      body: JSON.stringify({ passFields: ['section', 'phone'] }),
    })
    expect(saved.status).toBe(200)

    const got = await request('/api/events/launch', {
      headers: { 'X-Active-Org-Id': 'org-1' },
    })
    expect(got.status).toBe(200)
    const body = await got.json() as { event: { passFields?: string[] } }
    expect(body.event.passFields).toEqual(['section', 'phone'])
  })
})

function lookup(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  slug: string,
  attendee: Pick<Person, 'first' | 'last' | 'email'>,
) {
  return request(`/api/events/${slug}/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://eypi.cc',
      'CF-Connecting-IP': IP,
    },
    body: JSON.stringify({
      firstName: attendee.first,
      lastName: attendee.last,
      email: attendee.email,
    }),
  })
}

function passDownload(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  slug: string,
  kind: 'apple' | 'google',
  token: string,
) {
  return request(`/api/events/${slug}/passes/${kind}?token=${encodeURIComponent(token)}`, {
    headers: { 'CF-Connecting-IP': IP },
  })
}
