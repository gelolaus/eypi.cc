import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { noOrgBody } from '../../middleware/orgContext'
import { selectAttendees } from '../../../../src/lib/tix/selection'
import { actionError, ALREADY_FINALIZED, attendeeHasFirstName, requireEventLead } from './shared'

const SQL_IN_CHUNK = 200

function inChunks<T>(items: readonly T[], size = SQL_IN_CHUNK): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// Latest check-in wins, including ties at the same second (higher rowid).
// A removed attendee does not occupy a cluster slot.
const ACTIVE_CLUSTER_COUNT_SQL = `SELECT COUNT(*) as cnt
    FROM attendees a
    WHERE a.event_id = ? AND a.cluster_value = ?
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.attendee_id = a.id
          AND ci.action = 'removed'
          AND ci.rowid = (
            SELECT c2.rowid FROM check_ins c2
            WHERE c2.attendee_id = a.id
            ORDER BY c2.actioned_at DESC, c2.rowid DESC
            LIMIT 1
          )
      )`

// Ticketing routes (formerly the tix.eypi.cc backend). Mounted into the unified
// eypi.cc Worker in index.ts. CORS, preflight, and security headers are applied

function passFieldsFromBody(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const names: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const name = item.trim()
    if (!name || names.includes(name)) continue
    names.push(name)
  }
  return names
}

const app = new Hono<{ Bindings: Bindings }>()

// ── POST /api/events ─────────────────────────────────────────────────────────
// Create event. When attendees is absent/empty, creates in selection mode
// (selection_locked=0) and returns selectionLocked:false for frontend redirect.
app.post('/api/events', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const body = await c.req.json() as {
    name: string
    slug: string
    date: string
    time: string
    location: string
    maxAttendees?: number | null
    attendees?: { firstName: string; lastName: string; email: string }[]
  }

  if (!body.name?.trim() || !body.slug?.trim() || !body.date || !body.time || !body.location?.trim()) {
    return c.json({ status: 'error', message: 'All event fields are required.' }, 400)
  }
  if (!/^[a-z0-9]+$/.test(body.slug)) {
    return c.json({ status: 'error', message: 'Slug must be lowercase letters and numbers only.' }, 400)
  }

  const hasAttendees = Array.isArray(body.attendees) && body.attendees.length > 0
  // Legacy mode requires attendees; selection mode requires none
  if (!hasAttendees && body.attendees !== undefined && body.attendees !== null && Array.isArray(body.attendees) && body.attendees.length === 0) {
    // Empty array explicitly sent — treat as selection mode
  } else if (!hasAttendees && body.attendees != null) {
    // Non-empty validation only for legacy (when attendees key is present and non-null)
  }

  const client = db(c)
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)

  const existing = await client.execute({ sql: 'SELECT id FROM events WHERE slug = ?', args: [body.slug] })
  if (existing.rows.length > 0) {
    return c.json({ status: 'error', message: 'Slug already taken — choose another.' }, 409)
  }

  const eventId = crypto.randomUUID()
  const selectionLocked = hasAttendees ? 1 : 0
  const maxAttendees = body.maxAttendees ?? null

  if (hasAttendees && body.attendees!.some((attendee) => !attendeeHasFirstName(attendee))) {
    return c.json(actionError('missing_first_name', 'Every attendee needs a first name.'), 422)
  }

  await client.execute({
    sql: 'INSERT INTO events (id, slug, lead_user_id, org_id, name, event_date, event_time, location, max_attendees, selection_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [eventId, body.slug, user.id, orgId, body.name.trim(), body.date, body.time, body.location.trim(), maxAttendees, selectionLocked],
  })

  if (!hasAttendees) {
    return c.json({
      status: 'ok',
      event: { id: eventId, slug: body.slug },
      selectionLocked: false,
      attendees: [],
    }, 201)
  }

  // Legacy path: bulk-insert provided attendees
  const seen = new Set<string>()
  const unique = body.attendees!
    .filter(a => a.email?.trim())
    .filter(a => {
      const key = a.email.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(a => ({
      id: crypto.randomUUID(),
      qrToken: crypto.randomUUID(),
      firstName: a.firstName.trim(),
      lastName: a.lastName.trim(),
      email: a.email.toLowerCase().trim(),
    }))

  if (!unique.length) {
    return c.json({ status: 'error', message: 'At least one valid attendee is required.' }, 400)
  }

  await client.batch(
    unique.map(a => ({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token) VALUES (?, ?, ?, ?, ?, ?)',
      args: [a.id, eventId, a.firstName, a.lastName, a.email, a.qrToken],
    }))
  )

  return c.json({
    status: 'ok',
    event: { id: eventId, slug: body.slug },
    selectionLocked: true,
    attendees: unique.map(({ id, firstName, lastName, email, qrToken }) => ({ id, firstName, lastName, email, qrToken })),
  }, 201)
})

