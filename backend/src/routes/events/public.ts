import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { checkRateLimit } from '../../lib/rateLimit'
import { loadPassContext, parsePassFields, verifyPassToken } from '../../lib/passes/context'
import { buildGoogleWalletSaveUrl } from '../../lib/passes/googleWallet'

const LOOKUP_FAIL_MSG = 'No ticket found. Check your details and try again.'
const LOOKUP_LIMIT_MSG = 'Too many attempts. Wait a few minutes and try again.'
const LOOKUP_RL_LIMIT = 10
const LOOKUP_RL_WINDOW = 900
const PASS_LIMIT = 20
const PASS_WINDOW = 3600

const app = new Hono<{ Bindings: Bindings }>()

// ── GET /api/events/:slug ─────────────────────────────────────────────────────
app.get('/api/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const user = c.var.user

  if (!user) {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
    const allowed = await checkRateLimit(c.env.RATE_LIMIT_KV, {
      bucket: 'tix-lookup',
      subject: ip,
      limit: LOOKUP_RL_LIMIT,
      windowSec: LOOKUP_RL_WINDOW,
    })
    if (!allowed.ok) {
      return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 429)
    }
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }

  const client = db(c)

  const result = await client.execute({
    sql: 'SELECT id, slug, name, event_date, event_time, location, lead_user_id, org_id, max_attendees, selection_locked, pass_fields, status FROM events WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) return c.json({ status: 'error', message: 'Event not found.' }, 404)

  const event = result.rows[0]
  // A draft is visible only to the org that owns it.
  if (event.status === 'draft' && c.var.orgId !== event.org_id) {
    return c.json({ status: 'error', message: 'Event not found.' }, 404)
  }

  const countRes = await client.execute({
    sql: 'SELECT COUNT(*) as cnt FROM attendees WHERE event_id = ?',
    args: [event.id],
  })
  const attendeeCount = Number(countRes.rows[0]?.cnt ?? 0)

  return c.json({
    status: 'ok',
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      status: event.status,
      isLead: c.var.orgId === event.org_id,
      maxAttendees: event.max_attendees,
      selectionLocked: event.selection_locked === 1,
      attendeeCount,
      passFields: parsePassFields(event.pass_fields),
    },
  })
})

// ── GET /api/events/:slug/passes/google ────────────────────────────────────────
app.get('/api/events/:slug/passes/google', async (c) => {
  const slug = c.req.param('slug')
  const token = (c.req.query('token') ?? '').trim()
  if (!token) {
    return c.json({ status: 'error', message: 'Pass token is required.' }, 400)
  }

  try {
    const claims = await verifyPassToken(c.env, token, slug)
    if (!claims) {
      return c.json({ status: 'error', message: 'Invalid or expired pass token.' }, 400)
    }

    const client = db(c)
    const ctx = await loadPassContext(client, slug, claims.sub)
    if (!ctx || ctx.event.id !== claims.eventId) {
      return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
    }

    const allowed = await checkRateLimit(c.env.RATE_LIMIT_KV, {
      bucket: 'pass',
      subject: claims.sub,
      limit: PASS_LIMIT,
      windowSec: PASS_WINDOW,
    })
    if (!allowed.ok) {
      return c.json({ status: 'error', message: LOOKUP_LIMIT_MSG }, 429)
    }

    const url = await buildGoogleWalletSaveUrl(ctx, c.env)
    return c.json({ status: 'ok', url })
  } catch (err) {
    console.error('GET /passes/google error:', err instanceof Error ? err.message : err)
    const detail = err instanceof Error ? err.message : ''
    const walletDown = detail.includes('not configured') || detail.startsWith('Google Wallet')
    const message = walletDown
      ? 'Wallet passes are not available right now.'
      : LOOKUP_FAIL_MSG
    return c.json({ status: 'error', message }, 503)
  }
})

export default app
