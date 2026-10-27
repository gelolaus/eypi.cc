import { Hono } from 'hono'
import type { InStatement } from '@libsql/client/web'
import { db, type Bindings } from '../../lib/db'
import { recordAudit } from '../../lib/audit'
import { canTransition, type AttendeeStatus } from '../../lib/tix/admission'
import { NOW_SQL, promoteWaitlistStatement } from '../../lib/tix/registration'
import { actionError, requireEventLead } from './shared'

const PAGE_SIZE = 25
const MAX_BULK = 200
const MAX_QUERY = 100
const STATUSES: AttendeeStatus[] = ['pending', 'entered', 'waitlisted', 'confirmed', 'declined', 'cancelled']
const BULK_TARGET = { approve: 'confirmed', decline: 'declined', cancel: 'cancelled' } as const
type BulkAction = keyof typeof BULK_TARGET

type SkipReason = 'not_found' | 'invalid_transition' | 'event_full'

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function encodeCursor(registeredAt: string, id: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([registeredAt, id]))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeCursor(raw: string): [string, string] | null {
  try {
    const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))))
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      return [parsed[0], parsed[1]]
    }
  } catch {
    // fall through
  }
  return null
}

function parseAnswers(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const app = new Hono<{ Bindings: Bindings }>()

// GET /api/events/:slug/attendees
// Paged inbox when `status`, `q`, `cursor` or `paged` is present. With none of them the response keeps the
// pre-inbox unpaged shape (status = latest check-in action) so the existing UI works until it moves to the inbox.
app.get('/api/events/:slug/attendees', async (c) => {
  const user = c.var.user
  if (!user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)

  const client = db(c)
  const leadCheck = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const eventId = leadCheck.event.id

  const statusParam = c.req.query('status')
  const qParam = c.req.query('q')
  const cursorParam = c.req.query('cursor')
  const paged = statusParam !== undefined || qParam !== undefined || cursorParam !== undefined || c.req.query('paged') !== undefined

  const countRes = await client.execute({
    sql: 'SELECT status, COUNT(*) AS n FROM attendees WHERE event_id = ? GROUP BY status',
    args: [eventId],
  })
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<AttendeeStatus, number>
  for (const r of countRes.rows) {
    const s = String(r.status) as AttendeeStatus
    if (s in counts) counts[s] = Number(r.n)
  }

  if (!paged) {
    const result = await client.execute({
      sql: `
        SELECT a.id, a.first_name, a.last_name, a.email, a.qr_token, a.cluster_value,
               CASE WHEN a.status = 'cancelled' THEN 'removed'
                    WHEN ci.action IN ('removed', 'not_checked_in') THEN 'not_checked_in'
                    ELSE ci.action END AS status, ci.actioned_at, a.status AS admission_status
        FROM attendees a
        LEFT JOIN (
          SELECT attendee_id, action, actioned_at,
                 ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY actioned_at DESC, rowid DESC) AS rn
          FROM check_ins
          WHERE event_id = ?
        ) ci ON ci.attendee_id = a.id AND ci.rn = 1
        WHERE a.event_id = ?
        ORDER BY a.first_name, a.last_name`,
      args: [eventId, eventId],
    })
    return c.json({ status: 'ok', attendees: result.rows, counts, nextCursor: null })
  }

  const where = ['a.event_id = ?']
  const args: (string | number)[] = [eventId]
  if (statusParam) {
    if (!STATUSES.includes(statusParam as AttendeeStatus)) {
      return c.json(actionError('invalid_status', 'Unknown status filter.'), 400)
    }
    where.push('a.status = ?')
    args.push(statusParam)
  }
  const q = (qParam ?? '').trim().slice(0, MAX_QUERY)
  if (q) {
    const like = `%${escapeLike(q)}%`
    where.push(`(a.first_name LIKE ? ESCAPE '\\' OR a.last_name LIKE ? ESCAPE '\\' OR a.email LIKE ? ESCAPE '\\'
      OR (a.first_name || ' ' || COALESCE(a.last_name, '')) LIKE ? ESCAPE '\\')`)
    args.push(like, like, like, like)
  }
  if (cursorParam) {
    const cursor = decodeCursor(cursorParam)
    if (!cursor) return c.json(actionError('invalid_cursor', 'Invalid cursor.'), 400)
    where.push("(COALESCE(a.registered_at, '') > ? OR (COALESCE(a.registered_at, '') = ? AND a.id > ?))")
    args.push(cursor[0], cursor[0], cursor[1])
  }

  const res = await client.execute({
    sql: `SELECT a.id, a.first_name, a.last_name, a.email, a.status, a.source, a.answers, a.cluster_value,
                 a.registered_at, a.decided_at, a.decided_by, COALESCE(a.registered_at, '') AS sort_at
          FROM attendees a
          WHERE ${where.join(' AND ')}
          ORDER BY COALESCE(a.registered_at, ''), a.id
          LIMIT ?`,
    args: [...args, PAGE_SIZE + 1],
  })
  const more = res.rows.length > PAGE_SIZE
  const rows = res.rows.slice(0, PAGE_SIZE)
  const last = rows[rows.length - 1]
  const attendees = rows.map((r) => ({
    id: String(r.id),
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    status: String(r.status),
    source: r.source,
    answers: parseAnswers(r.answers),
    cluster_value: r.cluster_value,
    registered_at: r.registered_at,
    decided_at: r.decided_at,
    decided_by: r.decided_by,
  }))

  return c.json({
    status: 'ok',
    attendees,
    counts,
    nextCursor: more && last ? encodeCursor(String(last.sort_at), String(last.id)) : null,
  })
})

// POST /api/events/:slug/attendees/bulk
app.post('/api/events/:slug/attendees/bulk', async (c) => {
  const user = c.var.user
  if (!user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)

  const client = db(c)
  const leadCheck = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const raw = await c.req.json().catch(() => null) as { ids?: unknown; action?: unknown } | null
  const action = raw?.action
  if (typeof action !== 'string' || !(action in BULK_TARGET)) {
    return c.json(actionError('invalid_action', 'Action must be approve, decline or cancel.'), 400)
  }
  if (!Array.isArray(raw?.ids) || raw.ids.length === 0 || raw.ids.length > MAX_BULK || raw.ids.some((i) => typeof i !== 'string' || !i)) {
    return c.json(actionError('invalid_ids', `Send between 1 and ${MAX_BULK} attendee ids.`), 400)
  }
  const ids = [...new Set(raw.ids as string[])]
  const target = BULK_TARGET[action as BulkAction]
  const capacity = event.max_attendees == null ? Number.MAX_SAFE_INTEGER : Number(event.max_attendees)

  const found = await client.execute({
    sql: `SELECT id, status FROM attendees WHERE event_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
    args: [event.id, ...ids],
  })
  const current = new Map(found.rows.map((r) => [String(r.id), String(r.status) as AttendeeStatus]))

  const skipped: { id: string; reason: SkipReason }[] = []
  const statements: InStatement[] = []
  // Parallel to statements: attendee id for a decision statement, null for a waitlist promotion.
  const owners: (string | null)[] = []
  for (const id of ids) {
    const from = current.get(id)
    if (!from) {
      skipped.push({ id, reason: 'not_found' })
      continue
    }
    if (!canTransition(from, target, 'org')) {
      skipped.push({ id, reason: 'invalid_transition' })
      continue
    }
    // The status and seat guards live in the statement, so concurrent decisions cannot oversell.
    statements.push({
      sql: `UPDATE attendees SET status = ?, decided_at = ${NOW_SQL}, decided_by = ?
            WHERE id = ? AND event_id = ? AND status = ?
              AND (? <> 'confirmed' OR (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?)`,
      args: [target, user.id, id, event.id, from, target, event.id, capacity],
    })
    owners.push(id)
    if (target === 'cancelled' && from === 'confirmed') {
      statements.push(promoteWaitlistStatement(event.id, event.max_attendees == null ? null : Number(event.max_attendees)))
      owners.push(null)
    }
  }

  const updatedIds: string[] = []
  if (statements.length > 0) {
    const results = await client.batch(statements, 'write')
    const failed: string[] = []
    results.forEach((res, i) => {
      const owner = owners[i]
      if (owner === null) return
      if (Number(res.rowsAffected) === 1) updatedIds.push(owner)
      else failed.push(owner)
    })
    if (failed.length > 0) {
      const after = await client.execute({
        sql: `SELECT id, status FROM attendees WHERE event_id = ? AND id IN (${failed.map(() => '?').join(',')})`,
        args: [event.id, ...failed],
      })
      const now = new Map(after.rows.map((r) => [String(r.id), String(r.status)]))
      for (const id of failed) {
        const stillFrom = now.get(id) === current.get(id)
        skipped.push({ id, reason: target === 'confirmed' && stillFrom ? 'event_full' : 'invalid_transition' })
      }
    }
  }

  // Best effort: the decisions are already committed, so a failed audit write must not turn them into a 500.
  if (updatedIds.length > 0) {
    try {
      await recordAudit(client, {
        actorUserId: user.id,
        action: 'tix.bulk',
        targetType: 'event',
        targetId: event.id,
        meta: { action, requested: ids.length, updated: updatedIds.length, skipped: skipped.length, ids: updatedIds },
      })
    } catch {
      // swallowed on purpose
    }
  }

  return c.json({ status: 'ok', updated: updatedIds.length, skipped })
})

export default app