// ── GET /api/events ───────────────────────────────────────────────────────────
app.get('/api/events', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const client = db(c)
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)

  const result = await client.execute({
    sql: 'SELECT id, slug, name, event_date, event_time, location, created_at FROM events WHERE org_id = ? ORDER BY created_at DESC',
    args: [orgId],
  })

  return c.json({ status: 'ok', events: result.rows })
})

// ── GET /api/events/:slug/attendees ───────────────────────────────────────────
app.get('/api/events/:slug/attendees', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const result = await client.execute({
    sql: `
      SELECT a.id, a.first_name, a.last_name, a.email, a.qr_token, a.cluster_value,
             ci.action AS status, ci.actioned_at
      FROM attendees a
      LEFT JOIN (
        SELECT attendee_id, action, actioned_at,
               ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY actioned_at DESC, rowid DESC) AS rn
        FROM check_ins
        WHERE event_id = ?
      ) ci ON ci.attendee_id = a.id AND ci.rn = 1
      WHERE a.event_id = ?
      ORDER BY a.first_name, a.last_name`,
    args: [event.id, event.id],
  })

  return c.json({ status: 'ok', attendees: result.rows })
})

// ── POST /api/events/:slug/clusters ──────────────────────────────────────────
// Save cluster configuration. Only before finalization.
app.post('/api/events/:slug/clusters', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (event.selection_locked === 1) return c.json({ status: 'error', message: 'Event is already finalized.' }, 409)

  const body = await c.req.json() as {
    clusterCol: string
    clusters: { value: string; maxCount: number; filters: Record<string, string[]> }[]
  }
  if (!body.clusters?.length) return c.json({ status: 'error', message: 'At least one cluster is required.' }, 400)

  const totalMax = body.clusters.reduce((s, c) => s + (c.maxCount || 0), 0)

  await client.batch([
    { sql: 'DELETE FROM event_clusters WHERE event_id = ?', args: [event.id] },
    ...body.clusters.map(cl => ({
      sql: 'INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count, filters) VALUES (?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), event.id as string, body.clusterCol, cl.value, cl.maxCount, JSON.stringify(cl.filters ?? {})],
    })),
    {
      sql: 'UPDATE events SET max_attendees = ? WHERE id = ?',
      args: [totalMax, event.id],
    },
  ], 'write')

  return c.json({ status: 'ok' })
})

