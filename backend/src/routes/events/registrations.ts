import { Hono } from 'hono'
import type { InStatement } from '@libsql/client/web'
import { ApiError, conflict, notFound, tooMany, unauthorized } from '../../lib/errors'
import { db, type Bindings } from '../../lib/db'
import { canTransition, initialStatus, registrationOpen, type AdmissionMode } from '../../lib/tix/admission'
import {
  NOW_SQL,
  TICKET_SELECT,
  findTicket,
  parseQuestions,
  promoteWaitlist,
  ticketFromRow,
  validateAnswers,
} from '../../lib/tix/registration'
import { buildGoogleWalletSaveUrl } from '../../lib/passes/googleWallet'
import { loadPassContext } from '../../lib/passes/context'
import { checkRateLimit } from '../../lib/rateLimit'
import { enforceConsent } from '../../middleware/requireConsent'
import { requireAuth } from '../../middleware/requireAuth'

// Student-facing registration. Open to any signed-in APC user, so these paths bypass orgContext
// (see eventRouteUsesOrg in index.ts). The session and consent checks still run there.
const app = new Hono<{ Bindings: Bindings }>()

type EventRow = {
  id: string
  status: string
  admission_mode: AdmissionMode
  registration_opens_at: string | null
  registration_closes_at: string | null
  event_date: string
  event_time: string
  max_attendees: number | null
  waitlist_enabled: number
  questions: string
}

const REFUSALS: Record<string, { status: number; message: string }> = {
  not_published: { status: 404, message: 'This event is not open for registration.' },
  not_open_yet: { status: 409, message: 'Registration has not opened yet.' },
  registration_closed: { status: 409, message: 'Registration is closed.' },
  invite_only: { status: 403, message: 'This event is invite only.' },
}

async function loadEvent(c: Parameters<typeof db>[0], slug: string): Promise<EventRow> {
  const res = await db(c).execute({
    sql: `SELECT id, status, admission_mode, registration_opens_at, registration_closes_at, event_date,
                 event_time, max_attendees, waitlist_enabled, questions
          FROM events WHERE slug = ?`,
    args: [slug],
  })
  const row = res.rows[0]
  if (!row) throw notFound('Event not found.')
  return {
    id: String(row.id),
    status: String(row.status),
    admission_mode: String(row.admission_mode) as AdmissionMode,
    registration_opens_at: row.registration_opens_at == null ? null : String(row.registration_opens_at),
    registration_closes_at: row.registration_closes_at == null ? null : String(row.registration_closes_at),
    event_date: String(row.event_date),
    event_time: String(row.event_time),
    max_attendees: row.max_attendees == null ? null : Number(row.max_attendees),
    waitlist_enabled: Number(row.waitlist_enabled ?? 0),
    questions: String(row.questions ?? '[]'),
  }
}

function splitName(name: string, email: string): { first: string; last: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: email.split('@')[0] || 'Student', last: null }
  return { first: parts[0], last: parts.length > 1 ? parts.slice(1).join(' ') : null }
}

function requireUserId(c: { var: { userId?: string; user?: { id: string } } }): string {
  const id = c.var.userId || c.var.user?.id
  if (!id) throw unauthorized()
  return id
}

app.post('/api/events/:slug/register', async (c) => {
  const userId = requireUserId(c)
  const client = db(c)
  const event = await loadEvent(c, c.req.param('slug'))

  const existing = await findTicket(client, event.id, userId)
  if (existing) return respondExisting(c, existing)

  const open = registrationOpen(event, new Date())
  if (!open.ok) {
    const refusal = REFUSALS[open.code]
    throw new ApiError(refusal.status, open.code, refusal.message)
  }

  let body: unknown = {}
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }
  const rawAnswers = body && typeof body === 'object' ? (body as { answers?: unknown }).answers : undefined
  const checked = validateAnswers(parseQuestions(event.questions), rawAnswers)
  if (!checked.ok) {
    throw new ApiError(422, 'invalid_answers', 'Check your answers and try again.', checked.fields)
  }

  const email = c.var.userEmail || c.var.user?.email || ''
  const { first, last } = splitName(c.var.user?.name ?? '', email)
  const attendeeId = crypto.randomUUID()
  const common = [
    attendeeId, event.id, first, last, email, crypto.randomUUID(), userId,
  ]
  const answersJson = JSON.stringify(checked.answers)
  const insertColumns = `INSERT INTO attendees
      (id, event_id, first_name, last_name, email, qr_token, user_id, status, source, answers, registered_at, decided_at)`

  try {
    const waitlistEnabled = event.waitlist_enabled === 1
    if (event.admission_mode === 'fcfs') {
      const cap = event.max_attendees
      const won = await client.execute({
        sql: `${insertColumns}
              SELECT ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'self', ?, ${NOW_SQL}, NULL
              WHERE ? IS NULL OR (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?`,
        args: [...common, answersJson, cap, event.id, cap],
      })
      if (Number(won.rowsAffected) === 0) {
        const status = initialStatus('fcfs', false, waitlistEnabled)
        if (status === 'full') throw conflict('event_full', 'This event is full.')
        await client.execute({
          sql: `${insertColumns}
                VALUES (?, ?, ?, ?, ?, ?, ?, 'waitlisted', 'self', ?, ${NOW_SQL}, NULL)`,
          args: [...common, answersJson],
        })
        // A seat may have been freed between the count and this insert; promotion is a no-op when full.
        await promoteWaitlist(client, event.id, cap)
      }
    } else {
      const status = initialStatus(event.admission_mode, true, waitlistEnabled)
      await client.execute({
        sql: `${insertColumns}
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'self', ?, ${NOW_SQL}, NULL)`,
        args: [...common, status, answersJson],
      })
    }
  } catch (err) {
    // A concurrent request by the same user hit the unique (event_id, user_id) index.
    const again = await findTicket(client, event.id, userId)
    if (again) return respondExisting(c, again)
    throw err
  }

  const ticket = await findTicket(client, event.id, userId)
  return c.json({ ticket }, 201)
})

