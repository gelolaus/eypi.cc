import { Hono } from 'hono'
import type { Client } from '@libsql/client/web'
import { db, type Bindings } from '../lib/db'
import { badRequest, forbidden, notFound, unauthorized } from '../lib/errors'
import { asUtc, manilaDay, manilaTimestamp } from '../lib/manilaTime'
import { isOrgFeature } from '../middleware/orgGuard'
import { attachSession } from '../middleware/requireAuth'
import { enforceConsent } from '../middleware/requireConsent'
import { addDays } from '../lib/links/analyticsQuery'
import { actionError, requireEventLead } from './events/shared'

const DEFAULT_DAYS = 30
const MAX_DAYS = 400
const STATUS_ORDER = ['pending', 'entered', 'waitlisted', 'confirmed', 'declined', 'cancelled']

const app = new Hono<{ Bindings: Bindings }>()

function parseDays(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_DAYS
  if (!/^\d{1,3}$/.test(raw)) throw badRequest('invalid_days', `Use a number of days from 1 to ${MAX_DAYS}.`)
  const days = Number(raw)
  if (days < 1 || days > MAX_DAYS) throw badRequest('invalid_days', `Use a number of days from 1 to ${MAX_DAYS}.`)
  return days
}

/**
 * A campaign's frames events: the subject is the campaign id or `<id>:<frame>`. Matched as exact or the range
 * [`<id>:`, `<id>;`) (';' follows ':'), never LIKE, because '_' is a wildcard. `?1` is the campaign id.
 */
const CAMPAIGN_EVENTS = "module = 'frames' AND (subject_id = ?1 OR (subject_id >= ?1 || ':' AND subject_id < ?1 || ';'))"

