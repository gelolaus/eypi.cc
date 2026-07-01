import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { db, getUser, getUserOrgId, type Bindings } from '../lib/db'
import { checkRateLimit } from '../lib/rateLimit'
import { buildApplePass } from '../lib/passes/applePass'
import { PASS_TOKEN_TTL_SEC, loadPassContext, verifyPassToken } from '../lib/passes/context'
import { buildGoogleWalletSaveUrl } from '../lib/passes/googleWallet'
import type { Client } from '@libsql/client/web'

// Ticketing routes (formerly the tix.eypi.cc backend). Mounted into the unified
// eypi.cc Worker in index.ts. CORS, preflight, and security headers are applied
// centrally there, so this module only declares the /api/events/* handlers.
const app = new Hono<{ Bindings: Bindings }>()

const LOOKUP_FAIL_MSG = 'No ticket found. Check your details and try again.'
const LOOKUP_RL_KEY = (ip: string) => `rl:tix-lookup:${ip}`
const LOOKUP_RL_LIMIT = 10
const LOOKUP_RL_WINDOW = 900
async function requireEventLead(client: Client, slug: string, userId: string, requestedOrgId?: string): Promise<{ ok: true, event: any } | { ok: false, status: 403 | 404, message: string }> {
  const evRes = await client.execute({ sql: 'SELECT id, org_id, selection_locked, max_attendees FROM events WHERE slug = ?', args: [slug] })
  if (evRes.rows.length === 0) return { ok: false, status: 404, message: 'Event not found.' }
  const event = evRes.rows[0]

  const userOrgId = await getUserOrgId(client, userId, requestedOrgId)
  if (!userOrgId || event.org_id !== userOrgId) {
    return { ok: false, status: 403, message: 'Forbidden.' }
  }
  return { ok: true, event }
}


// ── POST /api/events ─────────────────────────────────────────────────────────
// Create event. When attendees is absent/empty, creates in selection mode
// (selection_locked=0) and returns selectionLocked:false for frontend redirect.
app.post('/api/events', async (c) => {
  const user = await getUser(c)
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

  const client = db(c.env)
  const orgId = await getUserOrgId(client, user.sub, c.req.header('X-Active-Org-Id'))
  if (!orgId) return c.json({ status: 'error', message: 'No organization found.' }, 403)

  const existing = await client.execute({ sql: 'SELECT id FROM events WHERE slug = ?', args: [body.slug] })
  if (existing.rows.length > 0) {
    return c.json({ status: 'error', message: 'Slug already taken — choose another.' }, 409)
  }

  const eventId = crypto.randomUUID()
  const selectionLocked = hasAttendees ? 1 : 0
  const maxAttendees = body.maxAttendees ?? null

  await client.execute({
    sql: 'INSERT INTO events (id, slug, lead_user_id, org_id, name, event_date, event_time, location, max_attendees, selection_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [eventId, body.slug, user.sub, orgId, body.name.trim(), body.date, body.time, body.location.trim(), maxAttendees, selectionLocked],
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const client = db(c.env)
  const orgId = await getUserOrgId(client, user.sub, c.req.header('X-Active-Org-Id'))
  if (!orgId) return c.json({ status: 'error', message: 'No organization found.' }, 403)

  const result = await client.execute({
    sql: 'SELECT id, slug, name, event_date, event_time, location, created_at FROM events WHERE org_id = ? ORDER BY created_at DESC',
    args: [orgId],
  })

  return c.json({ status: 'ok', events: result.rows })
})

// ── GET /api/events/:slug ─────────────────────────────────────────────────────
app.get('/api/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const user = await getUser(c)

  if (!user) {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
    const allowed = await checkRateLimit(
      c.env.RATE_LIMIT_KV,
      LOOKUP_RL_KEY(ip),
      LOOKUP_RL_LIMIT,
      LOOKUP_RL_WINDOW,
    )
    if (!allowed) {
      return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 429)
    }
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }

  const client = db(c.env)

  const result = await client.execute({
    sql: 'SELECT id, slug, name, event_date, event_time, location, lead_user_id, org_id, max_attendees, selection_locked FROM events WHERE slug = ?',
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
      isLead: (await getUserOrgId(client, user.sub, c.req.header('X-Active-Org-Id'))) === event.org_id,
      maxAttendees: event.max_attendees,
      selectionLocked: event.selection_locked === 1,
      attendeeCount,
    },
  })
})

