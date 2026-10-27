import { Hono } from 'hono'
import { recordAudit } from '../lib/audit'
import {
  deleteAccount,
  organizationsOwnedBy,
  OWNS_ORG_MESSAGE,
} from '../lib/accountDeletion'
import { db, type Bindings } from '../lib/db'
import { ApiError } from '../lib/errors'
import { deleteObject } from '../lib/media'
import { reportError } from '../lib/reportError'
import { classifyKey } from './mediaVariants'
import { requireAdmin } from '../middleware/requireAdmin'
import { requireAuth } from '../middleware/requireAuth'

const app = new Hono<{ Bindings: Bindings }>()

const PAGE_SIZE = 25
const LINK_DISABLE_REASONS = new Set(['abuse', 'admin'])
const REPORT_ACTIONS = new Set(['disable_link', 'dismiss'])
const REPORT_STATUSES = new Set(['open', 'resolved'])

type Cursor = { value: string; id: string }
type Row = Record<string, unknown>

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function sqlNow(now = new Date()): string {
  return now.toISOString().slice(0, 19).replace('T', ' ')
}

function invalid(fields: Record<string, string>) {
  return {
    error: {
      code: 'invalid',
      message: 'Check the highlighted fields.',
      fields,
    },
  } as const
}

function notFoundBody() {
  return { error: { code: 'not_found', message: 'Not found' } } as const
}

function lastAdminBody() {
  return {
    error: {
      code: 'last_admin',
      message: 'Keep at least one active admin. You cannot demote yourself.',
    },
  } as const
}

function encodeCursor(cursor: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeCursor(raw: string): Cursor | null {
  if (!raw) return null
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const binary = atob(padded + pad)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      value?: unknown
      id?: unknown
    }
    if (typeof parsed.value !== 'string' || typeof parsed.id !== 'string') return null
    return { value: parsed.value, id: parsed.id }
  } catch {
    return null
  }
}

/** Escapes a user search term so `%` and `_` match literally. */
function likePattern(raw: string): string {
  return `%${raw.trim().toLowerCase().replace(/[\\%_]/g, '\\$&')}%`
}

async function readObject(c: { req: { json(): Promise<unknown> } }): Promise<Row | null> {
  try {
    const body = await c.req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Row : null
  } catch {
    return null
  }
}

async function deleteEdgeKey(kv: KVNamespace, key: string): Promise<void> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await kv.delete(key)
      return
    } catch (err) {
      last = err
    }
  }
  throw last instanceof Error ? last : new Error('Could not delete the edge key')
}

/**
 * The DB change stays applied, but the caller must not see success while the
 * edge can still resolve the slug. Retrying is safe: the disable is idempotent.
 */
async function deleteEdgeKeyOrFail(kv: KVNamespace, key: string): Promise<void> {
  try {
    await deleteEdgeKey(kv, key)
  } catch {
    throw new ApiError(
      502,
      'edge_delete_failed',
      'The link is disabled but the edge cache could not be cleared. Try again.',
    )
  }
}

function toUser(row: Row) {
  return {
    id: text(row.id),
    email: text(row.email),
    name: text(row.name),
    role: text(row.role) === 'admin' ? 'admin' : 'user',
    disabled: text(row.disabled_at).length > 0,
    createdAt: text(row.created_at),
  }
}

function toLink(row: Row) {
  const disabledAt = text(row.disabled_at)
  return {
    id: text(row.id),
    slug: text(row.slug),
    originalUrl: text(row.original_url),
    ownerId: text(row.user_id) || null,
    ownerEmail: text(row.owner_email) || null,
    createdAt: text(row.created_at),
    disabled: disabledAt.length > 0,
    disabledAt: disabledAt || null,
    disabledReason: text(row.disabled_reason) || null,
  }
}

function toReport(row: Row) {
  const resolvedAt = text(row.resolved_at)
  return {
    id: text(row.id),
    linkId: text(row.link_id) || null,
    slug: text(row.slug),
    reason: text(row.reason),
    details: text(row.details) || null,
    status: resolvedAt ? 'resolved' : 'open',
    resolution: text(row.resolution) || null,
    createdAt: text(row.created_at),
    resolvedAt: resolvedAt || null,
    resolvedBy: text(row.resolved_by) || null,
    ownerEmail: text(row.owner_email) || null,
    linkSlug: text(row.link_slug) || null,
    linkDisabled: text(row.link_disabled_at).length > 0,
  }
}

