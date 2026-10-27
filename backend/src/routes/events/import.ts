import { Hono } from 'hono'
import { db, type Bindings } from '../../lib/db'
import { actionError, ALREADY_FINALIZED, requireEventLead } from './shared'

const MAX_UPLOAD_ROWS = 5000

const app = new Hono<{ Bindings: Bindings }>()

// ── POST /api/events/:slug/upload-csv ─────────────────────────────────────────
// Replace unselected rows before finalization. A locked event does not append.
app.post('/api/events/:slug/upload-csv', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
  if (!leadCheck.ok) return c.json({ status: 'error', message: leadCheck.message }, leadCheck.status)
  const event = leadCheck.event
  if (Number(event.selection_locked) === 1) return c.json(ALREADY_FINALIZED, 409)

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

  if (!Array.isArray(body.rows) || body.rows.length === 0) return c.json({ status: 'error', message: 'No rows provided.' }, 400)
  if (body.rows.length > MAX_UPLOAD_ROWS) {
    return c.json(actionError('too_many_rows', 'Spreadsheets are limited to 5,000 rows.'), 422)
  }
  if (!body.columnMapping?.emailCol) return c.json({ status: 'error', message: 'columnMapping.emailCol is required.' }, 400)

  // Pre-generate IDs so we can return them to the frontend
  const mappingId = crypto.randomUUID()
  const rowEntries = body.rows.map((row, i) => ({ id: crypto.randomUUID(), rowIndex: i, row }))

  await client.batch([
    { sql: 'DELETE FROM event_csv_rows WHERE event_id = ? AND is_selected = 0', args: [event.id] },
    {
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
    },
    ...rowEntries.map(entry => ({
      sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data) VALUES (?, ?, ?, ?)',
      args: [entry.id, event.id as string, entry.rowIndex, JSON.stringify(entry.row)],
    })),
  ], 'write')

  return c.json({ status: 'ok', rowCount: body.rows.length, rowIds: rowEntries.map(e => e.id) })
})

// ── PATCH /api/events/:slug/column-mapping ───────────────────────────────────
// Update the confirmed column mapping after the user has reviewed it in the wizard.
app.patch('/api/events/:slug/column-mapping', async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
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
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')
  const client = db(c)

  const leadCheck = await requireEventLead(client, slug, c.var.orgId)
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

export default app