// ── GET /api/events/:slug/clusters ────────────────────────────────────────────
// Returns cluster configs with live fill status.
app.get('/api/events/:slug/clusters', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const clustersRes = await client.execute({
    sql: 'SELECT id, cluster_col, value, max_count, filters FROM event_clusters WHERE event_id = ? ORDER BY rowid',
    args: [event.id],
  })

  const knownValues = new Set(clustersRes.rows.map(r => r.value as string))

  const clusters = await Promise.all(clustersRes.rows.map(async (cl) => {
    const countRes = await client.execute({ sql: ACTIVE_CLUSTER_COUNT_SQL, args: [event.id, cl.value] })
    const currentCount = Number(countRes.rows[0]?.cnt ?? 0)
    const maxCount = cl.max_count !== null ? Number(cl.max_count) : null
    return {
      id:             cl.id,
      clusterCol:     cl.cluster_col,
      value:          cl.value,
      maxCount,
      filters:        JSON.parse(cl.filters as string ?? '{}'),
      currentCount,
      remainingSlots: maxCount !== null ? Math.max(0, maxCount - currentCount) : null,
    }
  }))

  // Also surface ad-hoc clusters (cluster_value on attendees not in event_clusters)
  const adHocRes = await client.execute({
    sql: `SELECT DISTINCT cluster_value FROM attendees
          WHERE event_id = ? AND cluster_value IS NOT NULL AND cluster_value != ''`,
    args: [event.id],
  })
  for (const row of adHocRes.rows) {
    const val = row.cluster_value as string
    if (knownValues.has(val)) continue
    const countRes = await client.execute({ sql: ACTIVE_CLUSTER_COUNT_SQL, args: [event.id, val] })
    clusters.push({
      id:             null as unknown as string,
      clusterCol:     '',
      value:          val,
      maxCount:       null,
      filters:        {},
      currentCount:   Number(countRes.rows[0]?.cnt ?? 0),
      remainingSlots: null,
    } as typeof clusters[number])
  }

  return c.json({ status: 'ok', clusters })
})

// ── POST /api/events/:slug/finalize ──────────────────────────────────────────
// Create attendees from selected CSV row IDs. Locks the event.
app.post('/api/events/:slug/finalize', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (Number(event.selection_locked) === 1) return c.json(ALREADY_FINALIZED, 409)

  const body = await c.req.json() as {
    selectedRows: { rowId: string; clusterValue: string | null }[]
    maxAttendees: number | null
    columnMapping?: {
      emailCol: string | null
      firstNameCol: string | null
      lastNameCol: string | null
      fullNameCol: string | null
    }
  }
  if (!body.selectedRows?.length) return c.json({ status: 'error', message: 'No rows selected.' }, 400)

  // Use mapping from request body (reflects user's confirmed column assignments)
  // Fall back to DB mapping only if not provided in request
  let m: { email_col: unknown; first_name_col: unknown; last_name_col: unknown; full_name_col: unknown }
  if (body.columnMapping?.emailCol) {
    m = {
      email_col:      body.columnMapping.emailCol,
      first_name_col: body.columnMapping.firstNameCol ?? null,
      last_name_col:  body.columnMapping.lastNameCol  ?? null,
      full_name_col:  body.columnMapping.fullNameCol  ?? null,
    }
  } else {
    const mappingRes = await client.execute({
      sql: 'SELECT first_name_col, last_name_col, full_name_col, email_col FROM event_column_mappings WHERE event_id = ?',
      args: [event.id],
    })
    if (!mappingRes.rows.length) return c.json({ status: 'error', message: 'No column mapping found. Upload CSV first.' }, 400)
    m = mappingRes.rows[0] as unknown as typeof m
  }

  // Validate all row IDs belong to this event. Chunk the IN list under SQLite's variable limit.
  const rowIds = body.selectedRows.map(r => r.rowId)
  const rowMap = new Map<string, Record<string, string>>()
  for (const chunk of inChunks(rowIds)) {
    const placeholders = chunk.map(() => '?').join(',')
    const rowsRes = await client.execute({
      sql: `SELECT id, raw_data FROM event_csv_rows WHERE event_id = ? AND id IN (${placeholders})`,
      args: [event.id, ...chunk],
    })
    for (const row of rowsRes.rows) {
      rowMap.set(row.id as string, JSON.parse(row.raw_data as string) as Record<string, string>)
    }
  }

  const seen = new Set<string>()
  const attendees: { id: string; csvRowId: string; qrToken: string; firstName: string; lastName: string; email: string; clusterValue: string | null }[] = []

  for (const sel of body.selectedRows) {
    const raw = rowMap.get(sel.rowId)
    if (!raw) continue

    const emailRaw = (m.email_col ? raw[m.email_col as string] ?? '' : '').trim().toLowerCase()
    if (!emailRaw || seen.has(emailRaw)) continue
    seen.add(emailRaw)

    let firstName = ''
    let lastName = ''
    if (m.first_name_col && m.last_name_col) {
      firstName = (raw[m.first_name_col as string] ?? '').trim()
      lastName  = (raw[m.last_name_col  as string] ?? '').trim()
    } else if (m.full_name_col) {
      const parts = (raw[m.full_name_col as string] ?? '').trim().split(' ')
      firstName = parts[0] ?? ''
      lastName  = parts.slice(1).join(' ')
    }

    attendees.push({
      id:           crypto.randomUUID(),
      csvRowId:     sel.rowId,
      qrToken:      crypto.randomUUID(),
      firstName,
      lastName,
      email:        emailRaw,
      clusterValue: sel.clusterValue ?? null,
    })
  }

  if (!attendees.length) return c.json({ status: 'error', message: 'No valid attendees could be derived from selected rows.' }, 400)

  const locked = await client.execute({
    sql: 'UPDATE events SET selection_locked = 1 WHERE id = ? AND selection_locked = 0',
    args: [event.id],
  })
  if (Number(locked.rowsAffected) !== 1) return c.json(ALREADY_FINALIZED, 409)

  try {
    await client.batch([
      ...attendees.map(a => ({
        sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value, csv_row_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [a.id, event.id as string, a.firstName, a.lastName, a.email, a.qrToken, a.clusterValue, a.csvRowId],
      })),
      ...inChunks(rowIds).map(chunk => ({
        sql: `UPDATE event_csv_rows SET is_selected = 1 WHERE event_id = ? AND id IN (${chunk.map(() => '?').join(',')})`,
        args: [event.id, ...chunk],
      })),
      {
        sql: 'UPDATE events SET max_attendees = ? WHERE id = ?',
        args: [body.maxAttendees ?? null, event.id],
      },
    ], 'write')
  } catch (error) {
    await client.batch([
      { sql: 'DELETE FROM attendees WHERE event_id = ?', args: [event.id] },
      { sql: 'UPDATE events SET selection_locked = 0 WHERE id = ?', args: [event.id] },
    ], 'write')
    throw error
  }

  return c.json({
    status: 'ok',
    attendees: attendees.map(({ id, firstName, lastName, email, qrToken, clusterValue }) => ({ id, firstName, lastName, email, qrToken, clusterValue })),
  })
})

