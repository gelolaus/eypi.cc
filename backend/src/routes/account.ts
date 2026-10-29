import { Hono } from 'hono'
import {
  clearSessionCookie,
  sessionTokenFromCookie,
} from '../lib/auth/session'
import {
  deleteAccount,
  organizationsOwnedBy,
  OWNS_ORG_MESSAGE,
} from '../lib/accountDeletion'
import { parseAvatar } from '../../../shared/avatars'
import { db, type Bindings } from '../lib/db'
import { deleteObject } from '../lib/media'
import { reportError } from '../lib/reportError'
import { requireAuth } from '../middleware/requireAuth'

const app = new Hono<{ Bindings: Bindings }>()

const UNAUTHORIZED = {
  error: { code: 'unauthorized', message: 'Sign in to continue.' },
} as const

const EMAIL_MISMATCH = {
  error: {
    code: 'email_mismatch',
    message: 'That email does not match this account.',
  },
} as const

type SessionView = {
  id: string
  device: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function browserName(userAgent: string): string | null {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/OPR\/|Opera/.test(userAgent)) return 'Opera'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return null
}

function osName(userAgent: string): string | null {
  if (/Windows/.test(userAgent)) return 'Windows'
  if (/Android/.test(userAgent)) return 'Android'
  if (/iPhone|iPad/.test(userAgent)) return 'iOS'
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'macOS'
  if (/CrOS/.test(userAgent)) return 'ChromeOS'
  if (/Linux/.test(userAgent)) return 'Linux'
  return null
}

function deviceLabel(userAgent: string | null): string {
  const agent = userAgent ?? ''
  const browser = browserName(agent)
  const os = osName(agent)
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? 'Unknown device'
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function currentSessionId(c: {
  env: { ENVIRONMENT?: string }
  req: { header(name: string): string | undefined }
}): Promise<string | null> {
  const token = sessionTokenFromCookie(c.req.header('Cookie'), c.env)
  if (!token) return null
  return sha256Hex(token)
}

function toSession(row: Record<string, unknown>, currentId: string | null): SessionView {
  const id = text(row.id)
  return {
    id,
    device: deviceLabel(row.user_agent == null ? null : String(row.user_agent)),
    lastSeenAt: text(row.last_seen_at),
    expiresAt: text(row.expires_at),
    current: currentId != null && id === currentId,
  }
}

async function confirmEmail(c: { req: { json(): Promise<unknown> } }): Promise<string> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return ''
  }
  if (!body || typeof body !== 'object' || !('confirmEmail' in body)) return ''
  const value = (body as { confirmEmail: unknown }).confirmEmail
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

app.patch('/api/account/avatar', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = undefined
  }
  const avatar = parseAvatar(body)
  if (!avatar) {
    return c.json({
      error: { code: 'invalid_avatar', message: 'Pick an icon and a colour from the lists.' },
    }, 400)
  }
  await db(c).execute({
    sql: 'UPDATE users SET avatar_icon = ?, avatar_color = ? WHERE id = ?',
    args: [avatar.icon, avatar.color, userId],
  })
  return c.json({ avatarIcon: avatar.icon, avatarColor: avatar.color })
})

