import { Hono } from 'hono'
import type { InStatement } from '@libsql/client/web'
import { db, type Bindings } from '../../lib/db'
import { recordAudit } from '../../lib/audit'
import { badRequest, conflict, forbidden, notFound, tooMany, unauthorized } from '../../lib/errors'
import { hmacIp } from '../../lib/ipHash'
import { toCsv } from '../../lib/links/csv'
import { signPassToken } from '../../lib/passes/context'
import { checkRateLimit } from '../../lib/rateLimit'
import { TICKET_SELECT, ticketFromRow } from '../../lib/tix/registration'
import { requireEventLead } from './shared'

// Private guest ticket links (spec §5). The token is shown once; only its sha256 is stored.
const GUEST_BASE_URL = 'https://eypi.cc/t/'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/
const GUEST_RL_LIMIT = 30
const GUEST_RL_WINDOW = 600
// A link can be issued while the attendee still holds, or may yet hold, a seat.
const LINKABLE = new Set(['confirmed', 'pending', 'entered', 'waitlisted'])

const app = new Hono<{ Bindings: Bindings }>()

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function newGuestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// POST /api/events/:slug/attendees/:id/guest-link: issue or rotate (rotating kills the old link at once).
app.post('/api/events/:slug/attendees/:id/guest-link', async (c) => {
  const user = c.var.user
  if (!user) throw unauthorized()
  const client = db(c)
  const lead = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!lead.ok) throw lead.status === 404 ? notFound('Event not found.') : forbidden('forbidden', 'Forbidden.')
  const id = c.req.param('id')

  const found = await client.execute({
    sql: 'SELECT status FROM attendees WHERE id = ? AND event_id = ?',
    args: [id, lead.event.id],
  })
  if (!found.rows[0]) throw notFound('Attendee not found.')
  if (!LINKABLE.has(String(found.rows[0].status))) {
    throw conflict('not_linkable', 'This attendee cannot have a ticket link.')
  }

  const token = newGuestToken()
  await client.execute({
    sql: 'UPDATE attendees SET guest_token_hash = ? WHERE id = ? AND event_id = ?',
    args: [await sha256Hex(token), id, lead.event.id],
  })
  try {
    await recordAudit(client, {
      actorUserId: user.id,
      action: 'tix.guest_link',
      targetType: 'attendee',
      targetId: id,
      meta: null,
    })
  } catch {
    // best effort: the link is already issued
  }
  c.header('Cache-Control', 'private, no-store')
  return c.json({ url: `${GUEST_BASE_URL}${token}` })
})

// GET /api/events/:slug/attendees.csv
// Issues links for confirmed attendees without an account or a link, because only hashes are stored.
// That makes this GET a state change; it is restricted to the owning org's members.
app.get('/api/events/:slug/attendees.csv', async (c) => {
  const user = c.var.user
  if (!user) throw unauthorized()
  // A custom header cannot ride a cross-site navigation, so a link or form elsewhere cannot trigger issuing.
  if (!c.req.header('X-Active-Org-Id')?.trim()) {
    throw badRequest('org_header_required', 'Send the X-Active-Org-Id header to export attendees.')
  }
  const client = db(c)
  const lead = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!lead.ok) throw lead.status === 404 ? notFound('Event not found.') : forbidden('forbidden', 'Forbidden.')
  const eventId = lead.event.id

  const res = await client.execute({
    sql: `SELECT id, first_name, last_name, email, status, source, registered_at, answers, user_id, guest_token_hash
          FROM attendees WHERE event_id = ?
          ORDER BY COALESCE(registered_at, ''), id`,
    args: [eventId],
  })

  const links = new Map<string, string>()
  const updates: InStatement[] = []
  for (const r of res.rows) {
    if (String(r.status) !== 'confirmed' || r.guest_token_hash != null || r.user_id != null) continue
    const token = newGuestToken()
    links.set(String(r.id), `${GUEST_BASE_URL}${token}`)
    updates.push({
      sql: 'UPDATE attendees SET guest_token_hash = ? WHERE id = ? AND event_id = ? AND guest_token_hash IS NULL',
      args: [await sha256Hex(token), String(r.id), eventId],
    })
  }
  if (updates.length > 0) {
    const results = await client.batch(updates, 'write')
    results.forEach((result, i) => {
      if (Number(result.rowsAffected) !== 1) {
        const arg = updates[i] as { args: string[] }
        links.delete(arg.args[1])
      }
    })
    try {
      await recordAudit(client, {
        actorUserId: user.id,
        action: 'tix.guest_link',
        targetType: 'event',
        targetId: eventId,
        meta: { issued: links.size },
      })
    } catch {
      // best effort
    }
  }

  const rows: string[][] = [['first_name', 'last_name', 'email', 'status', 'source', 'registered_at', 'answers_json', 'guest_link']]
  for (const r of res.rows) {
    rows.push([
      String(r.first_name ?? ''),
      String(r.last_name ?? ''),
      String(r.email ?? ''),
      String(r.status),
      String(r.source ?? ''),
      r.registered_at == null ? '' : String(r.registered_at),
      typeof r.answers === 'string' && r.answers ? r.answers : '{}',
      links.get(String(r.id)) ?? '',
    ])
  }
  const safeSlug = c.req.param('slug').replace(/[^A-Za-z0-9_-]/g, '') || 'event'
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeSlug}-attendees.csv"`,
      'Cache-Control': 'no-store',
    },
  })
})

// GET /api/tickets/guest/:token: public, no session, never cached. Unknown, rotated and cancelled all look alike.
app.get('/api/tickets/guest/:token', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const secret = c.env.IP_HASH_SECRET?.trim()
  const subject = secret ? await hmacIp(secret, ip) : ip
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'guest-ticket',
    subject,
    limit: GUEST_RL_LIMIT,
    windowSec: GUEST_RL_WINDOW,
  })
  c.header('Cache-Control', 'private, no-store')
  c.header('Referrer-Policy', 'no-referrer')
  if (!decision.ok) throw tooMany()

  const token = c.req.param('token')
  if (!TOKEN_PATTERN.test(token)) throw notFound('Ticket not found.')
  const client = db(c)
  const hit = await client.execute({
    sql: 'SELECT id, event_id FROM attendees WHERE guest_token_hash = ?',
    args: [await sha256Hex(token)],
  })
  const row = hit.rows[0]
  if (!row) throw notFound('Ticket not found.')

  const ticketRes = await client.execute({
    sql: `${TICKET_SELECT} WHERE a.id = ? AND a.status IN ('confirmed', 'pending', 'entered', 'waitlisted')`,
    args: [String(row.id)],
  })
  if (!ticketRes.rows[0]) throw notFound('Ticket not found.')
  const ticket = ticketFromRow(ticketRes.rows[0])
  // Wallet passes are for confirmed seats only.
  const passToken = ticket.status === 'confirmed'
    ? await signPassToken(c.env, { attendeeId: ticket.id, eventId: String(row.event_id), slug: ticket.event.slug })
    : null
  return c.json({ ticket, passToken })
})

export default app