// ── POST /api/events/:slug/clusters/:value/raffle ─────────────────────────────
// Re-raffle a cluster to fill remaining slots from unselected eligible rows.
app.post('/api/events/:slug/clusters/:value/raffle', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const clusterValue = decodeURIComponent(c.req.param('value'))
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (event.selection_locked !== 1) return c.json({ status: 'error', message: 'Event is not finalized yet.' }, 409)

  const clusterRes = await client.execute({
    sql: 'SELECT id, max_count, filters FROM event_clusters WHERE event_id = ? AND value = ?',
    args: [event.id, clusterValue],
  })
  if (!clusterRes.rows.length) return c.json({ status: 'error', message: 'Cluster not found.' }, 404)
  const cluster = clusterRes.rows[0]

  const countRes = await client.execute({
    sql: ACTIVE_CLUSTER_COUNT_SQL,
    args: [event.id, clusterValue],
  })
  const currentCount = Number(countRes.rows[0]?.cnt ?? 0)
  const remaining = Number(cluster.max_count) - currentCount
  if (remaining <= 0) return c.json({ status: 'error', message: 'This cluster is already full.' }, 409)

  // Fetch column mapping
  const mappingRes = await client.execute({
    sql: 'SELECT first_name_col, last_name_col, full_name_col, email_col, cluster_col FROM event_column_mappings WHERE event_id = ?',
    args: [event.id],
  })
  if (!mappingRes.rows.length) return c.json({ status: 'error', message: 'Column mapping not found.' }, 400)
  const m = mappingRes.rows[0]
  const emailCol = (m.email_col as string | null) ?? ''

  // Fetch all unselected rows. selectAttendees applies the cluster filters,
  // dedupes by email, then fills only the remaining active slots.
  const allUnselected = await client.execute({
    sql: 'SELECT id, raw_data FROM event_csv_rows WHERE event_id = ? AND is_selected = 0',
    args: [event.id],
  })

  const filters: Record<string, string[]> = JSON.parse(cluster.filters as string ?? '{}')

  const existingEmailRes = await client.execute({
    sql: 'SELECT email FROM attendees WHERE event_id = ?',
    args: [event.id],
  })
  const existingEmails = new Set(existingEmailRes.rows.map(r => (r.email as string).toLowerCase()))

  const available = allUnselected.rows.flatMap((row) => {
    const raw = JSON.parse(row.raw_data as string) as Record<string, string>
    const email = (emailCol ? raw[emailCol] ?? '' : '').trim().toLowerCase()
    if (!email || existingEmails.has(email)) return []
    return [{ id: row.id as string, rawData: raw }]
  })

  const { selected } = selectAttendees(available, {
    mapping: {
      emailCol,
      clusterCol: (m.cluster_col as string | null) ?? null,
    },
    clusters: [{ value: clusterValue, maxCount: remaining, filters }],
    globalFilters: {},
    guaranteed: [],
    seed: crypto.randomUUID(),
  })

  if (!selected.length) return c.json({ status: 'error', message: 'No eligible unselected respondents remain for this cluster.' }, 404)

  const newAttendees: { id: string; qrToken: string; firstName: string; lastName: string; email: string; csvRowId: string }[] = []
  const winnerIds: string[] = []

  for (const winner of selected) {
    const raw = winner.rawData
    const emailRaw = (emailCol ? raw[emailCol] ?? '' : '').trim().toLowerCase()
    if (!emailRaw || existingEmails.has(emailRaw)) continue
    existingEmails.add(emailRaw)

    let firstName = '', lastName = ''
    if (m.first_name_col && m.last_name_col) {
      firstName = (raw[m.first_name_col as string] ?? '').trim()
      lastName  = (raw[m.last_name_col  as string] ?? '').trim()
    } else if (m.full_name_col) {
      const parts = (raw[m.full_name_col as string] ?? '').trim().split(' ')
      firstName = parts[0] ?? ''
      lastName  = parts.slice(1).join(' ')
    }

    newAttendees.push({ id: crypto.randomUUID(), qrToken: crypto.randomUUID(), firstName, lastName, email: emailRaw, csvRowId: winner.id })
    winnerIds.push(winner.id)
  }

  if (!newAttendees.length) return c.json({ status: 'error', message: 'No new eligible attendees could be added.' }, 404)

  await client.batch([
    ...newAttendees.map(a => ({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value, csv_row_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [a.id, event.id as string, a.firstName, a.lastName, a.email, a.qrToken, clusterValue, a.csvRowId],
    })),
    ...inChunks(winnerIds).map(chunk => ({
      sql: `UPDATE event_csv_rows SET is_selected = 1 WHERE event_id = ? AND id IN (${chunk.map(() => '?').join(',')})`,
      args: [event.id, ...chunk],
    })),
  ], 'write')

  return c.json({
    status: 'ok',
    attendees: newAttendees.map(({ id, firstName, lastName, email, qrToken }) => ({ id, firstName, lastName, email, qrToken })),
  })
})