// ── GET /api/events/:slug/attendees ───────────────────────────────────────────
app.get('/api/events/:slug/attendees', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const result = await client.execute({
    sql: `
      SELECT a.id, a.first_name, a.last_name, a.email, a.cluster_value,
             ci.action AS status, ci.actioned_at
      FROM attendees a
      LEFT JOIN (
        SELECT attendee_id, action, actioned_at,
               ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY actioned_at DESC) AS rn
        FROM check_ins
      ) ci ON ci.attendee_id = a.id AND ci.rn = 1
      WHERE a.event_id = ?
      ORDER BY a.first_name, a.last_name`,
    args: [event.id],
  })

  return c.json({ status: 'ok', attendees: result.rows })
})

// ── POST /api/events/:slug/upload-csv ─────────────────────────────────────────
// Store parsed CSV rows. Pre-finalization: replaces all unselected rows.
// Post-finalization: appends (only deletes unselected rows, keeps selected).
app.post('/api/events/:slug/upload-csv', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as {
    rows: Record<string, string>[]
    columnMapping: {
      firstNameCol: string | null
      lastNameCol: string | null
      fullNameCol: string | null
      emailCol: string
      clusterCol: string | null
      criteriaColumns: string[]
    }
  }

  if (!body.rows?.length) return c.json({ status: 'error', message: 'No rows provided.' }, 400)
  if (!body.columnMapping?.emailCol) return c.json({ status: 'error', message: 'columnMapping.emailCol is required.' }, 400)

  // Delete unselected rows (safe for both pre- and post-finalization)
  await client.execute({ sql: 'DELETE FROM event_csv_rows WHERE event_id = ? AND is_selected = 0', args: [event.id] })

  // Upsert column mapping
  const mappingId = crypto.randomUUID()
  await client.execute({
    sql: `INSERT INTO event_column_mappings (id, event_id, first_name_col, last_name_col, full_name_col, email_col, cluster_col, criteria_cols)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(event_id) DO UPDATE SET
            first_name_col = excluded.first_name_col,
            last_name_col  = excluded.last_name_col,
            full_name_col  = excluded.full_name_col,
            email_col      = excluded.email_col,
            cluster_col    = excluded.cluster_col,
            criteria_cols  = excluded.criteria_cols`,
    args: [
      mappingId, event.id as string,
      body.columnMapping.firstNameCol ?? null,
      body.columnMapping.lastNameCol ?? null,
      body.columnMapping.fullNameCol ?? null,
      body.columnMapping.emailCol,
      body.columnMapping.clusterCol ?? null,
      JSON.stringify(body.columnMapping.criteriaColumns ?? []),
    ],
  })

  // Pre-generate IDs so we can return them to the frontend
  const rowEntries = body.rows.map((row, i) => ({ id: crypto.randomUUID(), rowIndex: i, row }))

  const chunkSize = 100
  for (let i = 0; i < rowEntries.length; i += chunkSize) {
    const chunk = rowEntries.slice(i, i + chunkSize)
    await client.batch(
      chunk.map(entry => ({
        sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES (?, ?, ?, ?)',
        args: [entry.id, event.id as string, entry.rowIndex, JSON.stringify(entry.row)],
      }))
    )
  }

  return c.json({ status: 'ok', rowCount: body.rows.length, rowIds: rowEntries.map(e => e.id) })
})

