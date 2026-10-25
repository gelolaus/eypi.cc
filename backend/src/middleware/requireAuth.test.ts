import type { Client as WebClient } from '@libsql/client/web'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { sign } from 'hono/jwt'
import { createSession } from '../lib/auth/session'
import type { Bindings } from '../lib/db'
import { createTestApp } from '../test/createTestApp'
import { requireAuth } from './requireAuth'

const UNAUTHORIZED = {
  error: { code: 'unauthorized', message: 'Sign in to continue.' },
}

async function pingApp() {
  const { client } = await createTestApp({
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: ['user-1', 'user@student.apc.edu.ph', 'Ada', 'user'],
      })
    },
  })
  const { token } = await createSession(client, {}, 'user-1', new Request('http://localhost/ping'))
  const app = new Hono<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>()
  app.use('*', async (c, next) => {
    c.set('db', client as unknown as WebClient)
    await next()
  })
  app.use('*', requireAuth)
  app.get('/ping', (c) => c.json({
    id: c.var.user?.id,
    email: c.var.user?.email,
    role: c.var.user?.role,
  }))
  return { app, token }
}

describe('requireAuth', () => {
  it('calls next and sets the session user from the cookie', async () => {
    const { app, token } = await pingApp()

    const res = await app.request('/ping', {
      headers: { Cookie: `eypi_session=${token}` },
    }, {} as Bindings)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 'user-1',
      email: 'user@student.apc.edu.ph',
      role: 'user',
    })
  })

  it('returns 401 when the session cookie is missing', async () => {
    const { app } = await pingApp()

    const res = await app.request('/ping', {}, {} as Bindings)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED)
  })

  it('returns 401 for a bearer token when the session cookie is absent', async () => {
    const { app } = await pingApp()
    const token = await sign(
      { sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) + 3600 },
      'test-jwt-secret',
    )

    const res = await app.request('/ping', {
      headers: { Authorization: `Bearer ${token}` },
    }, {} as Bindings)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED)
  })
})