// GET /api/dp/:id/insights?days=30
app.get('/api/dp/:id/insights', isOrgFeature, async (c) => {
  const days = parseDays(c.req.query('days'))
  const id = String(c.req.param('id'))
  const client = db(c)
  const campaign = await client.execute({ sql: 'SELECT org_id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (campaign.rows.length === 0) throw notFound('Campaign not found.')
  if (!c.var.orgId || campaign.rows[0].org_id !== c.var.orgId) throw forbidden('forbidden', 'Forbidden.')

  const today = manilaDay(new Date())
  const from = addDays(today, -(days - 1))

  // Visitors, not events: per Manila day, one person counts once per step however often they repeat it or
  // however many frames they save. The visitor hash changes every day, so someone back on another day counts again.
  // Read from raw events (kept 400 days): the rollup only has uniques per frame, which cannot be combined.
  const [perDayRows, perFrameRows, savesRow] = await Promise.all([
    client.execute({
      sql: `SELECT day, action, COUNT(DISTINCT visitor_hash) AS n FROM module_events
            WHERE ${CAMPAIGN_EVENTS} AND day >= ?2 AND day <= ?3 GROUP BY day, action`,
      args: [id, from, today],
    }),
    client.execute({
      sql: `SELECT subject_id, day, COUNT(DISTINCT visitor_hash) AS n FROM module_events
            WHERE ${CAMPAIGN_EVENTS} AND action = 'download' AND day >= ?2 AND day <= ?3 GROUP BY subject_id, day`,
      args: [id, from, today],
    }),
    // Every download and copy ever, the number the Frames list and the public page show.
    client.execute({
      sql: `SELECT COUNT(*) AS n FROM module_events WHERE ${CAMPAIGN_EVENTS} AND action IN ('download', 'share')`,
      args: [id],
    }),
  ])

  const funnel = { visitors: 0, photo_added: 0, download: 0, share: 0 }
  const perDay = new Map<string, { visitors: number; downloads: number; copies: number }>()
  for (const row of perDayRows.rows) {
    const n = Number(row.n)
    const bucket = perDay.get(String(row.day)) ?? { visitors: 0, downloads: 0, copies: 0 }
    perDay.set(String(row.day), bucket)
    if (row.action === 'view') { funnel.visitors += n; bucket.visitors += n }
    else if (row.action === 'photo_added') funnel.photo_added += n
    else if (row.action === 'download') { funnel.download += n; bucket.downloads += n }
    else if (row.action === 'share') { funnel.share += n; bucket.copies += n }
  }
  const perFrameCount = new Map<string, number>()
  for (const row of perFrameRows.rows) {
    const subject = String(row.subject_id)
    if (subject.length <= id.length) continue // a download with no frame id has no frame bar
    const frameId = subject.slice(id.length + 1)
    perFrameCount.set(frameId, (perFrameCount.get(frameId) ?? 0) + Number(row.n))
  }

  const frames = await client.execute({
    sql: 'SELECT id, label FROM dp_frames WHERE campaign_id = ? ORDER BY position, created_at',
    args: [id],
  })
  const perFrame = frames.rows.map((frame, index) => {
    const label = frame.label == null ? '' : String(frame.label).trim()
    return {
      frameId: String(frame.id),
      label: label || `Frame ${index + 1}`,
      downloads: perFrameCount.get(String(frame.id)) ?? 0,
    }
  })

  const daily: { day: string; visitors: number; downloads: number; copies: number }[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i)
    const bucket = perDay.get(day)
    daily.push({ day, visitors: bucket?.visitors ?? 0, downloads: bucket?.downloads ?? 0, copies: bucket?.copies ?? 0 })
  }

  c.header('Cache-Control', 'private, no-store')
  return c.json({
    funnel,
    // A visit may not be counted (a dropped beacon), so downloaders can outnumber visitors; the rate is capped at 1.
    conversion: funnel.visitors > 0 ? Math.min(1, funnel.download / funnel.visitors) : 0,
    totals: { downloadsAndCopies: Number(savesRow.rows[0]?.n ?? 0) },
    perFrame,
    daily,
  })
})

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

type Question = { id: string; type: string; options: string[] }

function readQuestions(raw: unknown): Question[] {
  const parsed = parseJson(raw)
  if (!Array.isArray(parsed)) return []
  const questions: Question[] = []
  for (const q of parsed) {
    if (!q || typeof q !== 'object') continue
    const { id, type, options } = q as Record<string, unknown>
    if (typeof id !== 'string' || (type !== 'choice' && type !== 'checkbox') || !Array.isArray(options)) continue
    questions.push({ id, type, options: options.filter((o): o is string => typeof o === 'string') })
  }
  return questions
}

// GET /api/events/:slug/insights (org members of the event's org)
app.get('/api/events/:slug/insights', async (c) => {
  if (!c.var.user) return c.json(actionError('unauthorized', 'Authentication required.'), 401)
  const client = db(c)
  const lead = await requireEventLead(client, c.req.param('slug'), c.var.orgId)
  if (!lead.ok) return c.json(actionError(lead.status === 404 ? 'not_found' : 'forbidden', lead.message), lead.status)
  const eventId = lead.event.id

  const [statusRes, dailyRes, answerRes, eventRes, showUpRes, curveRes] = await Promise.all([
    client.execute({ sql: 'SELECT status, COUNT(*) AS n FROM attendees WHERE event_id = ? GROUP BY status', args: [eventId] }),
    client.execute({
      sql: `SELECT date(registered_at, '+8 hours') AS day, COUNT(*) AS n FROM attendees
            WHERE event_id = ? AND registered_at IS NOT NULL GROUP BY 1 ORDER BY 1`,
      args: [eventId],
    }),
    client.execute({
      sql: "SELECT answers FROM attendees WHERE event_id = ? AND status NOT IN ('cancelled', 'declined')",
      args: [eventId],
    }),
    client.execute({ sql: 'SELECT questions FROM events WHERE id = ?', args: [eventId] }),
    client.execute({
      sql: `SELECT COUNT(*) AS confirmed,
                   COALESCE(SUM(EXISTS (SELECT 1 FROM check_ins ci
                                   WHERE ci.attendee_id = a.id AND ci.action = 'checked_in')), 0) AS checked_in
            FROM attendees a WHERE a.event_id = ? AND a.status = 'confirmed'`,
      args: [eventId],
    }),
    client.execute({
      sql: `SELECT MIN(ci.actioned_at) AS at FROM check_ins ci JOIN attendees a ON a.id = ci.attendee_id
            WHERE ci.event_id = ? AND ci.action = 'checked_in' AND a.status = 'confirmed' GROUP BY ci.attendee_id`,
      args: [eventId],
    }),
  ])

  const counts = new Map(statusRes.rows.map((r) => [String(r.status), Number(r.n)]))
  const byStatus = [...counts.keys()]
    .sort((a, b) => (STATUS_ORDER.indexOf(a) + 1 || 99) - (STATUS_ORDER.indexOf(b) + 1 || 99))
    .map((status) => ({ status, n: counts.get(status) ?? 0 }))

  const tallies = new Map<string, Map<string, number>>()
  const questions = readQuestions(eventRes.rows[0]?.questions)
  for (const q of questions) tallies.set(q.id, new Map(q.options.map((o) => [o, 0])))
  for (const row of answerRes.rows) {
    const answers = parseJson(row.answers)
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) continue
    for (const q of questions) {
      const given = (answers as Record<string, unknown>)[q.id]
      const values = Array.isArray(given) ? given : [given]
      const tally = tallies.get(q.id)!
      for (const v of new Set(values)) {
        if (typeof v === 'string' && tally.has(v)) tally.set(v, (tally.get(v) ?? 0) + 1)
      }
    }
  }
  const byAnswer = questions.map((q) => ({
    questionId: q.id,
    options: [...tallies.get(q.id)!].map(([value, n]) => ({ value, n })),
  }))

  const confirmed = Number(showUpRes.rows[0]?.confirmed ?? 0)
  const checkedIn = Number(showUpRes.rows[0]?.checked_in ?? 0)

  const buckets = new Map<string, number>()
  for (const row of curveRes.rows) {
    const local = manilaTimestamp(asUtc(String(row.at)))
    const bucket = `${local.slice(11, 15)}0`
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }

  c.header('Cache-Control', 'private, no-store')
  return c.json({
    byStatus,
    registrationsDaily: dailyRes.rows.map((r) => ({ day: String(r.day), n: Number(r.n) })),
    byAnswer,
    showUpRate: confirmed > 0 ? checkedIn / confirmed : null,
    checkInCurve: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, n]) => ({ bucket, n })),
  })
})

