import type { Client as WebClient } from '@libsql/client/web'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createSession } from '../lib/auth/session'
import type { Bindings } from '../lib/db'
import { createTestApp } from '../test/createTestApp'
import { requireAuth } from './requireAuth'
import { requireAdmin } from './requireAdmin'

async function adminRequest(role: 'user' | 'admin') {
  const userId = `user-${role}`
  const { client } = await createTestApp({
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [userId, `${userId}@student.apc.edu.ph`, 'Ada', role],
      })
    },
  })
  const { token } = await createSession(client, {}, userId, new Request('http://localhost/api/admin/ping'))

  const app = new Hono<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>()
  app.use('*', async (c, next) => {
    c.set('db', client as unknown as WebClient)
    await next()
  })
  app.use('*', requireAuth)
  app.use('*', requireAdmin)
  app.get('/api/admin/ping', (c) => c.json({ ok: true }))

  return app.request('/api/admin/ping', {
    headers: { Cookie: `eypi_session=${token}` },
  }, {} as Bindings)
}

describe('requireAdmin', () => {
  it('returns 403 admin_only for a user', async () => {
    const res = await adminRequest('user')

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: { code: 'admin_only', message: 'Admin access is required.' },
    })
  })

  it('allows an admin', async () => {
    const res = await adminRequest('admin')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
