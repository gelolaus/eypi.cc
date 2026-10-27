import { Hono } from 'hono'
import type { InStatement } from '@libsql/client/web'
import { ApiError, conflict } from '../../lib/errors'
import { db, type Bindings } from '../../lib/db'
import { recordAudit } from '../../lib/audit'
import { registrationOpen, type AdmissionMode } from '../../lib/tix/admission'
import { parseQuestions } from '../../lib/tix/registration'
import { selectAttendees, seededOrder, type SelectionCluster, type SelectionRow } from '../../../../src/lib/tix/selection'
import { requireEventLead } from './shared'

const app = new Hono<{ Bindings: Bindings }>()

const CLUSTER_COL = '__cluster'
const SEED_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/

function sqlTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

function parseFilters(raw: unknown): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

function answerOf(raw: unknown, questionId: string): string {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : '{}') as Record<string, unknown>
    const value = parsed[questionId]
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

// POST /api/events/:slug/draw  { seed?, clusterQuestionId? }
app.post('/api/events/:slug/draw', async (c) => {
  const user = c.var.user
  if (!user) throw new ApiError(401, 'unauthorized', 'Sign in to continue.')

  const client = db(c)
  const lead = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!lead.ok) {
    throw lead.status === 403
      ? new ApiError(403, 'forbidden', 'You cannot manage this event.')
      : new ApiError(404, 'not_found', 'Event not found.')
  }
  const eventId = lead.event.id

  const res = await client.execute({
    sql: `SELECT status, admission_mode, registration_opens_at, registration_closes_at, event_date, event_time,
                 max_attendees, waitlist_enabled, lottery_drawn_at, questions
          FROM events WHERE id = ?`,
    args: [eventId],
  })
  const row = res.rows[0]
  if (!row) throw new ApiError(404, 'not_found', 'Event not found.')
  const mode = String(row.admission_mode) as AdmissionMode
  if (mode !== 'lottery') throw conflict('not_lottery', 'Only lottery events can be drawn.')
  if (row.lottery_drawn_at != null) throw conflict('already_drawn', 'This lottery has already been drawn.')
  const status = String(row.status)
  if (status === 'cancelled') throw conflict('event_cancelled', 'A cancelled event cannot be drawn.')
  if (status === 'draft') throw conflict('not_published', 'Publish the event before drawing.')
  const window = registrationOpen({
    status,
    admission_mode: mode,
    registration_opens_at: row.registration_opens_at == null ? null : String(row.registration_opens_at),
    registration_closes_at: row.registration_closes_at == null ? null : String(row.registration_closes_at),
    event_date: String(row.event_date),
    event_time: String(row.event_time),
  }, new Date())
  if (window.ok || window.code === 'not_open_yet') {
    throw conflict('registration_open', 'Registration is still open. Draw after it closes.')
  }

  let body: { seed?: unknown; clusterQuestionId?: unknown } = {}
  try {
    const parsed: unknown = await c.req.json()
    if (parsed && typeof parsed === 'object') body = parsed as typeof body
  } catch {
    body = {}
  }
  // Restricted so personal data cannot end up in the stored seed and the audit log.
  if (body.seed !== undefined && (typeof body.seed !== 'string' || !SEED_PATTERN.test(body.seed))) {
    throw new ApiError(400, 'invalid_seed', 'The seed may use up to 64 letters, digits and . _ : -')
  }
  const seed = typeof body.seed === 'string' ? body.seed : crypto.randomUUID()

  const questions = parseQuestions(row.questions)
  let clusterQuestionId: string | null = null
  if (body.clusterQuestionId !== undefined) {
    const question = typeof body.clusterQuestionId === 'string'
      ? questions.find((q) => q.id === body.clusterQuestionId)
      : undefined
    if (!question || question.type !== 'choice') {
      throw new ApiError(400, 'invalid_cluster_question', 'Pick a multiple choice question to set quotas from.')
    }
    clusterQuestionId = question.id
  }

  let clusters: SelectionCluster[] = []
  if (clusterQuestionId) {
    const cl = await client.execute({
      sql: 'SELECT value, max_count, filters FROM event_clusters WHERE event_id = ? AND cluster_col = ? ORDER BY rowid',
      args: [eventId, clusterQuestionId],
    })
    clusters = cl.rows.map((r) => ({ value: String(r.value), maxCount: Number(r.max_count), filters: parseFilters(r.filters) }))
    // Filters can only test text and choice answers, which are exposed to the selection rows by question id.
    const filterable = new Set(questions.filter((q) => q.type === 'text' || q.type === 'choice').map((q) => q.id))
    for (const cluster of clusters) {
      for (const [col, vals] of Object.entries(cluster.filters)) {
        if (Array.isArray(vals) && vals.length > 0 && !filterable.has(col)) {
          throw new ApiError(422, 'unsupported_cluster_filter', 'A quota filter refers to something the draw cannot read. Remove it and try again.')
        }
      }
    }
    if (clusters.length === 0) throw new ApiError(400, 'no_clusters', 'Set quotas for the answers before drawing by cluster.')
  }

  const pool = await client.execute({
    sql: `SELECT id, answers FROM attendees WHERE event_id = ? AND status = 'entered' ORDER BY COALESCE(registered_at, ''), id`,
    args: [eventId],
  })
  const confirmedRes = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM attendees WHERE event_id = ? AND status = 'confirmed'",
    args: [eventId],
  })
  const capacity = row.max_attendees == null ? null : Number(row.max_attendees)
  const seats = capacity == null ? null : Math.max(0, capacity - Number(confirmedRes.rows[0]?.n ?? 0))

  // The email column is the attendee id so duplicate emails are never collapsed by the selection helper.
  const clusterOf = new Map<string, string>()
  const rows: SelectionRow[] = pool.rows.map((r) => {
    const id = String(r.id)
    const raw: Record<string, string> = { email: id }
    if (clusterQuestionId) {
      for (const q of questions) {
        if (q.type === 'text' || q.type === 'choice') raw[q.id] = answerOf(r.answers, q.id)
      }
      const value = answerOf(r.answers, clusterQuestionId)
      raw[CLUSTER_COL] = value
      if (value) clusterOf.set(id, value)
    }
    return { id, rawData: raw }
  })
  const { selected } = selectAttendees(rows, {
    mapping: { emailCol: 'email', clusterCol: clusterQuestionId ? CLUSTER_COL : null },
    clusters,
    globalFilters: {},
    guaranteed: [],
    seed,
    maxAttendees: seats,
  })
  // Cluster quotas can add up to more than the seats: pick which winners keep a seat with the seeded shuffle, so no
  // cluster wins by insertion order. If quotas add up to fewer than the seats the spare seats stay unfilled.
  const chosen = seats != null && selected.length > seats ? seededOrder(selected, `${seed}\0seats`).slice(0, seats) : selected
  const winners = chosen.map((r) => r.id)
  const winnerSet = new Set(winners)
  const losers = seededOrder(rows.filter((r) => !winnerSet.has(r.id)).map((r) => r.id), `${seed}\0waitlist`)
  const waitlist = Number(row.waitlist_enabled ?? 0) === 1

  const drawnAt = new Date()
  const stamp = sqlTime(drawnAt)
  // The guard runs first in the batch. Every decision below only applies while this draw's timestamp is the
  // one stored on the event, so a lost race (guard affects 0 rows) leaves the attendees untouched.
  const statements: InStatement[] = [{
    sql: 'UPDATE events SET lottery_drawn_at = ? WHERE id = ? AND lottery_drawn_at IS NULL',
    args: [stamp, eventId],
  }]
  const decide = (id: string, to: string, decidedAt: string): InStatement => ({
    sql: `UPDATE attendees SET status = ?, decided_at = ?, decided_by = ?, cluster_value = COALESCE(?, cluster_value)
          WHERE id = ? AND event_id = ? AND status = 'entered'
            AND EXISTS (SELECT 1 FROM events WHERE id = ? AND lottery_drawn_at = ?)
            AND (? <> 'confirmed' OR ? IS NULL OR (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?)`,
    args: [to, decidedAt, user.id, clusterOf.get(id) ?? null, id, eventId, eventId, stamp, to, capacity, eventId, capacity],
  })
  const loserStatus = waitlist ? 'waitlisted' : 'declined'
  const loserAt = (rank: number) => (waitlist ? sqlTime(new Date(drawnAt.getTime() + rank + 1)) : stamp)
  for (const id of winners) statements.push(decide(id, 'confirmed', stamp))
  losers.forEach((id, i) => statements.push(decide(id, loserStatus, loserAt(i))))
  // A winner refused by the seat guard (a seat was taken after we counted) is still 'entered' here and falls
  // behind the losers; for a winner that was confirmed these are no-ops.
  winners.forEach((id, i) => statements.push(decide(id, loserStatus, loserAt(losers.length + i))))

  const results = await client.batch(statements, 'write')
  if (Number(results[0].rowsAffected) !== 1) throw conflict('already_drawn', 'This lottery has already been drawn.')

  let confirmed = 0
  let waitlisted = 0
  let declined = 0
  results.slice(1).forEach((r, i) => {
    if (Number(r.rowsAffected) !== 1) return
    if (i < winners.length) confirmed++
    else if (waitlist) waitlisted++
    else declined++
  })

  // Best effort: the draw is committed, so a failed audit write must not turn it into a 500.
  try {
    await recordAudit(client, {
      actorUserId: user.id,
      action: 'tix.draw',
      targetType: 'event',
      targetId: eventId,
      meta: { confirmed, waitlisted, declined, seed },
    })
  } catch {
    // swallowed on purpose
  }

  return c.json({ confirmed, waitlisted, declined, seed })
})

export default app