function parseMeta(raw: unknown): unknown {
  const value = text(raw)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function toAudit(row: Row) {
  return {
    id: text(row.id),
    actorUserId: text(row.actor_user_id),
    actorEmail: text(row.actor_email) || null,
    action: text(row.action),
    targetType: text(row.target_type) || null,
    targetId: text(row.target_id) || null,
    meta: parseMeta(row.meta),
    createdAt: text(row.created_at),
  }
}

async function loadUser(client: ReturnType<typeof db>, id: string): Promise<Row | null> {
  const result = await client.execute({
    sql: 'SELECT id, email, name, role, created_at, disabled_at FROM users WHERE id = ?',
    args: [id],
  })
  return (result.rows[0] as Row | undefined) ?? null
}

/** Admins who can still sign in. A disabled admin does not count. */
async function activeAdminCount(client: ReturnType<typeof db>, excludeId?: string): Promise<number> {
  const result = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM users
          WHERE role = 'admin' AND COALESCE(disabled_at, '') = ''
          ${excludeId ? 'AND id != ?' : ''}`,
    args: excludeId ? [excludeId] : [],
  })
  return Number(result.rows[0]?.n ?? 0)
}

app.get('/api/admin/users', requireAuth, requireAdmin, async (c) => {
  const filters: string[] = []
  const args: (string | number)[] = []
  const q = (c.req.query('q') ?? '').trim()
  if (q) {
    const pattern = likePattern(q)
    filters.push("(lower(email) LIKE ? ESCAPE '\\' OR lower(name) LIKE ? ESCAPE '\\')")
    args.push(pattern, pattern)
  }
  const cursor = decodeCursor(c.req.query('cursor') ?? '')
  if (cursor) {
    filters.push("(COALESCE(created_at, '') < ? OR (COALESCE(created_at, '') = ? AND id < ?))")
    args.push(cursor.value, cursor.value, cursor.id)
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const result = await db(c).execute({
    sql: `SELECT id, email, name, role, created_at, disabled_at
          FROM users
          ${where}
          ORDER BY COALESCE(created_at, '') DESC, id DESC
          LIMIT ?`,
    args: [...args, PAGE_SIZE + 1],
  })
  const rows = result.rows as unknown as Row[]
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last
    ? encodeCursor({ value: text(last.created_at), id: text(last.id) })
    : null
  return c.json({ items: page.map(toUser), nextCursor })
})

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const actorId = c.var.userId
  const body = await readObject(c)
  if (!body) return c.json(invalid({ body: 'Send a role or disabled flag.' }), 422)

  const fields: Record<string, string> = {}
  let role: 'admin' | 'user' | undefined
  if ('role' in body) {
    if (body.role === 'admin' || body.role === 'user') role = body.role
    else fields.role = 'Choose admin or user.'
  }
  let disabled: boolean | undefined
  if ('disabled' in body) {
    if (typeof body.disabled === 'boolean') disabled = body.disabled
    else fields.disabled = 'Choose whether the account is disabled.'
  }
  if (Object.keys(fields).length > 0) return c.json(invalid(fields), 422)
  if (role === undefined && disabled === undefined) {
    return c.json(invalid({ body: 'Send a role or disabled flag.' }), 422)
  }

  const client = db(c)
  const target = await loadUser(client, id)
  if (!target) return c.json(notFoundBody(), 404)

  const currentRole = text(target.role) === 'admin' ? 'admin' : 'user'
  const currentlyDisabled = text(target.disabled_at).length > 0

  if (role === 'user' && currentRole === 'admin') {
    // Demoting yourself is always refused, even when another admin exists.
    if (id === actorId) return c.json(lastAdminBody(), 409)
    if (await activeAdminCount(client, id) === 0) return c.json(lastAdminBody(), 409)
  }
  if (disabled === true && !currentlyDisabled && currentRole === 'admin') {
    if (await activeAdminCount(client, id) === 0) return c.json(lastAdminBody(), 409)
  }

  const now = sqlNow()
  if (role !== undefined && role !== currentRole) {
    await client.execute({
      sql: 'UPDATE users SET role = ? WHERE id = ?',
      args: [role, id],
    })
    await recordAudit(client, {
      actorUserId: actorId,
      action: 'user.role',
      targetType: 'user',
      targetId: id,
      meta: { from: currentRole, to: role },
    })
  }
  if (disabled !== undefined && disabled !== currentlyDisabled) {
    if (disabled) {
      await client.execute({
        sql: 'UPDATE users SET disabled_at = ? WHERE id = ?',
        args: [now, id],
      })
      await client.execute({
        sql: 'DELETE FROM sessions WHERE user_id = ?',
        args: [id],
      })
      await recordAudit(client, {
        actorUserId: actorId,
        action: 'user.disable',
        targetType: 'user',
        targetId: id,
        meta: { email: text(target.email) },
      })
    } else {
      await client.execute({
        sql: 'UPDATE users SET disabled_at = NULL WHERE id = ?',
        args: [id],
      })
      await recordAudit(client, {
        actorUserId: actorId,
        action: 'user.enable',
        targetType: 'user',
        targetId: id,
        meta: { email: text(target.email) },
      })
    }
  }

  const updated = await loadUser(client, id)
  return c.json({ item: toUser(updated ?? target) })
})

app.post('/api/admin/users/:id/logout', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const client = db(c)
  const target = await loadUser(client, id)
  if (!target) return c.json(notFoundBody(), 404)

  await client.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [id],
  })
  await recordAudit(client, {
    actorUserId: c.var.userId,
    action: 'user.logout',
    targetType: 'user',
    targetId: id,
    meta: { email: text(target.email) },
  })
  return c.body(null, 204)
})

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const client = db(c)
  const target = await loadUser(client, id)
  if (!target) return c.json(notFoundBody(), 404)

  const isActiveAdmin = text(target.role) === 'admin' && text(target.disabled_at).length === 0
  if (isActiveAdmin && await activeAdminCount(client, id) === 0) {
    return c.json(lastAdminBody(), 409)
  }

  const owned = await organizationsOwnedBy(client, id)
  if (owned.length > 0) {
    return c.json({
      error: { code: 'owns_org', message: OWNS_ORG_MESSAGE },
      orgs: owned,
    }, 409)
  }

  const email = text(target.email)
  const logoKeys = await deleteAccount(client, c.env, id, email)
  for (const key of logoKeys) {
    try {
      await deleteObject(c.env, key)
    } catch (err) {
      reportError(c, err, { code: 'media_delete_failed', message: 'Could not delete the QR logo.' })
    }
  }
  // No email in meta: deletion scrubs the address from every other audit row.
  await recordAudit(client, {
    actorUserId: c.var.userId,
    action: 'user.delete',
    targetType: 'user',
    targetId: id,
    meta: null,
  })
  return c.body(null, 204)
})

app.get('/api/admin/links', requireAuth, requireAdmin, async (c) => {
  const filters: string[] = []
  const args: (string | number)[] = []
  const q = (c.req.query('q') ?? '').trim()
  if (q) {
    const pattern = likePattern(q)
    filters.push(`(lower(l.slug) LIKE ? ESCAPE '\\'
      OR lower(l.original_url) LIKE ? ESCAPE '\\'
      OR lower(u.email) LIKE ? ESCAPE '\\')`)
    args.push(pattern, pattern, pattern)
  }
  const cursor = decodeCursor(c.req.query('cursor') ?? '')
  if (cursor) {
    filters.push("(COALESCE(l.created_at, '') < ? OR (COALESCE(l.created_at, '') = ? AND l.id < ?))")
    args.push(cursor.value, cursor.value, cursor.id)
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const result = await db(c).execute({
    sql: `SELECT l.id, l.slug, l.original_url, l.user_id, l.created_at, l.disabled_at,
                 l.disabled_reason, u.email AS owner_email
          FROM links l
          LEFT JOIN users u ON u.id = l.user_id
          ${where}
          ORDER BY COALESCE(l.created_at, '') DESC, l.id DESC
          LIMIT ?`,
    args: [...args, PAGE_SIZE + 1],
  })
  const rows = result.rows as unknown as Row[]
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last
    ? encodeCursor({ value: text(last.created_at), id: text(last.id) })
    : null
  return c.json({ items: page.map(toLink), nextCursor })
})

app.post('/api/admin/links/:id/disable', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const body = await readObject(c)
  const reason = body && typeof body.reason === 'string' ? body.reason : ''
  if (!LINK_DISABLE_REASONS.has(reason)) {
    return c.json(invalid({ reason: 'Choose abuse or admin.' }), 422)
  }

  const client = db(c)
  const found = await client.execute({
    sql: 'SELECT id, slug FROM links WHERE id = ?',
    args: [id],
  })
  const link = found.rows[0] as Row | undefined
  if (!link) return c.json(notFoundBody(), 404)

  const slug = text(link.slug)
  const now = sqlNow()
  await client.execute({
    sql: `UPDATE links
          SET disabled_at = COALESCE(disabled_at, ?), disabled_reason = ?, updated_at = ?
          WHERE id = ?`,
    args: [now, reason, now, id],
  })
  await deleteEdgeKeyOrFail(c.env.LINKS_KV, slug)
  await recordAudit(client, {
    actorUserId: c.var.userId,
    action: 'link.disable',
    targetType: 'link',
    targetId: id,
    meta: { slug, reason },
  })
  return c.json({
    item: {
      id,
      slug,
      disabled: true,
      disabledAt: now,
      disabledReason: reason,
    },
  })
})

app.get('/api/admin/reports', requireAuth, requireAdmin, async (c) => {
  const status = c.req.query('status') ?? 'open'
  if (!REPORT_STATUSES.has(status)) {
    return c.json(invalid({ status: 'Choose open or resolved.' }), 422)
  }
  const resolved = status === 'resolved'
  const result = await db(c).execute({
    sql: `SELECT r.id, r.link_id, r.slug, r.reason, r.details, r.created_at,
                 r.resolved_at, r.resolved_by, r.resolution,
                 u.email AS owner_email, l.slug AS link_slug, l.disabled_at AS link_disabled_at
          FROM link_reports r
          LEFT JOIN links l ON l.id = r.link_id
          LEFT JOIN users u ON u.id = l.user_id
          WHERE r.resolved_at IS ${resolved ? 'NOT NULL' : 'NULL'}
          ORDER BY r.created_at DESC, r.id DESC`,
    args: [],
  })
  return c.json({ items: (result.rows as unknown as Row[]).map(toReport) })
})

app.post('/api/admin/reports/:id/resolve', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const body = await readObject(c)
  const action = body && typeof body.action === 'string' ? body.action : ''
  if (!REPORT_ACTIONS.has(action)) {
    return c.json(invalid({ action: 'Choose disable link or dismiss.' }), 422)
  }

  const client = db(c)
  const found = await client.execute({
    sql: 'SELECT id, link_id, slug, resolved_at FROM link_reports WHERE id = ?',
    args: [id],
  })
  const report = found.rows[0] as Row | undefined
  if (!report) return c.json(notFoundBody(), 404)
  if (text(report.resolved_at)) {
    return c.json({ error: { code: 'already_resolved', message: 'This report is already resolved.' } }, 409)
  }

  const now = sqlNow()
  const linkId = text(report.link_id)
  let slug = text(report.slug)

  if (action === 'disable_link') {
    if (linkId) {
      const linkResult = await client.execute({
        sql: 'SELECT id, slug FROM links WHERE id = ?',
        args: [linkId],
      })
      const link = linkResult.rows[0] as Row | undefined
      if (link) {
        slug = text(link.slug)
        await client.execute({
          sql: `UPDATE links
                SET disabled_at = COALESCE(disabled_at, ?), disabled_reason = 'abuse', updated_at = ?
                WHERE id = ?`,
          args: [now, now, linkId],
        })
        await deleteEdgeKeyOrFail(c.env.LINKS_KV, slug)
        await recordAudit(client, {
          actorUserId: c.var.userId,
          action: 'link.disable',
          targetType: 'link',
          targetId: linkId,
          meta: { slug, reason: 'abuse', reportId: id },
        })
      }
    }
  }

  await client.execute({
    sql: `UPDATE link_reports
          SET resolved_at = ?, resolved_by = ?, resolution = ?
          WHERE id = ? AND (resolved_at IS NULL OR resolved_at = '')`,
    args: [now, c.var.userId, action, id],
  })
  await recordAudit(client, {
    actorUserId: c.var.userId,
    action: 'report.resolve',
    targetType: 'report',
    targetId: id,
    meta: { action, slug },
  })

  return c.json({
    item: {
      id,
      linkId: linkId || null,
      slug,
      status: 'resolved',
      resolution: action,
      resolvedAt: now,
    },
  })
})

app.get('/api/admin/audit', requireAuth, requireAdmin, async (c) => {
  const filters: string[] = []
  const args: (string | number)[] = []
  const action = (c.req.query('action') ?? '').trim()
  if (action) {
    filters.push('a.action = ?')
    args.push(action)
  }
  const cursor = decodeCursor(c.req.query('cursor') ?? '')
  if (cursor) {
    filters.push("(COALESCE(a.created_at, '') < ? OR (COALESCE(a.created_at, '') = ? AND a.id < ?))")
    args.push(cursor.value, cursor.value, cursor.id)
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const result = await db(c).execute({
    sql: `SELECT a.id, a.actor_user_id, a.action, a.target_type, a.target_id, a.meta,
                 a.created_at, u.email AS actor_email
          FROM audit_events a
          LEFT JOIN users u ON u.id = a.actor_user_id
          ${where}
          ORDER BY COALESCE(a.created_at, '') DESC, a.id DESC
          LIMIT ?`,
    args: [...args, PAGE_SIZE + 1],
  })
  const rows = result.rows as unknown as Row[]
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last
    ? encodeCursor({ value: text(last.created_at), id: text(last.id) })
    : null
  return c.json({ items: page.map(toAudit), nextCursor })
})

const SPEED_THRESHOLDS = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
} as const

/**
 * Stored R2 images that still lack variants (null meta). Only keys that
 * PUT /api/media/variants accepts are listed; external URLs are skipped.
 */
app.get('/api/admin/media/pending', requireAuth, requireAdmin, async (c) => {
  const client = db(c)
  const [orgs, frames] = await Promise.all([
    client.execute(
      `SELECT logo_url AS logo, banner_url AS banner, logo_meta, banner_meta FROM organizations
       WHERE (logo_url IS NOT NULL AND logo_meta IS NULL) OR (banner_url IS NOT NULL AND banner_meta IS NULL)`,
    ),
    client.execute(`SELECT image_url AS url FROM dp_frames WHERE image_meta IS NULL`),
  ])
  const seen = new Set<string>()
  const items: { key: string; profile: 'orgLogo' | 'banner' | 'frame' }[] = []
  const add = (raw: unknown) => {
    if (typeof raw !== 'string') return
    const key = raw.startsWith('/media/') ? raw.slice('/media/'.length) : raw
    const target = classifyKey(key)
    if (!target || seen.has(key)) return
    seen.add(key)
    items.push({ key, profile: target.kind })
  }
  for (const row of orgs.rows) {
    if (row.logo_meta == null) add(row.logo)
    if (row.banner_meta == null) add(row.banner)
  }
  for (const row of frames.rows) add(row.url)
  return c.json({ items })
})

app.get('/api/admin/speed', requireAuth, requireAdmin, async (c) => {
  const daysParam = c.req.query('days') ?? '7'
  if (daysParam !== '7' && daysParam !== '28') {
    return c.json(invalid({ days: 'Choose 7 or 28 days.' }), 400)
  }
  const days = Number(daysParam)
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [rows, trend] = await Promise.all([
    db(c).execute({
      sql: `SELECT route, metric, device,
                   SUM(p75 * samples) * 1.0 / SUM(samples) AS p75,
                   SUM(samples) AS samples
            FROM rum_daily
            WHERE day >= ? AND samples > 0
            GROUP BY route, metric, device
            ORDER BY metric, route, device`,
      args: [since],
    }),
    db(c).execute({
      sql: `SELECT metric, day, SUM(p75 * samples) * 1.0 / SUM(samples) AS p75
            FROM rum_daily
            WHERE day >= ? AND samples > 0
            GROUP BY metric, day
            ORDER BY metric, day`,
      args: [since],
    }),
  ])
  return c.json({
    thresholds: SPEED_THRESHOLDS,
    rows: rows.rows.map((r) => ({
      route: text(r.route),
      metric: text(r.metric),
      device: text(r.device),
      p75: Number(r.p75),
      samples: Number(r.samples),
    })),
    trend: trend.rows.map((r) => ({ metric: text(r.metric), day: text(r.day), p75: Number(r.p75) })),
  })
})

export default app
