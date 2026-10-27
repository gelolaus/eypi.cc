import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { actionError, attendeeLabel, LATEST_ACTION_IS, latestCheckInAction, performCheckIn, requireEventLead, writeCheckInAction } from './shared'


const app = new Hono<{ Bindings: Bindings }>()

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
  const latest = await latestCheckInAction(client, attendeeId)
  if (latest !== 'checked_in') {
    return c.json(actionError('not_checked_in', `${name} is not checked in.`), 409)
  }
  const wrote = await writeCheckInAction(
    client,
    attendeeId,
    String(event.id),
    'checked_out',
    `${LATEST_ACTION_IS} = 'checked_in'`,
    [attendeeId],
  )
  if (!wrote) return c.json(actionError('not_checked_in', `${name} is not checked in.`), 409)
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
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const name = attendeeLabel(a.first_name, a.last_name)
  const wrote = await writeCheckInAction(client, attendeeId, String(event.id), 'removed', '1 = 1')
  if (!wrote) return c.json(actionError('not_removed', `${name} could not be removed.`), 409)
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
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]
  const name = attendeeLabel(a.first_name, a.last_name)
  const latest = await latestCheckInAction(client, String(a.id))
  if (latest !== 'removed') {
    return c.json(actionError('not_removed', `${name} is not removed.`), 409)
  }
  const wrote = await writeCheckInAction(
    client,
    String(a.id),
    String(event.id),
    'not_checked_in',
    `${LATEST_ACTION_IS} = 'removed'`,
    [String(a.id)],
  )
  if (!wrote) return c.json(actionError('not_removed', `${name} is not removed.`), 409)
  return c.json({
    status: 'ok',
    message: `${name} restored.`,
    attendee: { id: String(a.id), status: 'not_checked_in' },
  })
})

export default app