// ── DELETE /api/events/:slug ──────────────────────────────────────────────────
app.delete('/api/events/:slug', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const eventId = event.id as string
  await client.batch([
    { sql: 'DELETE FROM check_ins WHERE event_id = ?',           args: [eventId] },
    { sql: 'DELETE FROM attendees WHERE event_id = ?',           args: [eventId] },
    { sql: 'DELETE FROM event_csv_rows WHERE event_id = ?',      args: [eventId] },
    { sql: 'DELETE FROM event_column_mappings WHERE event_id = ?', args: [eventId] },
    { sql: 'DELETE FROM event_clusters WHERE event_id = ?',      args: [eventId] },
    { sql: 'DELETE FROM events WHERE id = ?',                    args: [eventId] },
  ])

  return c.json({ status: 'ok', message: 'Event deleted.' })
})

// ── PATCH /api/events/:slug ───────────────────────────────────────────────────
app.patch('/api/events/:slug', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as {
    maxAttendees?: number | null
    name?: string
    date?: string
    time?: string
    location?: string
    passFields?: unknown
  }

  const updates: string[] = []
  const args: unknown[] = []
  if ('passFields' in body) {
    const fields = passFieldsFromBody(body.passFields)
    if (!fields) return c.json({ status: 'error', message: 'Pass fields must be a list of column names.' }, 400)
    updates.push('pass_fields = ?')
    args.push(JSON.stringify(fields))
  }
  if ('maxAttendees' in body) { updates.push('max_attendees = ?'); args.push(body.maxAttendees ?? null) }
  if (body.name?.trim())     { updates.push('name = ?');           args.push(body.name.trim()) }
  if (body.date)             { updates.push('event_date = ?');     args.push(body.date) }
  if (body.time)             { updates.push('event_time = ?');     args.push(body.time) }
  if (body.location?.trim()) { updates.push('location = ?');       args.push(body.location.trim()) }

  if (!updates.length) return c.json({ status: 'error', message: 'Nothing to update.' }, 400)

  args.push(event.id)
  await client.execute({ sql: `UPDATE events SET ${updates.join(', ')} WHERE id = ?`, args: args as import('@libsql/client').InValue[] })

  return c.json({ status: 'ok' })
})

