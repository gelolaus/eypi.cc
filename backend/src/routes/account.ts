import { Hono } from 'hono'
import type { Client } from '@libsql/client/web'
import {
  clearSessionCookie,
  sessionTokenFromCookie,
} from '../lib/auth/session'
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

const OWNS_ORG_MESSAGE = 'Transfer ownership before deleting your account.'

type Statement = { sql: string; args: (string | null)[] }

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

function qrLogoKey(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as { logo?: unknown }
    const logo = parsed.logo
    const key = typeof logo === 'string'
      ? logo
      : logo && typeof logo === 'object' && 'key' in logo
        ? (logo as { key?: unknown }).key
        : null
    if (typeof key !== 'string') return null
    if (!key.startsWith('qr-logos/') || key.includes('..') || key.includes('\\')) return null
    return key
  } catch {
    return null
  }
}

function replaceAccountEmail(meta: string, email: string): string {
  if (!email) return meta
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match whole addresses only: `ana.santos@…` must never rewrite
  // `joana.santos@…` in a third party's audit row. A trailing dot is allowed
  // when it ends a sentence, but not when it continues a domain.
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9._%+-])${escaped}(?![A-Za-z0-9_%+-])(?!\\.[A-Za-z0-9])`,
    'gi',
  )
  return meta.replace(pattern, (_match: string, prefix: string) => `${prefix}deleted-user`)
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

// Reassign rows that still belong to another org, then remove everything that references this user.
async function deleteAccount(client: Client, userId: string, email: string): Promise<string[]> {
  const [logos, audits] = await Promise.all([
    client.execute({
      sql: 'SELECT qr_config FROM links WHERE user_id = ?',
      args: [userId],
    }),
    client.execute({
      sql: `SELECT id, meta FROM audit_events
            WHERE meta IS NOT NULL AND instr(lower(meta), ?) > 0`,
      args: [email],
    }),
  ])
  const logoKeys = [...new Set(logos.rows.map((row) => qrLogoKey(row.qr_config)).filter((key): key is string => key != null))]

  const ledByUser = 'lead_user_id = ?'
  const eventIds = `SELECT id FROM events WHERE ${ledByUser}`
  const createdByUser = 'creator_id = ?'
  const campaignIds = `SELECT id FROM dp_campaigns WHERE ${createdByUser}`
  const statements: Statement[] = [
    {
      sql: `UPDATE events
            SET lead_user_id = (SELECT o.owner_id FROM organizations o WHERE o.id = events.org_id)
            WHERE lead_user_id = ?
              AND EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.id = events.org_id AND o.owner_id != ?
              )`,
      args: [userId, userId],
    },
    {
      sql: `UPDATE dp_campaigns
            SET creator_id = (SELECT o.owner_id FROM organizations o WHERE o.id = dp_campaigns.org_id)
            WHERE creator_id = ?
              AND EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.id = dp_campaigns.org_id AND o.owner_id != ?
              )`,
      args: [userId, userId],
    },
    {
      sql: `DELETE FROM check_ins
            WHERE event_id IN (${eventIds})
               OR attendee_id IN (SELECT id FROM attendees WHERE event_id IN (${eventIds}))`,
      args: [userId, userId],
    },
    { sql: `DELETE FROM attendees WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_clusters WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_column_mappings WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_csv_rows WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM events WHERE ${ledByUser}`, args: [userId] },
    { sql: `DELETE FROM dp_frames WHERE campaign_id IN (${campaignIds})`, args: [userId] },
    { sql: `DELETE FROM dp_slug_history WHERE campaign_id IN (${campaignIds})`, args: [userId] },
    { sql: `DELETE FROM dp_campaigns WHERE ${createdByUser}`, args: [userId] },
    { sql: 'DELETE FROM org_members WHERE user_id = ? OR lower(email) = ?', args: [userId, email] },
    { sql: 'DELETE FROM links WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM user_identities WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM legal_consents WHERE user_id = ?', args: [userId] },
  ]

  for (const row of audits.rows) {
    const meta = text(row.meta)
    const next = replaceAccountEmail(meta, email)
    if (next !== meta) statements.push({ sql: 'UPDATE audit_events SET meta = ? WHERE id = ?', args: [next, text(row.id)] })
  }
  statements.push({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
  await client.batch(statements, 'write')
  return logoKeys
}

app.delete('/api/account', requireAuth, async (c) => {
  const userId = c.var.userId
  if (!userId) return c.json(UNAUTHORIZED, 401)
  const email = (c.var.userEmail || '').trim().toLowerCase()
  const confirmed = await confirmEmail(c)
  if (!email || confirmed !== email) return c.json(EMAIL_MISMATCH, 400)

  const client = db(c)
  const owned = await client.execute({
    sql: 'SELECT id, name FROM organizations WHERE owner_id = ? ORDER BY name, id',
    args: [userId],
  })
  if (owned.rows.length > 0) {
    return c.json({
      error: { code: 'owns_org', message: OWNS_ORG_MESSAGE },
      orgs: owned.rows.map((row) => ({ id: text(row.id), name: text(row.name) })),
    }, 409)
  }

  const logoKeys = await deleteAccount(client, userId, email)
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
