import { Hono } from 'hono'
import type { Client, InStatement } from '@libsql/client/web'
import { recordAudit } from '../../lib/audit'
import { db, type Bindings } from '../../lib/db'
import { etagMatches, LIVE_CACHE_CONTROL } from '../../lib/liveEtag'
import { canTransition, type AttendeeStatus } from '../../lib/tix/admission'
import { NOW_SQL, promoteWaitlistStatement } from '../../lib/tix/registration'
import { actionError, applyDoorAction, attendeeLabel, doorActionStatements, doorOutcome, doorTimestamp, performCheckIn, requireEventLead, type DoorAction } from './shared'


const app = new Hono<{ Bindings: Bindings }>()

// Best effort: the change is already committed, so a failed audit write must not turn it into a 500.
async function auditDoor(client: Client, actorUserId: string, action: string, eventId: string, attendeeId: string) {
  try {
    await recordAudit(client, { actorUserId, action, targetType: 'event', targetId: eventId, meta: { attendeeId } })
  } catch {
    // swallowed on purpose
  }
}

// ── POST /api/events/:slug/checkin ────────────────────────────────────────────
app.post('/api/events/:slug/checkin', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { qrToken } = await c.req.json() as { qrToken: string }
  if (!qrToken) return c.json({ status: 'error', message: 'qrToken required.' }, 400)

  const client = db(c)
  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE qr_token = ? AND event_id = ?',
    args: [qrToken, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Invalid QR code for this event.' }, 404)
  const a = aRes.rows[0]
  const result = await performCheckIn(client, String(event.id), {
    id: a.id,
    first_name: a.first_name,
    last_name: a.last_name,
  })
  if (!result.ok) return c.json(result.body, result.status)
  return c.json({
    status: 'ok',
    message: result.message,
    attendee: result.attendee,
  })
})

// ── POST /api/events/:slug/checkin-manual ─────────────────────────────────────
app.post('/api/events/:slug/checkin-manual', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c)
  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const result = await performCheckIn(client, String(event.id), {
    id: a.id,
    first_name: a.first_name,
    last_name: a.last_name,
  })
  if (!result.ok) return c.json(result.body, result.status)
  return c.json({ status: 'ok', message: result.message })
})

// ── POST /api/events/:slug/checkout ───────────────────────────────────────────
app.post('/api/events/:slug/checkout', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c)
  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const name = attendeeLabel(a.first_name, a.last_name)
  const outcome = await applyDoorAction(client, String(event.id), attendeeId, 'checked_out')
  if (!outcome.ok) return c.json(actionError('not_checked_in', `${name} is not checked in.`), 409)
  return c.json({ status: 'ok', message: `${name} checked out.` })
})

// ── POST /api/events/:slug/remove ─────────────────────────────────────────────
app.post('/api/events/:slug/remove', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c)
  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name, status FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const name = attendeeLabel(a.first_name, a.last_name)
  // Removal is an admission status, not a check-in row, and follows the same state machine as the inbox cancel.
  const from = String(a.status) as AttendeeStatus
  if (!canTransition(from, 'cancelled', 'org')) {
    return c.json(actionError('invalid_transition', `${name} can no longer be removed.`), 409)
  }
  const capacity = event.max_attendees == null ? null : Number(event.max_attendees)
  const statements: InStatement[] = [{
    sql: `UPDATE attendees SET status = 'cancelled', decided_at = ${NOW_SQL}, decided_by = ?
          WHERE id = ? AND event_id = ? AND status = ?`,
    args: [user.id, attendeeId, event.id, from],
  }]
  if (from === 'confirmed') statements.push(promoteWaitlistStatement(String(event.id), capacity))
  const [wrote] = await client.batch(statements, 'write')
  if (Number(wrote.rowsAffected) !== 1) return c.json(actionError('invalid_transition', `${name} could not be removed.`), 409)
  await auditDoor(client, user.id, 'tix.remove', String(event.id), attendeeId)
  return c.json({ status: 'ok', message: `${name} removed.` })
})