// ── PATCH /api/events/:slug/column-mapping ───────────────────────────────────
// Update the confirmed column mapping after the user has reviewed it in the wizard.
app.patch('/api/events/:slug/column-mapping', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as {
    emailCol: string
    firstNameCol: string | null
    lastNameCol: string | null
    fullNameCol: string | null
    clusterCol: string | null
    criteriaColumns: string[]
  }
  if (!body.emailCol) return c.json({ status: 'error', message: 'emailCol is required.' }, 400)

  await client.execute({
    sql: `UPDATE event_column_mappings SET
            email_col = ?, first_name_col = ?, last_name_col = ?, full_name_col = ?, cluster_col = ?, criteria_cols = ?
          WHERE event_id = ?`,
    args: [
      body.emailCol,
      body.firstNameCol ?? null,
      body.lastNameCol  ?? null,
      body.fullNameCol  ?? null,
      body.clusterCol   ?? null,
      JSON.stringify(body.criteriaColumns ?? []),
      event.id,
    ],
  })

  return c.json({ status: 'ok' })
})

// ── GET /api/events/:slug/csv-data ────────────────────────────────────────────
// Returns stored CSV rows + column mapping + clusters for wizard resume.
app.get('/api/events/:slug/csv-data', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const [mappingRes, rowsRes, clustersRes] = await Promise.all([
    client.execute({ sql: 'SELECT * FROM event_column_mappings WHERE event_id = ?', args: [event.id] }),
    client.execute({ sql: 'SELECT id, row_index, raw_data FROM event_csv_rows WHERE event_id = ? ORDER BY row_index', args: [event.id] }),
    client.execute({ sql: 'SELECT id, value, max_count, filters FROM event_clusters WHERE event_id = ? ORDER BY rowid', args: [event.id] }),
  ])

  const mapping = mappingRes.rows[0] ?? null
  return c.json({
    status: 'ok',
    columnMapping: mapping ? {
      firstNameCol: mapping.first_name_col,
      lastNameCol:  mapping.last_name_col,
      fullNameCol:  mapping.full_name_col,
      emailCol:     mapping.email_col,
      clusterCol:   mapping.cluster_col,
      criteriaColumns: JSON.parse(mapping.criteria_cols as string ?? '[]'),
    } : null,
    rows: rowsRes.rows.map(r => ({
      id:       r.id,
      rowIndex: r.row_index,
      rawData:  JSON.parse(r.raw_data as string),
    })),
    clusters: clustersRes.rows.map(r => ({
      id:       r.id,
      value:    r.value,
      maxCount: r.max_count,
      filters:  JSON.parse(r.filters as string ?? '{}'),
    })),
  })
})

// ── POST /api/events/:slug/clusters ──────────────────────────────────────────
// Save cluster configuration. Only before finalization.
app.post('/api/events/:slug/clusters', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (event.selection_locked === 1) return c.json({ status: 'error', message: 'Event is already finalized.' }, 409)

  const body = await c.req.json() as {
    clusterCol: string
    clusters: { value: string; maxCount: number; filters: Record<string, string[]> }[]
  }
  if (!body.clusters?.length) return c.json({ status: 'error', message: 'At least one cluster is required.' }, 400)

  const totalMax = body.clusters.reduce((s, c) => s + (c.maxCount || 0), 0)

  await client.execute({ sql: 'DELETE FROM event_clusters WHERE event_id = ?', args: [event.id] })
  await client.batch([
    ...body.clusters.map(cl => ({
      sql: 'INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count, filters) VALUES (?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), event.id as string, body.clusterCol, cl.value, cl.maxCount, JSON.stringify(cl.filters ?? {})],
    })),
    {
      sql: 'UPDATE events SET max_attendees = ? WHERE id = ?',
      args: [totalMax, event.id],
    },
  ])

  return c.json({ status: 'ok' })
})

