import { describe, expect, it } from 'vitest'
import { hmacIp } from '../lib/ipHash'
import { createTestApp } from '../test/createTestApp'

const IP_HASH_SECRET = 'test-ip-hash-secret'
const REPORTER_IP = '203.0.113.9'

const LINK_REPORTS_SQL = `
CREATE TABLE link_reports (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
  slug TEXT,
  reason TEXT,
  details TEXT,
  reporter_ip_hash TEXT,
  reporter_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution TEXT
)`

async function reportsHarness() {
  const harness = await createTestApp({
    env: { IP_HASH_SECRET },
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        args: ['user-1', 'owner@student.apc.edu.ph', 'Owner'],
      })
      await client.execute({
        sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
        args: ['link-1', 'user-1', 'https://example.com/dest', 'promo'],
      })
    },
  })
  const existing = await harness.client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'link_reports'",
  )
  if (existing.rows.length === 0) {
    await harness.client.execute(LINK_REPORTS_SQL)
  }
  return harness
}

function report(reason: string, extra: Record<string, unknown> = {}, ip = REPORTER_IP) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      Origin: 'https://eypi.cc',
    },
    body: JSON.stringify({ slug: 'promo', reason, ...extra }),
  } satisfies RequestInit
}

describe('POST /api/reports', () => {
  it('rejects an invalid reason with a field error', async () => {
    const { request } = await reportsHarness()

    const res = await request('/api/reports', report('not-a-reason'))
    const body = await res.json() as {
      error?: { fields?: { reason?: string } }
    }

    expect(res.status).toBe(422)
    expect(body.error?.fields?.reason).toBe('Choose a valid reason.')
  })

  it('rejects details longer than 1000 characters', async () => {
    const { request } = await reportsHarness()

    const res = await request('/api/reports', report('spam', { details: 'x'.repeat(1001) }))
    const body = await res.json() as {
      error?: { fields?: { details?: string } }
    }

    expect(res.status).toBe(422)
    expect(body.error?.fields?.details).toBe('Keep details to 1000 characters.')
  })

  it('returns not found for an unknown slug', async () => {
    const { request } = await reportsHarness()

    const res = await request('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': REPORTER_IP,
        Origin: 'https://eypi.cc',
      },
      body: JSON.stringify({ slug: 'missing', reason: 'phishing' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } })

    const known = await request('/api/reports', report('phishing'))
    expect(known.status).toBe(201)
  })

  it('stores a report and hashes the reporter IP', async () => {
    const { request, client } = await reportsHarness()

    const res = await request('/api/reports', report('phishing', { details: 'Asks for a password.' }))

    expect(res.status).toBe(201)
    const rows = await client.execute('SELECT slug, reason, details, reporter_ip_hash FROM link_reports')
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].slug).toBe('promo')
    expect(rows.rows[0].reason).toBe('phishing')
    expect(rows.rows[0].details).toBe('Asks for a password.')
    expect(rows.rows[0].reporter_ip_hash).toBe(await hmacIp(IP_HASH_SECRET, REPORTER_IP))
    expect(String(rows.rows[0].reporter_ip_hash)).not.toContain(REPORTER_IP)
  })

  it('returns 429 on the 6th report from the same IP in an hour', async () => {
    const { request, client } = await reportsHarness()

    for (let n = 0; n < 5; n += 1) {
      const res = await request('/api/reports', report('spam', {}, REPORTER_IP))
      expect(res.status).toBe(201)
    }

    const blocked = await request('/api/reports', report('spam', {}, REPORTER_IP))
    expect(blocked.status).toBe(429)

    const rows = await client.execute('SELECT COUNT(*) AS n FROM link_reports')
    expect(Number(rows.rows[0].n)).toBe(5)
  })
})