// ── GET /api/events/:slug/csv-rows/search ─────────────────────────────────────
app.get('/api/events/:slug/csv-rows/search', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const q = (c.req.query('q') ?? '').trim()
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const rows = await client.execute({
    sql: 'SELECT id, row_index, raw_data, is_selected FROM event_csv_rows WHERE event_id = ? AND raw_data LIKE ? LIMIT 20',
    args: [event.id, q ? `%${q}%` : '%'],
  })

  return c.json({
    status: 'ok',
    rows: rows.rows.map(r => ({
      id:         r.id,
      rowIndex:   r.row_index,
      rawData:    JSON.parse(r.raw_data as string),
      isSelected: r.is_selected === 1,
    })),
  })
})

// ── POST /api/events/:slug/add-guest ─────────────────────────────────────────
app.post('/api/events/:slug/add-guest', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (Number(event.selection_locked) !== 1) return c.json({ status: 'error', message: 'Event must be finalized before adding guests.' }, 409)

  // Capacity check (exclude removed attendees)
  if (event.max_attendees !== null) {
    const countRes = await client.execute({
      sql: `SELECT COUNT(*) as cnt
            FROM attendees a
            LEFT JOIN (
              SELECT attendee_id, action,
                     ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY actioned_at DESC, rowid DESC) AS rn
              FROM check_ins
              WHERE event_id = ?
            ) ci ON ci.attendee_id = a.id AND ci.rn = 1
            WHERE a.event_id = ? AND (ci.action IS NULL OR ci.action != 'removed')`,
      args: [event.id, event.id],
    })
    if (Number(countRes.rows[0]?.cnt ?? 0) >= Number(event.max_attendees)) {
      return c.json({ status: 'error', message: 'This event is at full capacity.' }, 409)
    }
  }

  const body = await c.req.json() as {
    csvRowId?: string
    firstName?: string
    lastName?: string
    email?: string
    clusterValue?: string | null
  }

  let firstName = '', lastName = '', email = '', clusterValue: string | null = null

  if (body.csvRowId) {
    const rowRes = await client.execute({
      sql: 'SELECT raw_data FROM event_csv_rows WHERE id = ? AND event_id = ?',
      args: [body.csvRowId, event.id],
    })
    if (!rowRes.rows.length) return c.json({ status: 'error', message: 'CSV row not found.' }, 404)

    const mappingRes = await client.execute({
      sql: 'SELECT first_name_col, last_name_col, full_name_col, email_col, cluster_col FROM event_column_mappings WHERE event_id = ?',
      args: [event.id],
    })
    const m = mappingRes.rows[0]
    const raw: Record<string, string> = JSON.parse(rowRes.rows[0].raw_data as string)

    email = (m?.email_col ? raw[m.email_col as string] ?? '' : '').trim().toLowerCase()
    if (m?.first_name_col && m?.last_name_col) {
      firstName = (raw[m.first_name_col as string] ?? '').trim()
      lastName  = (raw[m.last_name_col  as string] ?? '').trim()
    } else if (m?.full_name_col) {
      const parts = (raw[m.full_name_col as string] ?? '').trim().split(' ')
      firstName = parts[0] ?? ''; lastName = parts.slice(1).join(' ')
    }
    if (m?.cluster_col) clusterValue = raw[m.cluster_col as string] ?? null
  } else {
    if (!body.firstName?.trim() || !body.email?.trim()) {
      return c.json({ status: 'error', message: 'firstName and email are required.' }, 400)
    }
    firstName    = body.firstName.trim()
    lastName     = (body.lastName ?? '').trim()
    email        = body.email.trim().toLowerCase()
    clusterValue = body.clusterValue ?? null
  }

  if (!email) return c.json({ status: 'error', message: 'Could not determine email address.' }, 400)

  const dupCheck = await client.execute({
    sql: 'SELECT id FROM attendees WHERE event_id = ? AND LOWER(email) = ?',
    args: [event.id, email],
  })
  if (dupCheck.rows.length) return c.json({ status: 'error', message: 'An attendee with this email already exists.' }, 409)

  const newId = crypto.randomUUID()
  const qrToken = crypto.randomUUID()
  await client.execute({
    sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [newId, event.id as string, firstName, lastName, email, qrToken, clusterValue],
  })

  if (body.csvRowId) {
    await client.execute({
      sql: 'UPDATE event_csv_rows SET is_selected = 1 WHERE id = ? AND event_id = ?',
      args: [body.csvRowId, event.id],
    })
  }

  return c.json({
    status: 'ok',
    attendee: { id: newId, firstName, lastName, email, qrToken, clusterValue },
  })
})