// ── GET /api/events/:slug/clusters ────────────────────────────────────────────
// Returns cluster configs with live fill status.
app.get('/api/events/:slug/clusters', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const clustersRes = await client.execute({
    sql: 'SELECT id, cluster_col, value, max_count, filters FROM event_clusters WHERE event_id = ? ORDER BY rowid',
    args: [event.id],
  })

  const activeCountSql = `SELECT COUNT(*) as cnt
    FROM attendees a
    WHERE a.event_id = ? AND a.cluster_value = ?
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.attendee_id = a.id
          AND ci.action = 'removed'
          AND ci.actioned_at = (
            SELECT MAX(actioned_at) FROM check_ins WHERE attendee_id = a.id
          )
      )`

  const knownValues = new Set(clustersRes.rows.map(r => r.value as string))

  const clusters = await Promise.all(clustersRes.rows.map(async (cl) => {
    const countRes = await client.execute({ sql: activeCountSql, args: [event.id, cl.value] })
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
    const countRes = await client.execute({ sql: activeCountSql, args: [event.id, val] })
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (event.selection_locked === 1) return c.json({ status: 'error', message: 'Event is already finalized.' }, 409)

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

  // Validate all row IDs belong to this event
  const rowIds = body.selectedRows.map(r => r.rowId)
  const placeholders = rowIds.map(() => '?').join(',')
  const rowsRes = await client.execute({
    sql: `SELECT id, raw_data FROM event_csv_rows WHERE event_id = ? AND id IN (${placeholders})`,
    args: [event.id, ...rowIds],
  })

  const rowMap = new Map(rowsRes.rows.map(r => [r.id as string, JSON.parse(r.raw_data as string) as Record<string, string>]))

  const seen = new Set<string>()
  const attendees: { id: string; qrToken: string; firstName: string; lastName: string; email: string; clusterValue: string | null }[] = []

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
      qrToken:      crypto.randomUUID(),
      firstName,
      lastName,
      email:        emailRaw,
      clusterValue: sel.clusterValue ?? null,
    })
  }

  if (!attendees.length) return c.json({ status: 'error', message: 'No valid attendees could be derived from selected rows.' }, 400)

  // Batch insert attendees
  const chunkSize = 100
  for (let i = 0; i < attendees.length; i += chunkSize) {
    const chunk = attendees.slice(i, i + chunkSize)
    await client.batch(
      chunk.map(a => ({
        sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [a.id, event.id as string, a.firstName, a.lastName, a.email, a.qrToken, a.clusterValue],
      }))
    )
  }

  // Mark rows as selected
  for (let i = 0; i < rowIds.length; i += chunkSize) {
    const chunk = rowIds.slice(i, i + chunkSize)
    const ph = chunk.map(() => '?').join(',')
    await client.execute({
      sql: `UPDATE event_csv_rows SET is_selected = 1 WHERE event_id = ? AND id IN (${ph})`,
      args: [event.id, ...chunk],
    })
  }

  await client.execute({
    sql: 'UPDATE events SET selection_locked = 1, max_attendees = ? WHERE id = ?',
    args: [body.maxAttendees ?? null, event.id],
  })

  return c.json({
    status: 'ok',
    attendees: attendees.map(({ id, firstName, lastName, email, qrToken, clusterValue }) => ({ id, firstName, lastName, email, qrToken, clusterValue })),
  })
})

