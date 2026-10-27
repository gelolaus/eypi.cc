import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { missingRequiredEnv, requiredEnvError } from '../../lib/env'
import { checkRateLimit } from '../../lib/rateLimit'
import { loadPassContext, parsePassFields, signPassToken, verifyPassToken } from '../../lib/passes/context'
import { buildGoogleWalletSaveUrl } from '../../lib/passes/googleWallet'
import { latestCheckInAction } from './shared'

const LOOKUP_FAIL_MSG = 'No ticket found. Check your details and try again.'
const LOOKUP_LIMIT_MSG = 'Too many attempts. Wait a few minutes and try again.'
const LOOKUP_RL_LIMIT = 10
const LOOKUP_RL_WINDOW = 900
const LOOKUP_EMAIL_LIMIT = 10
const LOOKUP_EMAIL_WINDOW = 900
const LOOKUP_IP_LIMIT = 60
const LOOKUP_IP_WINDOW = 900
const PASS_LIMIT = 20
const PASS_WINDOW = 3600

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

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
    sql: 'SELECT id, slug, name, event_date, event_time, location, lead_user_id, org_id, max_attendees, selection_locked, pass_fields FROM events WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) return c.json({ status: 'error', message: 'Event not found.' }, 404)

  const event = result.rows[0]

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
      isLead: c.var.orgId === event.org_id,
      maxAttendees: event.max_attendees,
      selectionLocked: event.selection_locked === 1,
      attendeeCount,
      passFields: parsePassFields(event.pass_fields),
    },
  })
})

// ── POST /api/events/:slug/lookup ─────────────────────────────────────────────
app.post('/api/events/:slug/lookup', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const slug = c.req.param('slug')
  const body = await c.req.json() as { firstName: string; lastName: string; email: string }

  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
    return c.json({ status: 'error', message: 'First name, last name, and email are required.' }, 400)
  }

  const client = db(c)
  const evRes = await client.execute({
    sql: 'SELECT id, name, event_date, event_time, location FROM events WHERE slug = ?',
    args: [slug],
  })
  if (evRes.rows.length === 0) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }
  const event = evRes.rows[0]
  const eventId = event.id as string
  const email = body.email.trim().toLowerCase()

  const ipAllowed = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'lookup',
    subject: `${eventId}:ip:${ip}`,
    limit: LOOKUP_IP_LIMIT,
    windowSec: LOOKUP_IP_WINDOW,
  })
  if (!ipAllowed.ok) {
    return c.json({ status: 'error', message: LOOKUP_LIMIT_MSG }, 429)
  }

  const emailAllowed = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'lookup',
    subject: `${eventId}:${await sha256Hex(email)}`,
    limit: LOOKUP_EMAIL_LIMIT,
    windowSec: LOOKUP_EMAIL_WINDOW,
  })
  if (!emailAllowed.ok) {
    return c.json({ status: 'error', message: LOOKUP_LIMIT_MSG }, 429)
  }

  const aRes = await client.execute({
    sql: `SELECT id, first_name, last_name, email, qr_token, cluster_value FROM attendees
          WHERE event_id = ? AND LOWER(email) = LOWER(?) AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)`,
    args: [eventId, email, body.firstName.trim(), body.lastName.trim()],
  })
  if (aRes.rows.length === 0) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }

  const a = aRes.rows[0]
  if (await latestCheckInAction(client, a.id as string) === 'removed') {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }
  const missingEnv = missingRequiredEnv(c.env)
  if (missingEnv.includes('PASS_TOKEN_SECRET')) {
    console.error(requiredEnvError(missingEnv))
    return c.json({ status: 'error', message: 'Server misconfigured: add PASS_TOKEN_SECRET to backend/.dev.vars.' }, 503)
  }
  const passToken = await signPassToken(c.env, {
    attendeeId: a.id as string,
    eventId: event.id as string,
    slug,
  })

  return c.json({
    status: 'ok',
    passToken,
    ticket: {
      firstName: a.first_name,
      lastName: a.last_name,
      email: a.email,
      qrToken: a.qr_token,
      clusterValue: a.cluster_value ?? null,
      event: { slug, name: event.name, eventDate: event.event_date, eventTime: event.event_time, location: event.location },
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
