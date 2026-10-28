import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../../test/createTestApp'

const lead: TestUser = { id: 'lead-1', email: 'lead@student.apc.edu.ph', name: 'Lead', role: 'user' }
const other: TestUser = { id: 'other-1', email: 'other@student.apc.edu.ph', name: 'Other', role: 'user' }
const hdr = { 'Content-Type': 'application/json', Origin: 'https://eypi.cc', 'X-Active-Org-Id': 'org-1' }

async function seed(client: Client) {
  await client.execute({ sql: "INSERT INTO users (id, email, name) VALUES ('owner', 'owner@apc.edu.ph', 'o')", args: [] })
  for (const u of [lead, other]) {
    await client.execute({ sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)', args: [u.id, u.email, u.name] })
  }
  for (const org of ['org-1', 'org-2']) {
    await client.execute({ sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', args: [org, org, 'owner'] })
  }
  await client.execute({
    sql: "INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-1', ?, ?, CURRENT_TIMESTAMP)",
    args: [lead.email, lead.id],
  })
  await client.execute({
    sql: "INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES ('org-2', ?, ?, CURRENT_TIMESTAMP)",
    args: [other.email, other.id],
  })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, status)
          VALUES ('ev-1', 'ev', 'owner', 'Ev', '2099-01-01', '09:00', 'Hall', 'org-1', 1, 'published')`,
    args: [],
  })
  const rows: [string, string, string, string][] = [
    ['g1', '=cmd', 'Guest', 'confirmed'],
    ['g2', 'Bea', 'Two', 'confirmed'],
    ['g3', 'Cy', 'Three', 'cancelled'],
  ]
  for (const [id, first, last, status] of rows) {
    await client.execute({
      sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, status, registered_at)
            VALUES (?, 'ev-1', ?, ?, ?, ?, ?, '2026-01-01 00:00:00.000')`,
      args: [id, first, last, `${id}@x.test`, `qr-${id}`, status],
    })
  }
}

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const issue = (request: (p: string, i?: RequestInit) => Promise<Response>, id: string, slug = 'ev') =>
  request(`/api/events/${slug}/attendees/${id}/guest-link`, { method: 'POST', headers: hdr })
const tokenOf = (url: string) => url.replace('https://eypi.cc/t/', '')

describe('guest links', () => {
  it('issues a 32 char token and stores only its sha256', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    const res = await issue(request, 'g2')
    expect(res.status).toBe(200)
    const { url } = await res.json() as { url: string }
    expect(url).toMatch(/^https:\/\/eypi\.cc\/t\/[A-Za-z0-9_-]{32}$/)
    const token = tokenOf(url)
    const row = (await client.execute("SELECT guest_token_hash FROM attendees WHERE id = 'g2'")).rows[0]
    expect(row.guest_token_hash).toBe(await sha256Hex(token))
    const dump = JSON.stringify((await client.execute('SELECT * FROM attendees')).rows)
    expect(dump).not.toContain(token)
    const audit = await client.execute("SELECT target_id, meta FROM audit_events WHERE action = 'tix.guest_link'")
    expect(audit.rows).toHaveLength(1)
    expect(String(audit.rows[0].meta)).not.toContain(token)
  })

  it('serves the ticket publicly with private headers', async () => {
    const { request } = await createTestApp({ user: lead, seed })
    const { url } = await (await issue(request, 'g2')).json() as { url: string }
    const res = await request(`/api/tickets/guest/${tokenOf(url)}`, { headers: { Cookie: 'x=1' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    const body = await res.json() as { ticket: { id: string; qrToken: string; event: { slug: string } }; passToken: string }
    expect(body.ticket.id).toBe('g2')
    expect(body.ticket.qrToken).toBe('qr-g2')
    expect(body.passToken.split('.')).toHaveLength(3)
    expect(JSON.stringify(body)).not.toContain('x.test')
  })

  it('works with no session at all', async () => {
    const { request, client } = await createTestApp({ seed })
    await client.execute({ sql: "UPDATE attendees SET guest_token_hash = ? WHERE id = 'g2'", args: [await sha256Hex('a'.repeat(32))] })
    expect((await request(`/api/tickets/guest/${'a'.repeat(32)}`)).status).toBe(200)
  })

  it('rotated link returns 404 immediately', async () => {
    const { request } = await createTestApp({ user: lead, seed })
    const first = tokenOf((await (await issue(request, 'g2')).json() as { url: string }).url)
    const second = tokenOf((await (await issue(request, 'g2')).json() as { url: string }).url)
    expect(second).not.toBe(first)
    const old = await request(`/api/tickets/guest/${first}`)
    expect(old.status).toBe(404)
    expect((await request(`/api/tickets/guest/${second}`)).status).toBe(200)
  })

  it('cancelled guest ticket returns 404 with the same body as an unknown token', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    const token = tokenOf((await (await issue(request, 'g2')).json() as { url: string }).url)
    await client.execute("UPDATE attendees SET status = 'cancelled' WHERE id = 'g2'")
    const gone = await request(`/api/tickets/guest/${token}`)
    const unknown = await request(`/api/tickets/guest/${'z'.repeat(32)}`)
    expect(gone.status).toBe(404)
    expect(gone.headers.get('Cache-Control')).toBe('private, no-store')
    expect(gone.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(await gone.text()).toBe(await unknown.text())
  })

  it('refuses to issue for cancelled attendees and other events', async () => {
    const { request } = await createTestApp({ user: lead, seed })
    expect((await issue(request, 'g3')).status).toBe(409)
    expect((await issue(request, 'nope')).status).toBe(404)
  })

  it('rate limits the guest endpoint at 30 per IP, 31st is 429', async () => {
    const { request } = await createTestApp({ seed })
    const h = { 'CF-Connecting-IP': '203.0.113.7' }
    for (let i = 0; i < 30; i += 1) {
      expect((await request(`/api/tickets/guest/${'b'.repeat(32)}`, { headers: h })).status).toBe(404)
    }
    const res = await request(`/api/tickets/guest/${'b'.repeat(32)}`, { headers: h })
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: { code: 'too_many' } })
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    const elsewhere = await request(`/api/tickets/guest/${'b'.repeat(32)}`, { headers: { 'CF-Connecting-IP': '203.0.113.8' } })
    expect(elsewhere.status).toBe(404)
  })

  it('authz on issue: anonymous 401, other org 403', async () => {
    const anon = await createTestApp({ seed })
    expect([401, 403]).toContain((await issue(anon.request, 'g2')).status)
    const foreign = await createTestApp({ user: other, seed })
    const res = await foreign.request('/api/events/ev/attendees/g2/guest-link', {
      method: 'POST', headers: { ...hdr, 'X-Active-Org-Id': 'org-2' },
    })
    expect(res.status).toBe(403)
  })
})