// ── POST /api/events/:slug/clusters/:value/raffle ─────────────────────────────
// Re-raffle a cluster to fill remaining slots from unselected eligible rows.
app.post('/api/events/:slug/clusters/:value/raffle', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const clusterValue = decodeURIComponent(c.req.param('value'))
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
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
    sql: 'SELECT COUNT(*) as cnt FROM attendees WHERE event_id = ? AND cluster_value = ?',
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

  // Fetch all unselected rows, filter in application code
  const allUnselected = await client.execute({
    sql: 'SELECT id, raw_data FROM event_csv_rows WHERE event_id = ? AND is_selected = 0',
    args: [event.id],
  })

  const filters: Record<string, string[]> = JSON.parse(cluster.filters as string ?? '{}')

  const eligible = allUnselected.rows.filter(r => {
    const raw: Record<string, string> = JSON.parse(r.raw_data as string)
    // Must match cluster column value
    if (m.cluster_col && raw[m.cluster_col as string] !== clusterValue) return false
    // Must pass all cluster filters (AND across columns, OR within column values)
    for (const [col, vals] of Object.entries(filters)) {
      if (vals.length > 0 && !vals.includes(raw[col] ?? '')) return false
    }
    return true
  })

  if (!eligible.length) return c.json({ status: 'error', message: 'No eligible unselected respondents remain for this cluster.' }, 404)

  // Fisher-Yates shuffle and slice
  const shuffled = [...eligible]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const winners = shuffled.slice(0, remaining)

  // Get existing emails to avoid duplicates
  const existingEmailRes = await client.execute({
    sql: 'SELECT email FROM attendees WHERE event_id = ?',
    args: [event.id],
  })
  const existingEmails = new Set(existingEmailRes.rows.map(r => (r.email as string).toLowerCase()))

  const newAttendees: { id: string; qrToken: string; firstName: string; lastName: string; email: string }[] = []
  const winnerIds: string[] = []

  for (const w of winners) {
    const raw: Record<string, string> = JSON.parse(w.raw_data as string)
    const emailRaw = (m.email_col ? raw[m.email_col as string] ?? '' : '').trim().toLowerCase()
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

    newAttendees.push({ id: crypto.randomUUID(), qrToken: crypto.randomUUID(), firstName, lastName, email: emailRaw })
    winnerIds.push(w.id as string)
  }

  if (!newAttendees.length) return c.json({ status: 'error', message: 'No new eligible attendees could be added.' }, 404)

  await client.batch([
    ...newAttendees.map(a => ({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [a.id, event.id as string, a.firstName, a.lastName, a.email, a.qrToken, clusterValue],
    })),
  ])

  if (winnerIds.length) {
    const ph = winnerIds.map(() => '?').join(',')
    await client.execute({
      sql: `UPDATE event_csv_rows SET is_selected = 1 WHERE event_id = ? AND id IN (${ph})`,
      args: [event.id, ...winnerIds],
    })
  }

  return c.json({
    status: 'ok',
    attendees: newAttendees.map(({ id, firstName, lastName, email, qrToken }) => ({ id, firstName, lastName, email, qrToken })),
  })
})