type DayRow = { day: string; n: number }

/** Org profile views for Manila days from..today: rollups before today, raw rows for today (never today's rollup). */
async function loadOrgViewRows(client: Client, orgId: string, from: string, today: string): Promise<DayRow[]> {
  const rows: DayRow[] = []
  const rollupTo = addDays(today, -1)
  if (from <= rollupTo) {
    const result = await client.execute({
      sql: `SELECT day, SUM(n) AS n FROM module_daily
            WHERE module = 'org' AND subject_id = ? AND action = 'view' AND day >= ? AND day <= ? GROUP BY day`,
      args: [orgId, from, rollupTo],
    })
    for (const r of result.rows) rows.push({ day: String(r.day), n: Number(r.n) })
  }
  const result = await client.execute({
    sql: "SELECT day, COUNT(*) AS n FROM module_events WHERE module = 'org' AND subject_id = ? AND action = 'view' AND day = ? GROUP BY day",
    args: [orgId, today],
  })
  for (const r of result.rows) rows.push({ day: String(r.day), n: Number(r.n) })
  return rows
}

/** Frames events for every campaign of the org in the window; same exact-or-range match as above, never LIKE. */
async function loadOrgFramesTotals(client: Client, orgId: string, from: string, today: string): Promise<{ views: number; downloads: number }> {
  const join = "JOIN dp_campaigns c ON c.org_id = ?1 AND (t.subject_id = c.id OR (t.subject_id >= c.id || ':' AND t.subject_id < c.id || ';'))"
  const totals = { views: 0, downloads: 0 }
  const add = (rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      if (r.action === 'view') totals.views += Number(r.n)
      else if (r.action === 'download' || r.action === 'share') totals.downloads += Number(r.n)
    }
  }
  const rollupTo = addDays(today, -1)
  if (from <= rollupTo) {
    const result = await client.execute({
      sql: `SELECT t.action AS action, SUM(t.n) AS n FROM module_daily t ${join}
            WHERE t.module = 'frames' AND t.day >= ?2 AND t.day <= ?3 GROUP BY t.action`,
      args: [orgId, from, rollupTo],
    })
    add(result.rows)
  }
  const result = await client.execute({
    sql: `SELECT t.action AS action, COUNT(*) AS n FROM module_events t ${join}
          WHERE t.module = 'frames' AND t.day = ?2 GROUP BY t.action`,
    args: [orgId, today],
  })
  add(result.rows)
  return totals
}