describe('attendees.csv export', () => {
  it('has the exact header, guards formulas and issues links for confirmed guests only once', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    const res = await request('/api/events/ev/attendees.csv', { headers: hdr })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.csv"$/)
    const text = await res.text()
    const lines = text.trim().split('\r\n')
    expect(lines[0]).toBe('first_name,last_name,email,status,source,registered_at,answers_json,guest_link')
    expect(lines).toHaveLength(4)
    const g1 = lines.find((l) => l.includes('g1@x.test'))!
    expect(g1.startsWith("'=cmd,")).toBe(true)
    expect(g1).toContain('https://eypi.cc/t/')
    expect(lines.find((l) => l.includes('g3@x.test'))).not.toContain('https://eypi.cc/t/')
    const token = /https:\/\/eypi\.cc\/t\/([A-Za-z0-9_-]{32})/.exec(g1)![1]
    const hash = (await client.execute("SELECT guest_token_hash FROM attendees WHERE id = 'g1'")).rows[0].guest_token_hash
    expect(hash).toBe(await sha256Hex(token))
    // second export: tokens already exist, only hashes are stored, so links are blank and nothing rotates
    const again = (await (await request('/api/events/ev/attendees.csv', { headers: hdr })).text()).trim().split('\r\n')
    expect(again.find((l) => l.includes('g1@x.test'))).not.toContain('https://eypi.cc/t/')
    const still = (await client.execute("SELECT guest_token_hash FROM attendees WHERE id = 'g1'")).rows[0].guest_token_hash
    expect(still).toBe(hash)
  })

  it('authz: anonymous and other org refused', async () => {
    const anon = await createTestApp({ seed })
    expect([401, 403]).toContain((await anon.request('/api/events/ev/attendees.csv', { headers: hdr })).status)
    const foreign = await createTestApp({ user: other, seed })
    const res = await foreign.request('/api/events/ev/attendees.csv', { headers: { ...hdr, 'X-Active-Org-Id': 'org-2' } })
    expect(res.status).toBe(403)
  })
})

describe('csv export hardening', () => {
  it('requires the X-Active-Org-Id header and sends no-store', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    const { 'X-Active-Org-Id': _drop, ...noOrg } = hdr
    void _drop
    const res = await request('/api/events/ev/attendees.csv', { headers: noOrg })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'org_header_required' } })
    const issued = await client.execute('SELECT COUNT(*) AS n FROM attendees WHERE guest_token_hash IS NOT NULL')
    expect(Number(issued.rows[0].n)).toBe(0)
    const ok = await request('/api/events/ev/attendees.csv', { headers: hdr })
    expect(ok.headers.get('Cache-Control')).toBe('no-store')
  })

  it('guards a leading tab', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    await client.execute("UPDATE attendees SET first_name = char(9) || 'x' WHERE id = 'g2'")
    const text = await (await request('/api/events/ev/attendees.csv', { headers: hdr })).text()
    expect(text).toContain("'\tx,")
  })
})

describe('wallet pass gating', () => {
  it('issues passToken only for confirmed tickets', async () => {
    const { request, client } = await createTestApp({ user: lead, seed })
    await client.execute("UPDATE attendees SET status = 'pending' WHERE id = 'g2'")
    const { url } = await (await issue(request, 'g2')).json() as { url: string }
    const body = await (await request(`/api/tickets/guest/${tokenOf(url)}`)).json() as { passToken: string | null; ticket: { qrToken: string | null } }
    expect(body.passToken).toBeNull()
    expect(body.ticket.qrToken).toBeNull()
  })

  it('refuses a still-valid passToken once the attendee is cancelled', async () => {
    const { request, client, env } = await createTestApp({ user: lead, seed })
    const { url } = await (await issue(request, 'g2')).json() as { url: string }
    const { passToken } = await (await request(`/api/tickets/guest/${tokenOf(url)}`)).json() as { passToken: string }
    await client.execute("UPDATE attendees SET status = 'cancelled' WHERE id = 'g2'")
    const res = await request(`/api/events/ev/passes/google?token=${encodeURIComponent(passToken)}`)
    expect(res.status).toBe(404)
    expect(env).toBeDefined()
  })
})

describe('name lookup removed', () => {
  it('POST /api/events/:slug/lookup now 404s', async () => {
    const { request } = await createTestApp({ user: lead, seed })
    const res = await request('/api/events/ev/lookup', {
      method: 'POST', headers: hdr, body: JSON.stringify({ firstName: 'a', lastName: 'b', email: 'c@d.e' }),
    })
    expect(res.status).toBe(404)
  })
})