// ── POST /api/events/:slug/restore ────────────────────────────────────────────
app.post('/api/events/:slug/restore', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c)
  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name, status, decided_by, source FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const name = attendeeLabel(a.first_name, a.last_name)
  // Deliberate org override of the terminal `cancelled` state (spec 5.2 has no cancelled -> confirmed arrow).
  // Self-cancelled means source = 'self' AND decided_by IS NULL and stays cancelled. Rows cancelled by the
  // org, or by migration 0011 from a legacy 'removed' row (decided_by NULL, non-self source), may be restored.
  // The seat guard is inside the UPDATE, so concurrent restores cannot oversell.
  if (event.status === 'cancelled') return c.json(actionError('event_cancelled', 'This event was cancelled, so nobody can be restored.'), 409)
  if (String(a.status) !== 'cancelled') return c.json(actionError('not_removed', `${name} is not removed.`), 409)
  if (a.decided_by == null && String(a.source) === 'self') {
    return c.json(actionError('self_cancelled', `${name} cancelled their own registration.`), 409)
  }
  const capacity = event.max_attendees == null ? Number.MAX_SAFE_INTEGER : Number(event.max_attendees)
  const wrote = await client.execute({
    sql: `UPDATE attendees SET status = 'confirmed', decided_at = ${NOW_SQL}, decided_by = ?
          WHERE id = ? AND event_id = ? AND status = 'cancelled' AND (decided_by IS NOT NULL OR source <> 'self')
            AND (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?`,
    args: [user.id, String(a.id), event.id, event.id, capacity],
  })
  if (Number(wrote.rowsAffected) !== 1) return c.json(actionError('event_full', 'The event is full.'), 409)
  await auditDoor(client, user.id, 'tix.restore', String(event.id), String(a.id))
  return c.json({
    status: 'ok',
    message: `${name} restored.`,
    attendee: { id: String(a.id), status: 'not_checked_in' },
  })
})

// ── GET /api/events/:slug/roster ──────────────────────────────────────────────
// Offline door list. Carries QR tokens, so it is never cached and has no emails.
app.get('/api/events/:slug/roster', async (c) => {
  const user = c.var.user
  if (!user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)
  const client = db(c)
  const leadCheck = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!leadCheck.ok) return c.json(actionError(leadCheck.status === 404 ? 'not_found' : 'forbidden', leadCheck.message), leadCheck.status)

  const res = await client.execute({
    sql: `SELECT a.id, a.qr_token, a.first_name, a.last_name, a.status,
                 COALESCE((SELECT ci.action FROM check_ins ci WHERE ci.attendee_id = a.id
                           ORDER BY ci.actioned_at DESC, ci.rowid DESC LIMIT 1), '') = 'checked_in' AS checked_in
          FROM attendees a
          WHERE a.event_id = ? AND a.status = 'confirmed'
          ORDER BY a.first_name, a.last_name, a.id`,
    args: [leadCheck.event.id],
  })
  c.header('Cache-Control', 'no-store')
  return c.json({
    attendees: res.rows.map((r) => ({
      id: String(r.id),
      qrToken: String(r.qr_token),
      firstName: String(r.first_name ?? ''),
      lastName: String(r.last_name ?? ''),
      status: String(r.status),
      checkedIn: Number(r.checked_in) === 1,
    })),
    generatedAt: new Date().toISOString(),
  })
})