app.get('/api/account/export.json', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  const client = db(c)
  const currentId = await currentSessionId(c)
  const email = (c.var.userEmail || '').trim().toLowerCase()
  const [profile, links, members, owned, consents, sessions] = await Promise.all([
    client.execute({
      sql: 'SELECT id, email, name, role, created_at FROM users WHERE id = ?',
      args: [userId],
    }),
    client.execute({
      sql: `SELECT id, slug, original_url, clicks, created_at, expires_at, disabled_at,
                   (SELECT COUNT(*) FROM analytics WHERE analytics.link_id = links.id) AS click_count
            FROM links
            WHERE user_id = ?
            ORDER BY created_at, id`,
      args: [userId],
    }),
    client.execute({
      sql: `SELECT m.org_id, o.name AS org_name, m.email, m.activated_at
            FROM org_members m
            LEFT JOIN organizations o ON o.id = m.org_id
            WHERE m.user_id = ? OR lower(m.email) = ?
            ORDER BY o.name, m.org_id`,
      args: [userId, email],
    }),
    client.execute({
      sql: 'SELECT id, name FROM organizations WHERE owner_id = ? ORDER BY name, id',
      args: [userId],
    }),
    client.execute({
      sql: `SELECT id, document, version, accepted_at
            FROM legal_consents
            WHERE user_id = ?
            ORDER BY document, version, id`,
      args: [userId],
    }),
    client.execute({
      sql: `SELECT id, user_agent, last_seen_at, expires_at
            FROM sessions
            WHERE user_id = ?
            ORDER BY last_seen_at DESC, id`,
      args: [userId],
    }),
  ])

  const profileRow = profile.rows[0]
  const memberships: { orgId: string; orgName: string; email: string }[] = []
  const invites: { orgId: string; orgName: string; email: string }[] = []
  for (const row of members.rows) {
    const item = {
      orgId: text(row.org_id),
      orgName: text(row.org_name),
      email: text(row.email),
    }
    if (row.activated_at == null || text(row.activated_at).length === 0) invites.push(item)
    else memberships.push(item)
  }

  const utcDay = new Date().toISOString().slice(0, 10)
  c.header('Content-Disposition', `attachment; filename="eypi-data-${utcDay}.json"`)
  return c.json({
    profile: {
      id: text(profileRow?.id),
      email: text(profileRow?.email),
      name: text(profileRow?.name),
      role: profileRow?.role === 'admin' ? 'admin' : 'user',
      createdAt: text(profileRow?.created_at),
    },
    links: links.rows.map((row) => ({
      id: text(row.id),
      slug: text(row.slug),
      originalUrl: text(row.original_url),
      clicks: Number(row.clicks ?? 0),
      createdAt: row.created_at == null ? null : String(row.created_at),
      expiresAt: row.expires_at == null ? null : String(row.expires_at),
      disabledAt: row.disabled_at == null ? null : String(row.disabled_at),
      analytics: { clickCount: Number(row.click_count ?? 0) },
    })),
    memberships,
    invites,
    ownedOrgs: owned.rows.map((row) => ({ id: text(row.id), name: text(row.name) })),
    consents: consents.rows.map((row) => ({
      id: text(row.id),
      document: text(row.document),
      version: text(row.version),
      acceptedAt: text(row.accepted_at),
    })),
    sessions: sessions.rows.map((row) => toSession(row as Record<string, unknown>, currentId)),
  })
})

app.get('/api/account/sessions', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  const currentId = await currentSessionId(c)
  const result = await db(c).execute({
    sql: `SELECT id, user_agent, last_seen_at, expires_at
          FROM sessions
          WHERE user_id = ?
          ORDER BY last_seen_at DESC, id`,
    args: [userId],
  })
  return c.json({
    sessions: result.rows.map((row) => toSession(row as Record<string, unknown>, currentId)),
  })
})

app.delete('/api/account/sessions/:id', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  const id = c.req.param('id')
  const currentId = await currentSessionId(c)
  const result = await db(c).execute({
    sql: 'DELETE FROM sessions WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })
  if (Number(result.rowsAffected) !== 1) {
    return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  }
  if (currentId === id) c.header('Set-Cookie', clearSessionCookie(c.env))
  return c.body(null, 204)
})

app.post('/api/account/sessions/revoke-all', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  await db(c).execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [userId],
  })
  c.header('Set-Cookie', clearSessionCookie(c.env))
  return c.body(null, 204)
})

app.delete('/api/account', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  const email = (c.var.userEmail || '').trim().toLowerCase()
  const confirmed = await confirmEmail(c)
  if (!email || confirmed !== email) return c.json(EMAIL_MISMATCH, 400)

  const client = db(c)
  const owned = await organizationsOwnedBy(client, userId)
  if (owned.length > 0) {
    return c.json({
      error: { code: 'owns_org', message: OWNS_ORG_MESSAGE },
      orgs: owned,
    }, 409)
  }

  const logoKeys = await deleteAccount(client, c.env, userId, email)
  for (const key of logoKeys) {
    try {
      await deleteObject(c.env, key)
    } catch (err) {
      reportError(c, err, { code: 'media_delete_failed', message: 'Could not delete the QR logo.' })
    }
  }
  c.header('Set-Cookie', clearSessionCookie(c.env))
  return c.body(null, 204)
})

export default app
