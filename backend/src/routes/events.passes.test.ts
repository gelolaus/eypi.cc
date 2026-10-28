import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client'
import { exportPKCS8, generateKeyPair } from 'jose'
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

describe('pass download rate limits', () => {
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

      const blocked = await passDownload(request, 'passes', 'google', tokenA)
      expect(blocked.status).toBe(429)
      expect(await blocked.json()).toMatchObject({ status: 'error', message: TOO_MANY })

      const other = await passDownload(request, 'passes', 'google', tokenB)
      expect(other.status).not.toBe(429)

      const stored = await env.RATE_LIMIT_KV.get(`rl:pass:${ada.id}`)
      expect(stored?.startsWith('20:')).toBe(true)
    } finally {
      errorLog.mockRestore()
    }
  })
})

describe('removed attendee pass', () => {
  it('returns 404 for a removed attendee pass download', async () => {
    const removed = { ...person(1), id: 'att-removed', email: 'removed@x.com', first: 'Removed', last: 'Two' }
    const { request, env } = await createTestApp({
      seed: async (db) => {
        await seedEvent(db, { id: 'event-removed', slug: 'door' }, [removed])
        await db.execute({ sql: `UPDATE attendees SET status = 'cancelled' WHERE id = ?`, args: [removed.id] })
      },
    })
    const token = await signPassToken(env, { attendeeId: removed.id, eventId: 'event-removed', slug: 'door' })
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

describe('google wallet outage', () => {
  it('returns the wallet-unavailable sentence when the class update fails', async () => {
    const ada = { ...person(0), id: 'att-a', email: 'ada@x.com' }
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const { request, env } = await createTestApp({
      seed: (db) => seedEvent(db, { id: 'event-wallet', slug: 'launch' }, [ada]),
      env: {
        GOOGLE_WALLET_ISSUER_ID: 'issuer',
        GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: 'wallet@example.com',
        GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY: await exportPKCS8(privateKey),
      },
    })
    const token = await signPassToken(env, { attendeeId: ada.id, eventId: 'event-wallet', slug: 'launch' })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
      }
      if (method === 'GET') return new Response('{}', { status: 200 })
      return new Response('nope', { status: 500 })
    })

    try {
      const res = await passDownload(request, 'launch', 'google', token)
      expect(res.status).toBe(503)
      const body = await res.json() as { message?: string }
      expect(body.message).toBe('Wallet passes are not available right now.')
      expect(body.message).not.toContain('No ticket found')
    } finally {
      errorLog.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})

function passDownload(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  slug: string,
  kind: 'google',
  token: string,
) {
  return request(`/api/events/${slug}/passes/${kind}?token=${encodeURIComponent(token)}`, {
    headers: { 'CF-Connecting-IP': IP },
  })
}