function respondExisting(c: { json: (body: unknown, status?: 200) => Response }, ticket: { status: string }) {
  if (ticket.status === 'cancelled') {
    throw conflict('registration_cancelled', 'You cancelled this registration. Ask the organisers if you want back in.')
  }
  return c.json({ ticket }, 200)
}

app.delete('/api/events/:slug/registration', async (c) => {
  const userId = requireUserId(c)
  const client = db(c)
  const event = await loadEvent(c, c.req.param('slug'))
  const ticket = await findTicket(client, event.id, userId)
  if (!ticket) throw notFound('Registration not found.')
  if (ticket.status === 'cancelled') return c.json({ ticket })
  if (!canTransition(ticket.status, 'cancelled', 'attendee')) {
    throw conflict('cannot_cancel', 'This registration can no longer be cancelled.')
  }

  const cancel: InStatement = {
    sql: `UPDATE attendees SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = ?`,
    args: [ticket.id, userId, ticket.status],
  }
  // Only a confirmed seat frees capacity for the waitlist.
  if (ticket.status === 'confirmed') {
    await promoteWaitlist(client, event.id, event.max_attendees, [cancel])
  } else {
    await client.execute(cancel)
  }
  return c.json({ ticket: await findTicket(client, event.id, userId) })
})

// Not under /api/events: own auth, no org context.
app.get('/api/tickets', requireAuth, async (c) => {
  const denied = await enforceConsent(c)
  if (denied) return denied
  const userId = c.var.userId
  const email = c.var.userEmail
  const client = db(c)

  // Link imported rows to this account by email. One row per event, never a second for a user who already has one.
  if (email) {
    await client.execute({
      sql: `UPDATE attendees SET user_id = ?
            WHERE user_id IS NULL AND lower(email) = lower(?)
              AND NOT EXISTS (SELECT 1 FROM attendees b WHERE b.event_id = attendees.event_id AND b.user_id = ?)
              AND rowid = (SELECT MIN(x.rowid) FROM attendees x
                           WHERE x.event_id = attendees.event_id AND x.user_id IS NULL AND lower(x.email) = lower(?))`,
      args: [userId, email, userId, email],
    })
  }

  const [upcoming, past] = await Promise.all([
    client.execute({
      sql: `${TICKET_SELECT}
            WHERE a.user_id = ? AND e.event_date >= date('now', '+8 hours')
            ORDER BY e.event_date, e.event_time`,
      args: [userId],
    }),
    client.execute({
      sql: `${TICKET_SELECT}
            WHERE a.user_id = ? AND e.event_date < date('now', '+8 hours')
            ORDER BY e.event_date DESC, e.event_time DESC`,
      args: [userId],
    }),
  ])
  await client.execute({
    sql: `UPDATE users SET tickets_seen_at = ${NOW_SQL} WHERE id = ?`,
    args: [userId],
  })
  return c.json({ tickets: [...upcoming.rows, ...past.rows].map(ticketFromRow) })
})

const PASS_RL_LIMIT = 20
const PASS_RL_WINDOW = 900

// POST /api/tickets/:id/pass: the signed-in student's own Google Wallet save link, made on demand.
// Own, confirmed tickets only; anything else looks like it does not exist. Never cached.
app.post('/api/tickets/:id/pass', requireAuth, async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const denied = await enforceConsent(c)
  if (denied) return denied
  const userId = c.var.userId
  const client = db(c)
  const res = await client.execute({
    sql: `SELECT a.id, e.slug FROM attendees a JOIN events e ON e.id = a.event_id
          WHERE a.id = ? AND a.user_id = ? AND a.status = 'confirmed'`,
    args: [c.req.param('id'), userId],
  })
  const row = res.rows[0]
  if (!row) throw notFound('Ticket not found.')
  const limit = await checkRateLimit(c.env.RATE_LIMIT_KV, { bucket: 'ticket-pass', subject: userId, limit: PASS_RL_LIMIT, windowSec: PASS_RL_WINDOW })
  if (!limit.ok) throw tooMany('Too many attempts. Wait a few minutes and try again.')
  try {
    const slug = String(row.slug)
    const ctx = await loadPassContext(client, slug, String(row.id))
    if (!ctx) throw notFound('Ticket not found.')
    return c.json({ url: await buildGoogleWalletSaveUrl(ctx, c.env) })
  } catch (err) {
    if (err instanceof ApiError) throw err
    console.error('POST /api/tickets/:id/pass error:', err instanceof Error ? err.message : 'unknown')
    throw new ApiError(503, 'wallet_unavailable', 'Wallet passes are not available right now.')
  }
})

export default app