// ── GET /api/events/:slug/live ────────────────────────────────────────────────
app.get('/api/events/:slug/live', async (c) => {
  const user = c.var.user
  if (!user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)
  const client = db(c)
  const leadCheck = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!leadCheck.ok) return c.json(actionError(leadCheck.status === 404 ? 'not_found' : 'forbidden', leadCheck.message), leadCheck.status)
  const eventId = leadCheck.event.id

  const res = await client.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM attendees WHERE event_id = ?1 AND status = 'confirmed') AS confirmed,
            (SELECT COUNT(*) FROM attendees a WHERE a.event_id = ?1 AND a.status = 'confirmed'
               AND (SELECT ci.action FROM check_ins ci WHERE ci.attendee_id = a.id
                    ORDER BY ci.actioned_at DESC, ci.rowid DESC LIMIT 1) = 'checked_in') AS checked_in,
            (SELECT COUNT(*) FROM check_ins ci JOIN attendees a ON a.id = ci.attendee_id
               WHERE ci.event_id = ?1 AND ci.action = 'checked_in' AND a.status = 'confirmed'
                 AND ci.actioned_at >= strftime('%Y-%m-%d %H:%M:%f', 'now', '-10 minutes')) AS last10`,
    args: [eventId],
  })
  const row = res.rows[0]
  const counts = { confirmed: Number(row?.confirmed ?? 0), checkedIn: Number(row?.checked_in ?? 0), last10min: Number(row?.last10 ?? 0) }
  const etag = `W/"${counts.confirmed}-${counts.checkedIn}-${counts.last10min}"`
  const headers = { ETag: etag, 'Cache-Control': LIVE_CACHE_CONTROL }
  if (etagMatches(c.req.header('If-None-Match'), etag)) return new Response(null, { status: 304, headers })
  return c.json(counts, 200, headers)
})

// ── POST /api/events/:slug/checkins/sync ──────────────────────────────────────
// Offline queue replay. Each item is a conditional INSERT keyed by the client's uuid,
// so replays are idempotent and two devices cannot both check the same attendee in.
// Stale offline actions are last-writer-wins by arrival time (actioned_at is lifted to the attendee's newest row).
const MAX_SYNC_ITEMS = 100
const SYNC_ID = /^[A-Za-z0-9_-]{8,64}$/

app.post('/api/events/:slug/checkins/sync', async (c) => {
  const user = c.var.user
  if (!user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)
  const client = db(c)
  const leadCheck = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!leadCheck.ok) return c.json(actionError(leadCheck.status === 404 ? 'not_found' : 'forbidden', leadCheck.message), leadCheck.status)

  const raw = await c.req.json().catch(() => null) as { items?: unknown } | null
  const items = raw?.items
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_SYNC_ITEMS) {
    return c.json(actionError('invalid_items', `Send between 1 and ${MAX_SYNC_ITEMS} items.`), 400)
  }
  const parsed: { id: string; attendeeId: string; action: DoorAction; at: string }[] = []
  for (const item of items as Record<string, unknown>[]) {
    const ok = item && typeof item === 'object'
      && typeof item.id === 'string' && SYNC_ID.test(item.id)
      && typeof item.attendeeId === 'string' && item.attendeeId.length > 0 && item.attendeeId.length <= 64
      && (item.action === 'checked_in' || item.action === 'checked_out')
    if (!ok) return c.json(actionError('invalid_items', 'Each item needs an id, attendeeId and a checked_in or checked_out action.'), 400)
    parsed.push({ id: item.id as string, attendeeId: item.attendeeId as string, action: item.action as DoorAction, at: doorTimestamp(item.at) })
  }

  const eventId = String(leadCheck.event.id)
  // One transaction, statements run in the given order; each item brings its own diagnostic read.
  const out = await client.batch(parsed.flatMap((p) => doorActionStatements({ ...p, eventId })), 'write')
  const results = parsed.map((p, i) => {
    const outcome = doorOutcome(out[i * 2], out[i * 2 + 1], p.action)
    if (outcome.ok) return { id: p.id, ok: true }
    // 'cancelled' is a kind of not_confirmed for sync clients.
    return { id: p.id, ok: false, code: outcome.code === 'cancelled' ? 'not_confirmed' : outcome.code }
  })
  return c.json({ results })
})

export default app
