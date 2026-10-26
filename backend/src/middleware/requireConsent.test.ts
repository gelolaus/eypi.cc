import type { Client as WebClient } from '@libsql/client/web'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createSession } from '../lib/auth/session'
import type { Bindings } from '../lib/db'
import { createTestApp } from '../test/createTestApp'
import { requireAuth } from './requireAuth'
import { requireConsent } from './requireConsent'

const CONSENT_REQUIRED = {
  error: {
    code: 'consent_required',
    message: 'Accept the current privacy policy and terms to continue.',
  },
}

async function gateRequest(consentSql?: string) {
  const userId = 'user-1'
  const { client } = await createTestApp({
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [userId, 'ada@student.apc.edu.ph', 'Ada', 'user'],
      })
      if (consentSql) await db.execute(consentSql)
    },
  })
  const { token } = await createSession(client, {}, userId, new Request('http://localhost/api/gated'))

  const app = new Hono<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>()
  app.use('*', async (c, next) => {
    c.set('db', client as unknown as WebClient)
    await next()
  })
  app.use('*', requireAuth)
  app.use('*', requireConsent)
  app.post('/api/gated', (c) => c.json({ ok: true }, 201))

  return app.request('/api/gated', {
    method: 'POST',
    headers: { Cookie: `eypi_session=${token}` },
  }, {} as Bindings)
}

describe('requireConsent', () => {
  it('returns 403 consent_required when privacy and terms are missing', async () => {
    const res = await gateRequest()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('allows the request when the current privacy and terms are stored', async () => {
    const res = await gateRequest(`
      INSERT INTO legal_consents (id, user_id, document, version) VALUES
        ('c-privacy', 'user-1', 'privacy', '2026-11-01'),
        ('c-terms', 'user-1', 'terms', '2026-11-01')
    `)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 403 when a stored version is not current', async () => {
    const res = await gateRequest(`
      INSERT INTO legal_consents (id, user_id, document, version) VALUES
        ('c-privacy', 'user-1', 'privacy', '2026-01-01'),
        ('c-terms', 'user-1', 'terms', '2026-11-01')
    `)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })

  it('allows the request when acceptable use is stored beside the current privacy and terms', async () => {
    const res = await gateRequest(`
      INSERT INTO legal_consents (id, user_id, document, version) VALUES
        ('c-aup', 'user-1', 'acceptable-use', '2026-11-01'),
        ('c-privacy', 'user-1', 'privacy', '2026-11-01'),
        ('c-terms', 'user-1', 'terms', '2026-11-01')
    `)

    expect(res.status).toBe(201)
  })

  it('returns 403 when acceptable use is the only current document', async () => {
    const res = await gateRequest(`
      INSERT INTO legal_consents (id, user_id, document, version)
        VALUES ('c-aup', 'user-1', 'acceptable-use', '2026-11-01')
    `)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(CONSENT_REQUIRED)
  })
})