// ── PATCH /api/events/:slug/attendees/:id ─────────────────────────────────────
// Update attendee cluster_value (lead only).
app.patch('/api/events/:slug/attendees/:id', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const attendeeId = c.req.param('id')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as { clusterValue?: string | null }
  if (!('clusterValue' in body)) return c.json({ status: 'error', message: 'Nothing to update.' }, 400)

  await client.execute({
    sql: 'UPDATE attendees SET cluster_value = ? WHERE id = ? AND event_id = ?',
    args: [body.clusterValue?.trim() || null, attendeeId, event.id],
  })

  return c.json({ status: 'ok' })
})

// ── PATCH /api/events/:slug/clusters/:value/max-count ─────────────────────────
// Set (or create) the max_count for a cluster. Creates the cluster row if ad-hoc.
app.patch('/api/events/:slug/clusters/:value/max-count', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const value = decodeURIComponent(c.req.param('value'))
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as { maxCount: number | null }

  const existing = await client.execute({
    sql: 'SELECT id FROM event_clusters WHERE event_id = ? AND value = ?',
    args: [event.id, value],
  })

  if (existing.rows.length > 0) {
    await client.execute({
      sql: 'UPDATE event_clusters SET max_count = ? WHERE event_id = ? AND value = ?',
      args: [body.maxCount ?? null, event.id, value],
    })
  } else {
    await client.execute({
      sql: 'INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count, filters) VALUES (?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), event.id, '', value, body.maxCount ?? null, '{}'],
    })
  }

  return c.json({ status: 'ok' })
})

export default app
