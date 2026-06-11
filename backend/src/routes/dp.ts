import { Hono } from 'hono'
import { db, getUser, type Bindings } from '../lib/db'

// DP Blast — Twibbonize-style profile-frame campaigns. Mounted into the unified
// eypi.cc Worker in index.ts; CORS, preflight, and security headers are applied
// centrally there, so this module only declares the /api/dp/* handlers.
//
// Frames are stored as base64 data-URLs (data:image/png;base64,…) directly in
// Turso — zero new infra, and data: images never taint the client export canvas.
// All cropping/scaling/merging happens client-side; the server never touches
// pixels.
const app = new Hono<{ Bindings: Bindings }>()

// Validation caps. A data-URL for a ~2 MB PNG is ~2.7M base64 chars; 2.8M gives
// a little headroom while still rejecting anything meaningfully oversized.
const TITLE_MAX = 200
const DESCRIPTION_MAX = 1000
const CAPTION_MAX = 2000
const FRAME_PREFIX = 'data:image/png;base64,'
const FRAME_MAX_CHARS = 2_800_000

function validateFrame(frame: unknown): string | null {
  if (typeof frame !== 'string' || !frame.startsWith(FRAME_PREFIX)) {
    return 'Frame must be a PNG data-URL (data:image/png;base64,…).'
  }
  if (frame.length > FRAME_MAX_CHARS) {
    return 'Frame image is too large — keep it under ~2 MB.'
  }
  return null
}

// ── POST /api/dp ──────────────────────────────────────────────────────────────
// Create a campaign. Body { title, description, captionTemplate, frameImage }
// where frameImage is the data-URL string.
app.post('/api/dp', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const body = await c.req.json() as {
    title?: string
    description?: string
    captionTemplate?: string
    frameImage?: string
  }

  const title = (body.title ?? '').trim()
  if (!title) return c.json({ status: 'error', message: 'Title is required.' }, 400)
  if (title.length > TITLE_MAX) return c.json({ status: 'error', message: `Title must be ${TITLE_MAX} characters or fewer.` }, 400)

  const description = (body.description ?? '').trim()
  if (description.length > DESCRIPTION_MAX) return c.json({ status: 'error', message: `Description must be ${DESCRIPTION_MAX} characters or fewer.` }, 400)

  const captionTemplate = (body.captionTemplate ?? '').trim()
  if (captionTemplate.length > CAPTION_MAX) return c.json({ status: 'error', message: `Caption must be ${CAPTION_MAX} characters or fewer.` }, 400)

  const frameError = validateFrame(body.frameImage)
  if (frameError) return c.json({ status: 'error', message: frameError }, 400)

  const id = crypto.randomUUID()
  await db(c.env).execute({
    sql: 'INSERT INTO dp_campaigns (id, creator_id, title, description, frame_image_url, caption_template) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, user.sub, title, description || null, body.frameImage!, captionTemplate || null],
  })

  return c.json({ status: 'ok', campaign: { id, title } }, 201)
})

// ── GET /api/dp ───────────────────────────────────────────────────────────────
// List the creator's campaigns. Excludes the heavy frame_image_url column.
app.get('/api/dp', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const result = await db(c.env).execute({
    sql: 'SELECT id, title, description, download_count, created_at FROM dp_campaigns WHERE creator_id = ? ORDER BY created_at DESC',
    args: [user.sub],
  })

  return c.json({
    status: 'ok',
    campaigns: result.rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      downloadCount: Number(r.download_count ?? 0),
      createdAt: r.created_at,
    })),
  })
})

// ── POST /api/dp/:id/download ─────────────────────────────────────────────────
// Public, best-effort counter bump fired after a successful client-side export.
app.post('/api/dp/:id/download', async (c) => {
  const id = c.req.param('id')
  const result = await db(c.env).execute({
    sql: 'UPDATE dp_campaigns SET download_count = download_count + 1 WHERE id = ?',
    args: [id],
  })
  if (result.rowsAffected === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  return c.json({ status: 'ok', ok: true })
})

// ── GET /api/dp/:id ───────────────────────────────────────────────────────────
// Public page payload: title, description, frameImageUrl, captionTemplate.
app.get('/api/dp/:id', async (c) => {
  const id = c.req.param('id')
  const result = await db(c.env).execute({
    sql: 'SELECT id, title, description, frame_image_url, caption_template FROM dp_campaigns WHERE id = ?',
    args: [id],
  })
  if (result.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)

  const row = result.rows[0]
  return c.json({
    status: 'ok',
    campaign: {
      id: row.id,
      title: row.title,
      description: row.description,
      frameImageUrl: row.frame_image_url,
      captionTemplate: row.caption_template,
    },
  })
})

// ── PATCH /api/dp/:id ─────────────────────────────────────────────────────────
// Owner-only edit of title/description/caption/frame; bumps updated_at.
app.patch('/api/dp/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')
  const client = db(c.env)

  const existing = await client.execute({ sql: 'SELECT creator_id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (existing.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  if (existing.rows[0].creator_id !== user.sub) return c.json({ status: 'error', message: 'Forbidden.' }, 403)

  const body = await c.req.json() as {
    title?: string
    description?: string
    captionTemplate?: string
    frameImage?: string
  }

  const updates: string[] = []
  const args: (string | null)[] = []

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return c.json({ status: 'error', message: 'Title cannot be empty.' }, 400)
    if (title.length > TITLE_MAX) return c.json({ status: 'error', message: `Title must be ${TITLE_MAX} characters or fewer.` }, 400)
    updates.push('title = ?'); args.push(title)
  }
  if (body.description !== undefined) {
    const description = body.description.trim()
    if (description.length > DESCRIPTION_MAX) return c.json({ status: 'error', message: `Description must be ${DESCRIPTION_MAX} characters or fewer.` }, 400)
    updates.push('description = ?'); args.push(description || null)
  }
  if (body.captionTemplate !== undefined) {
    const captionTemplate = body.captionTemplate.trim()
    if (captionTemplate.length > CAPTION_MAX) return c.json({ status: 'error', message: `Caption must be ${CAPTION_MAX} characters or fewer.` }, 400)
    updates.push('caption_template = ?'); args.push(captionTemplate || null)
  }
  if (body.frameImage !== undefined) {
    const frameError = validateFrame(body.frameImage)
    if (frameError) return c.json({ status: 'error', message: frameError }, 400)
    updates.push('frame_image_url = ?'); args.push(body.frameImage)
  }

  if (!updates.length) return c.json({ status: 'error', message: 'Nothing to update.' }, 400)

  updates.push('updated_at = CURRENT_TIMESTAMP')
  args.push(id)
  await client.execute({ sql: `UPDATE dp_campaigns SET ${updates.join(', ')} WHERE id = ?`, args })

  return c.json({ status: 'ok' })
})

// ── DELETE /api/dp/:id ────────────────────────────────────────────────────────
app.delete('/api/dp/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')
  const client = db(c.env)

  const existing = await client.execute({ sql: 'SELECT creator_id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (existing.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  if (existing.rows[0].creator_id !== user.sub) return c.json({ status: 'error', message: 'Forbidden.' }, 403)

  await client.execute({ sql: 'DELETE FROM dp_campaigns WHERE id = ?', args: [id] })

  return c.json({ status: 'ok', message: 'Campaign deleted.' })
})

export default app
