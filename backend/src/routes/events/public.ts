import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { checkRateLimit } from '../../lib/rateLimit'
import { notFound, unauthorized } from '../../lib/errors'
import { withEdgeCache } from '../../lib/edgeCache'
import { renderEventMarkdown } from '../../lib/markdownHtml'
import { findTicket, linkImportedRows, parseQuestions } from '../../lib/tix/registration'
import { loadPassContext, parsePassFields, verifyPassToken } from '../../lib/passes/context'
import { buildGoogleWalletSaveUrl } from '../../lib/passes/googleWallet'

const LOOKUP_FAIL_MSG = 'No ticket found. Check your details and try again.'
const LOOKUP_LIMIT_MSG = 'Too many attempts. Wait a few minutes and try again.'
const PASS_LIMIT = 20
const PASS_WINDOW = 3600

const app = new Hono<{ Bindings: Bindings }>()

// ── GET /api/events/:slug/public ──────────────────────────────────────────────
// The attendee-facing event page. Anyone may read it (the slug is the secret for unlisted events);
// drafts do not exist here, not even for the org that owns them. Anonymous responses are identical
// for every visitor (viewer.ticket is null), so they are edge-cached; a signed-in response carries
// the viewer's own ticket and is never stored.
function parseCoverMeta(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

app.get('/api/events/:slug/public', async (c) => {
  const slug = c.req.param('slug')
  return withEdgeCache(c, 30, async () => {
    const client = db(c)
    const res = await client.execute({
      sql: `SELECT e.id, e.slug, e.name, e.event_date, e.event_time, e.end_time, e.location, e.description,
                   e.cover_key, e.cover_meta, e.admission_mode, e.max_attendees, e.waitlist_enabled,
                   e.registration_opens_at, e.registration_closes_at, e.status, e.questions,
                   o.id AS org_slug, o.name AS org_name,
                   (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id AND a.status = 'confirmed') AS confirmed
            FROM events e JOIN organizations o ON o.id = e.org_id
            WHERE e.slug = ? AND e.status != 'draft'`,
      args: [slug],
    })
    const row = res.rows[0]
    if (!row) throw notFound('Event not found.')

    const mode = String(row.admission_mode)
    const cap = row.max_attendees == null ? null : Number(row.max_attendees)
    const seatsLeft = mode === 'fcfs' && cap != null ? Math.max(0, cap - Number(row.confirmed)) : null
    const userId = c.var.userId
    if (userId) await linkImportedRows(client, userId, c.var.userEmail, String(row.id))
    const ticket = userId ? await findTicket(client, String(row.id), userId) : null
    const text = (v: unknown) => (v == null ? null : String(v))

    return c.json({
      event: {
        slug: String(row.slug),
        name: String(row.name),
        eventDate: String(row.event_date),
        eventTime: String(row.event_time),
        endTime: text(row.end_time),
        location: String(row.location),
        descriptionHtml: renderEventMarkdown(text(row.description)),
        coverUrl: row.cover_key ? `/media/${String(row.cover_key)}` : null,
        coverMeta: parseCoverMeta(row.cover_meta),
        admissionMode: mode,
        seatsLeft,
        waitlistEnabled: Number(row.waitlist_enabled) === 1,
        registrationOpensAt: text(row.registration_opens_at),
        registrationClosesAt: text(row.registration_closes_at),
        status: String(row.status),
        questions: parseQuestions(row.questions),
        org: { slug: String(row.org_slug), name: String(row.org_name) },
      },
      viewer: { ticket },
    })
  })
})

// ── GET /api/events/:slug ─────────────────────────────────────────────────────
app.get('/api/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const user = c.var.user

  if (!user) throw unauthorized()

  const client = db(c)

  const result = await client.execute({
    sql: `SELECT id, slug, name, event_date, event_time, location, lead_user_id, org_id, max_attendees, selection_locked, pass_fields, status,
            end_time, description, admission_mode, visibility, waitlist_enabled, registration_opens_at, registration_closes_at,
            questions, cover_key, cover_meta, lottery_drawn_at FROM events WHERE slug = ?`,
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

  const isLead = c.var.orgId === event.org_id
  // People who registered themselves and still hold a place: the same rows that lock the admission mode.
  const registrationCount = isLead
    ? Number((await client.execute({
      sql: `SELECT COUNT(*) AS cnt FROM attendees WHERE event_id = ? AND source = 'self' AND status != 'cancelled'`,
      args: [event.id],
    })).rows[0]?.cnt ?? 0)
    : 0
  // Confirmed guests only: pending, entered, waitlisted, declined and cancelled rows do not hold a seat.
  const confirmedCount = isLead
    ? Number((await client.execute({
      sql: `SELECT COUNT(*) AS cnt FROM attendees WHERE event_id = ? AND status = 'confirmed'`,
      args: [event.id],
    })).rows[0]?.cnt ?? 0)
    : 0
  const text = (v: unknown) => (v == null ? null : String(v))
  // The settings the builder edits; only the owning org gets them.
  const settings = isLead ? {
    endTime: text(event.end_time),
    description: text(event.description),
    registrationCount,
    confirmedCount,
    lotteryDrawnAt: text(event.lottery_drawn_at),
    admissionMode: event.admission_mode,
    visibility: event.visibility,
    capacity: event.max_attendees,
    waitlistEnabled: Number(event.waitlist_enabled) === 1,
    registrationOpensAt: text(event.registration_opens_at),
    registrationClosesAt: text(event.registration_closes_at),
    questions: parseQuestions(event.questions),
    coverUrl: event.cover_key ? `/media/${String(event.cover_key)}` : null,
    coverMeta: parseCoverMeta(event.cover_meta),
  } : {}

  return c.json({
    status: 'ok',
    event: {
      ...settings,
      id: event.id,
      slug: event.slug,
      name: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      status: event.status,
      isLead,
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
