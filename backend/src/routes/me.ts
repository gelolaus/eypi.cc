import { Hono } from 'hono'
import {
  clearSessionCookie,
  destroySession,
  readCookieHeader,
  sessionCookieName,
} from '../lib/auth/session'
import { db, type Bindings } from '../lib/db'
import { reportError } from '../lib/reportError'
import { requireAuth } from '../middleware/requireAuth'

const app = new Hono<{ Bindings: Bindings }>()

const SESSION_UNAVAILABLE = {
  error: {
    code: 'session_unavailable',
    message: 'Sign-in is temporarily unavailable. Try again.',
  },
} as const

app.get('/api/me', requireAuth, async (c) => {
  const sessionUser = c.var.user
  const userId = sessionUser?.id ?? c.var.userId
  if (!userId) {
    return c.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401)
  }

  const client = db(c)
  const email = sessionUser?.email ?? c.var.userEmail ?? ''
  const [invites, orgs] = await Promise.all([
    client.execute({
      sql: `SELECT COUNT(*) AS n
            FROM org_members
            WHERE lower(email) = lower(?) AND activated_at IS NULL AND declined_at IS NULL`,
      args: [email],
    }),
    client.execute({
      sql: `SELECT DISTINCT
              o.id AS org_id,
              o.name AS org_name,
              o.logo_url AS logo_url,
              o.owner_id AS owner_id,
              o.is_public_catalog AS is_public_catalog,
              CASE WHEN o.owner_id = ? THEN 1 ELSE 0 END AS is_owner,
              o.created_at AS created_at
            FROM organizations o
            LEFT JOIN org_members m ON o.id = m.org_id
            WHERE o.owner_id = ? OR (m.user_id = ? AND m.activated_at IS NOT NULL)
            ORDER BY o.name`,
      args: [userId, userId, userId],
    }),
  ])

  return c.json({
    user: {
      id: userId,
      email,
      name: sessionUser?.name ?? '',
      role: sessionUser?.role === 'admin' ? 'admin' : 'user',
    },
    pendingInviteCount: Number(invites.rows[0]?.n ?? 0),
    needsConsent: [],
    orgs: orgs.rows.map((row) => ({
      org_id: String(row.org_id),
      org_name: String(row.org_name),
      logo_url: row.logo_url == null ? null : String(row.logo_url),
      owner_id: String(row.owner_id),
      is_owner: Number(row.is_owner),
      is_public_catalog: Number(row.is_public_catalog ?? 0),
      created_at: row.created_at == null ? '' : String(row.created_at),
    })),
  })
})

app.post('/api/auth/logout', async (c) => {
  const token = readCookieHeader(c.req.header('Cookie'), sessionCookieName(c.env))
  if (token) {
    try {
      await destroySession(db(c), token)
    } catch (err) {
      reportError(c, err)
      return c.json(SESSION_UNAVAILABLE, 503)
    }
  }
  c.header('Set-Cookie', clearSessionCookie(c.env))
  return c.body(null, 204)
})

export default app