// ── DELETE /api/events/:slug ──────────────────────────────────────────────────
app.delete('/api/events/:slug', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const body = await c.req.json() as { maxAttendees?: number | null; name?: string; date?: string; time?: string; location?: string }

  const updates: string[] = []
  const args: unknown[] = []
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const q = (c.req.query('q') ?? '').trim()
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c.env)

  const evRes = await client.execute({
    sql: 'SELECT id, lead_user_id, selection_locked, max_attendees FROM events WHERE slug = ?',
    args: [slug],
  })
  if (evRes.rows.length === 0) return c.json({ status: 'error', message: 'Event not found.' }, 404)
  const event = evRes.rows[0]
  if (event.lead_user_id !== user.sub) return c.json({ status: 'error', message: 'Forbidden.' }, 403)
  if (event.selection_locked !== 1) return c.json({ status: 'error', message: 'Event must be finalized before adding guests.' }, 409)

  // Capacity check (exclude removed attendees)
  if (event.max_attendees !== null) {
    const countRes = await client.execute({
      sql: `SELECT COUNT(*) as cnt
            FROM attendees a
            LEFT JOIN (
              SELECT attendee_id, action,
                     ROW_NUMBER() OVER (PARTITION BY attendee_id ORDER BY actioned_at DESC) AS rn
              FROM check_ins
            ) ci ON ci.attendee_id = a.id AND ci.rn = 1
            WHERE a.event_id = ? AND (ci.action IS NULL OR ci.action != 'removed')`,
      args: [event.id],
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

// ── POST /api/events/:slug/lookup ─────────────────────────────────────────────
app.post('/api/events/:slug/lookup', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const allowed = await checkRateLimit(
    c.env.RATE_LIMIT_KV,
    LOOKUP_RL_KEY(ip),
    LOOKUP_RL_LIMIT,
    LOOKUP_RL_WINDOW,
  )
  if (!allowed) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 429)
  }

  const slug = c.req.param('slug')
  const body = await c.req.json() as { firstName: string; lastName: string; email: string }

  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
    return c.json({ status: 'error', message: 'First name, last name, and email are required.' }, 400)
  }

  const client = db(c.env)
  const evRes = await client.execute({
    sql: 'SELECT id, name, event_date, event_time, location FROM events WHERE slug = ?',
    args: [slug],
  })
  if (evRes.rows.length === 0) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }
  const event = evRes.rows[0]

  const aRes = await client.execute({
    sql: `SELECT id, first_name, last_name, email, qr_token, cluster_value FROM attendees
          WHERE event_id = ? AND LOWER(email) = LOWER(?) AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)`,
    args: [event.id, body.email.trim(), body.firstName.trim(), body.lastName.trim()],
  })
  if (aRes.rows.length === 0) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
  }

  const a = aRes.rows[0]
  const exp = Math.floor(Date.now() / 1000) + PASS_TOKEN_TTL_SEC
  const passToken = await sign({
    typ: 'pass',
    sub: a.id as string,
    eventId: event.id as string,
    slug,
    exp,
  }, c.env.JWT_SECRET)

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

// ── GET /api/events/:slug/passes/apple ─────────────────────────────────────────
app.get('/api/events/:slug/passes/apple', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const allowed = await checkRateLimit(
    c.env.RATE_LIMIT_KV,
    LOOKUP_RL_KEY(ip),
    LOOKUP_RL_LIMIT,
    LOOKUP_RL_WINDOW,
  )
  if (!allowed) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 429)
  }

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

    const client = db(c.env)
    const ctx = await loadPassContext(client, slug, claims.sub)
    if (!ctx || ctx.event.id !== claims.eventId) {
      return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
    }

    const pkpass = await buildApplePass(ctx, c.env)
    return new Response(pkpass, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="ticket.pkpass"',
      },
    })
  } catch (err) {
    console.error('GET /passes/apple error:', err instanceof Error ? err.message : err)
    const message = err instanceof Error && err.message.includes('not configured')
      ? 'Wallet passes are not available right now.'
      : LOOKUP_FAIL_MSG
    return c.json({ status: 'error', message }, 503)
  }
})

// ── GET /api/events/:slug/passes/google ────────────────────────────────────────
app.get('/api/events/:slug/passes/google', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const allowed = await checkRateLimit(
    c.env.RATE_LIMIT_KV,
    LOOKUP_RL_KEY(ip),
    LOOKUP_RL_LIMIT,
    LOOKUP_RL_WINDOW,
  )
  if (!allowed) {
    return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 429)
  }

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

    const client = db(c.env)
    const ctx = await loadPassContext(client, slug, claims.sub)
    if (!ctx || ctx.event.id !== claims.eventId) {
      return c.json({ status: 'error', message: LOOKUP_FAIL_MSG }, 404)
    }

    const url = await buildGoogleWalletSaveUrl(ctx, c.env)
    return c.json({ status: 'ok', url })
  } catch (err) {
    console.error('GET /passes/google error:', err instanceof Error ? err.message : err)
    const message = err instanceof Error && err.message.includes('not configured')
      ? 'Wallet passes are not available right now.'
      : LOOKUP_FAIL_MSG
    return c.json({ status: 'error', message }, 503)
  }
})