// GET /api/orgs/:org_id/insights?days=30 (activated members of the org, aggregates only)
app.get('/api/orgs/:org_id/insights', async (c) => {
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  const user = c.var.user
  if (!user?.id) throw unauthorized()
  const denied = await enforceConsent(c)
  if (denied) return denied
  const orgId = c.req.param('org_id')
  const client = db(c)
  const org = await client.execute({ sql: 'SELECT id, owner_id FROM organizations WHERE id = ?', args: [orgId] })
  if (org.rows.length === 0) throw notFound('Organization not found.')
  if (org.rows[0].owner_id !== user.id) {
    const member = await client.execute({
      sql: 'SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND activated_at IS NOT NULL LIMIT 1',
      args: [orgId, user.id],
    })
    if (member.rows.length === 0) throw forbidden('forbidden', 'Forbidden.')
  }
  const days = parseDays(c.req.query('days'))
  const today = manilaDay(new Date())
  const from = addDays(today, -(days - 1))

  const [viewRows, frames, campaigns, tix, joined, before] = await Promise.all([
    loadOrgViewRows(client, orgId, from, today),
    loadOrgFramesTotals(client, orgId, from, today),
    client.execute({ sql: 'SELECT COUNT(*) AS n FROM dp_campaigns WHERE org_id = ?', args: [orgId] }),
    client.execute({
      sql: `SELECT (SELECT COUNT(*) FROM events WHERE org_id = ?1) AS events,
                   (SELECT COUNT(*) FROM attendees a JOIN events e ON e.id = a.event_id
                     WHERE e.org_id = ?1 AND a.status NOT IN ('cancelled', 'declined')) AS registrations,
                   (SELECT COUNT(DISTINCT ci.attendee_id) FROM check_ins ci JOIN events e ON e.id = ci.event_id
                     WHERE e.org_id = ?1 AND ci.action = 'checked_in') AS check_ins`,
      args: [orgId],
    }),
    client.execute({
      sql: `SELECT date(activated_at, '+8 hours') AS day, COUNT(*) AS n FROM org_members
            WHERE org_id = ? AND activated_at IS NOT NULL AND date(activated_at, '+8 hours') >= ? GROUP BY 1`,
      args: [orgId, from],
    }),
    client.execute({
      sql: `SELECT COUNT(*) AS n FROM org_members
            WHERE org_id = ? AND activated_at IS NOT NULL AND date(activated_at, '+8 hours') < ?`,
      args: [orgId, from],
    }),
  ])

  const viewsByDay = new Map<string, number>()
  for (const row of viewRows) viewsByDay.set(row.day, (viewsByDay.get(row.day) ?? 0) + row.n)
  const joinedByDay = new Map(joined.rows.map((r) => [String(r.day), Number(r.n)]))
  let members = Number(before.rows[0]?.n ?? 0)
  const profileDaily: { day: string; n: number }[] = []
  const memberDaily: { day: string; count: number }[] = []
  let total = 0
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i)
    const n = viewsByDay.get(day) ?? 0
    total += n
    profileDaily.push({ day, n })
    members += joinedByDay.get(day) ?? 0
    memberDaily.push({ day, count: members })
  }

  c.header('Cache-Control', 'private, no-store')
  return c.json({
    profileViews: { total, daily: profileDaily },
    frames: { campaigns: Number(campaigns.rows[0]?.n ?? 0), views: frames.views, downloads: frames.downloads },
    tix: {
      events: Number(tix.rows[0]?.events ?? 0),
      registrations: Number(tix.rows[0]?.registrations ?? 0),
      checkIns: Number(tix.rows[0]?.check_ins ?? 0),
    },
    members: { daily: memberDaily },
  })
})

export default app