// ── POST /api/events/:slug/checkin ────────────────────────────────────────────
app.post('/api/events/:slug/checkin', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { qrToken } = await c.req.json() as { qrToken: string }
  if (!qrToken) return c.json({ status: 'error', message: 'qrToken required.' }, 400)

  const client = db(c.env)
  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE qr_token = ? AND event_id = ?',
    args: [qrToken, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Invalid QR code for this event.' }, 404)
  const a = aRes.rows[0]

  const latest = await client.execute({
    sql: 'SELECT action FROM check_ins WHERE attendee_id = ? ORDER BY actioned_at DESC LIMIT 1',
    args: [a.id],
  })
  if (latest.rows[0]?.action === 'checked_in') {
    return c.json({ status: 'error', message: `${a.first_name} ${a.last_name} is already checked in.` }, 409)
  }
  if (latest.rows[0]?.action === 'removed') {
    return c.json({ status: 'error', message: `${a.first_name} ${a.last_name} has been removed from this event.` }, 403)
  }

  await client.execute({
    sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)',
    args: [crypto.randomUUID(), a.id, event.id as string, 'checked_in'],
  })

  return c.json({
    status: 'ok',
    message: `${a.first_name} ${a.last_name} checked in.`,
    attendee: { id: a.id, firstName: a.first_name, lastName: a.last_name },
  })
})

// ── POST /api/events/:slug/checkin-manual ─────────────────────────────────────
app.post('/api/events/:slug/checkin-manual', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c.env)
  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]

  const latest = await client.execute({
    sql: 'SELECT action FROM check_ins WHERE attendee_id = ? ORDER BY actioned_at DESC LIMIT 1',
    args: [a.id],
  })
  if (latest.rows[0]?.action === 'checked_in') {
    return c.json({ status: 'error', message: `${a.first_name} ${a.last_name} is already checked in.` }, 409)
  }
  if (latest.rows[0]?.action === 'removed') {
    return c.json({ status: 'error', message: `${a.first_name} ${a.last_name} has been removed.` }, 403)
  }

  await client.execute({
    sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)',
    args: [crypto.randomUUID(), a.id, event.id as string, 'checked_in'],
  })
  return c.json({ status: 'ok', message: `${a.first_name} ${a.last_name} checked in.` })
})

// ── POST /api/events/:slug/checkout ───────────────────────────────────────────
app.post('/api/events/:slug/checkout', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c.env)
  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]

  await client.execute({
    sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)',
    args: [crypto.randomUUID(), a.id, event.id as string, 'checked_out'],
  })
  return c.json({ status: 'ok', message: `${a.first_name} ${a.last_name} checked out.` })
})

// ── POST /api/events/:slug/remove ─────────────────────────────────────────────
app.post('/api/events/:slug/remove', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const { attendeeId } = await c.req.json() as { attendeeId: string }
  if (!attendeeId) return c.json({ status: 'error', message: 'attendeeId required.' }, 400)

  const client = db(c.env)
  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event

  const aRes = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees WHERE id = ? AND event_id = ?',
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return c.json({ status: 'error', message: 'Attendee not found.' }, 404)
  const a = aRes.rows[0]

  await client.execute({
    sql: 'INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)',
    args: [crypto.randomUUID(), a.id, event.id as string, 'removed'],
  })
  return c.json({ status: 'ok', message: `${a.first_name} ${a.last_name} removed.` })
})

// ── PATCH /api/events/:slug/attendees/:id ─────────────────────────────────────
// Update attendee cluster_value (lead only).
app.patch('/api/events/:slug/attendees/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const attendeeId = c.req.param('id')
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
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
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const value = decodeURIComponent(c.req.param('value'))
  const client = db(c.env)

  const leadCheck = await requireEventLead(client, slug, user.sub, c.req.header('X-Active-Org-Id'))
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
