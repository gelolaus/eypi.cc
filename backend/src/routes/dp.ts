import { Hono } from 'hono'
import { db, getUser, getUserOrgId, type Bindings } from '../lib/db'
import type { Client } from '@libsql/client/web'
import { isOrgFeature } from '../middleware/orgGuard'

// DP Blast — Twibbonize-style profile-frame campaigns. Mounted into the unified
// eypi.cc Worker in index.ts; CORS, preflight, and security headers are applied
// centrally there, so this module only declares the /api/dp/* handlers.
//
// A campaign owns MANY frames (dp_frames), lives at a custom slug, and is
// editable. Frames are stored as base64 data-URLs directly in Turso — zero new
// infra, and data: images never taint the client export canvas. All
// cropping/scaling/merging happens client-side; the server never touches pixels.
const app = new Hono<{ Bindings: Bindings }>()

// Validation caps. A data-URL for a ~2 MB PNG is ~2.7M base64 chars; 2.8M gives
// a little headroom while still rejecting anything meaningfully oversized.
const TITLE_MAX = 200
const DESCRIPTION_MAX = 1000
const CAPTION_MAX = 2000
const LABEL_MAX = 80
const SLUG_MAX = 60
const FRAME_MAX_CHARS = 2_800_000
const MAX_FRAMES = 10
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateFrame(frame: unknown): string | null {
  if (typeof frame !== 'string') {
    return 'Each frame must be a PNG data-URL (data:image/png;base64,…).'
  }
  const prefix = frame.slice(0, 30).toLowerCase()
  if (!prefix.startsWith('data:image/png;base64,') && !prefix.startsWith('data:image/x-png;base64,')) {
    return 'Each frame must be a PNG data-URL (data:image/png;base64,…).'
  }
  if (frame.length > FRAME_MAX_CHARS) {
    return 'A frame image is too large — keep each under ~2 MB.'
  }
  return null
}

function slugify(title: string): string {
  const base = title.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return base || 'frame'
}

// Find a slug not already taken (ignoring excludeId, the campaign being edited).
async function uniqueSlug(client: Client, base: string, excludeId?: string): Promise<string> {
  let candidate = base
  for (let n = 2; ; n++) {
    const r = await client.execute({ sql: 'SELECT id FROM dp_campaigns WHERE slug = ?', args: [candidate] })
    const taken = r.rows.length > 0 && r.rows[0].id !== excludeId
    if (!taken) return candidate
    const suffix = `-${n}`
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`
  }
}

// Resolve the slug for create/patch. Returns { slug } or { error, status }.
async function resolveSlug(
  client: Client,
  desired: string | undefined,
  title: string,
  excludeId?: string,
): Promise<{ slug?: string; error?: string; status?: 400 | 409 }> {
  const wanted = (desired ?? '').trim().toLowerCase()
  if (!wanted) {
    return { slug: await uniqueSlug(client, slugify(title), excludeId) }
  }
  if (wanted.length > SLUG_MAX || !SLUG_RE.test(wanted)) {
    return { error: 'Slug must be lowercase letters, numbers, and hyphens only.', status: 400 }
  }
  const r = await client.execute({ sql: 'SELECT id FROM dp_campaigns WHERE slug = ?', args: [wanted] })
  if (r.rows.length > 0 && r.rows[0].id !== excludeId) {
    return { error: 'That link is already taken — choose another.', status: 409 }
  }
  return { slug: wanted }
}

// Shared owner guard: returns the campaign row id or a typed failure.
async function requireOwner(client: Client, id: string, userId: string, requestedOrgId?: string): Promise<{ ok: true } | { ok: false; status: 403 | 404; message: string }> {
  const existing = await client.execute({ sql: 'SELECT org_id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (existing.rows.length === 0) return { ok: false, status: 404, message: 'Campaign not found.' }
  const campaignOrgId = existing.rows[0].org_id
  
  const userOrgId = await getUserOrgId(client, userId, requestedOrgId)
  if (!userOrgId || campaignOrgId !== userOrgId) return { ok: false, status: 403, message: 'Forbidden.' }
  return { ok: true }
}

// ── POST /api/dp ──────────────────────────────────────────────────────────────
// Create a campaign with one or more frames.
app.post('/api/dp', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const body = await c.req.json() as {
    title?: string
    slug?: string
    description?: string
    captionTemplate?: string
    frames?: { imageData?: string; label?: string }[]
  }

  const title = (body.title ?? '').trim()
  if (!title) return c.json({ status: 'error', message: 'Title is required.' }, 400)
  if (title.length > TITLE_MAX) return c.json({ status: 'error', message: `Title must be ${TITLE_MAX} characters or fewer.` }, 400)

  const description = (body.description ?? '').trim()
  if (description.length > DESCRIPTION_MAX) return c.json({ status: 'error', message: `Description must be ${DESCRIPTION_MAX} characters or fewer.` }, 400)

  const captionTemplate = (body.captionTemplate ?? '').trim()
  if (captionTemplate.length > CAPTION_MAX) return c.json({ status: 'error', message: `Caption must be ${CAPTION_MAX} characters or fewer.` }, 400)

  const frames = Array.isArray(body.frames) ? body.frames : []
  if (frames.length === 0) return c.json({ status: 'error', message: 'Add at least one frame.' }, 400)
  if (frames.length > MAX_FRAMES) return c.json({ status: 'error', message: `A campaign can have at most ${MAX_FRAMES} frames.` }, 400)
  for (const f of frames) {
    const err = validateFrame(f.imageData)
    if (err) return c.json({ status: 'error', message: err }, 400)
  }

  const client = db(c.env)
  const resolved = await resolveSlug(client, body.slug, title)
  if (resolved.error) return c.json({ status: 'error', message: resolved.error }, resolved.status ?? 400)
  const slug = resolved.slug!

  const id = crypto.randomUUID()
  // frame_image_url is a vestigial NOT NULL column from 0003; '' satisfies it
  // while frames now live in dp_frames.
  const orgId = await getUserOrgId(client, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!orgId) return c.json({ status: 'error', message: 'No organization found.' }, 403)

  await client.execute({
    sql: 'INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, description, frame_image_url, caption_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, user.sub!, orgId, title, slug, description || null, '', captionTemplate || null],
  })
  await client.batch(
    frames.map((f, i) => ({
      sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), id, f.imageData!, (f.label ?? '').trim().slice(0, LABEL_MAX) || null, i],
    })),
  )

  return c.json({ status: 'ok', campaign: { id, title, slug } }, 201)
})

// ── GET /api/dp ───────────────────────────────────────────────────────────────
// List the creator's campaigns with frame + download counts (no heavy images).
app.get('/api/dp', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const client = db(c.env)
  const orgId = await getUserOrgId(client, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!orgId) return c.json({ status: 'error', message: 'No organization found.' }, 403)

  const result = await client.execute({
    sql: `SELECT c.id, c.title, c.slug, c.description, c.download_count, c.created_at,
                 (SELECT COUNT(*) FROM dp_frames f WHERE f.campaign_id = c.id) AS frame_count
          FROM dp_campaigns c WHERE c.org_id = ? ORDER BY c.created_at DESC`,
    args: [orgId],
  })

  return c.json({
    status: 'ok',
    campaigns: result.rows.map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      frameCount: Number(r.frame_count ?? 0),
      downloadCount: Number(r.download_count ?? 0),
      createdAt: r.created_at,
    })),
  })
})

// ── GET /api/dp/:slug/edit ────────────────────────────────────────────────────
// Owner-only full payload (incl. frames) for the editor.
app.get('/api/dp/:slug/edit', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')!
  const client = db(c.env)

  const camp = await client.execute({ sql: 'SELECT id, org_id, title, slug, description, caption_template FROM dp_campaigns WHERE slug = ?', args: [slug] })
  if (camp.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  const row = camp.rows[0]

  const userOrgId = await getUserOrgId(client, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!userOrgId || row.org_id !== userOrgId) return c.json({ status: 'error', message: 'Forbidden.' }, 403)

  const frames = await client.execute({ sql: 'SELECT id, image_url, label, position FROM dp_frames WHERE campaign_id = ? ORDER BY position, created_at', args: [row.id] })

  return c.json({
    status: 'ok',
    campaign: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      captionTemplate: row.caption_template,
      frames: frames.rows.map(f => ({ id: f.id, imageUrl: f.image_url, label: f.label, position: Number(f.position ?? 0) })),
    },
  })
})

// ── POST /api/dp/:id/frames ───────────────────────────────────────────────────
app.post('/api/dp/:id/frames', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c.env)
  const owner = await requireOwner(client, id, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const body = await c.req.json() as { imageData?: string; label?: string }
  const err = validateFrame(body.imageData)
  if (err) return c.json({ status: 'error', message: err }, 400)

  const countRes = await client.execute({ sql: 'SELECT COUNT(*) AS cnt, MAX(position) AS maxpos FROM dp_frames WHERE campaign_id = ?', args: [id] })
  const count = Number(countRes.rows[0]?.cnt ?? 0)
  if (count >= MAX_FRAMES) return c.json({ status: 'error', message: `A campaign can have at most ${MAX_FRAMES} frames.` }, 400)
  const nextPos = Number(countRes.rows[0]?.maxpos ?? -1) + 1

  const frameId = crypto.randomUUID()
  await client.execute({
    sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
    args: [frameId, id, body.imageData!, (body.label ?? '').trim().slice(0, LABEL_MAX) || null, nextPos],
  })
  await client.execute({ sql: 'UPDATE dp_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [id] })

  return c.json({ status: 'ok', frame: { id: frameId, position: nextPos } }, 201)
})

// ── DELETE /api/dp/:id/frames/:frameId ────────────────────────────────────────
app.delete('/api/dp/:id/frames/:frameId', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const frameId = c.req.param('frameId')!
  const client = db(c.env)
  const owner = await requireOwner(client, id, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const countRes = await client.execute({ sql: 'SELECT COUNT(*) AS cnt FROM dp_frames WHERE campaign_id = ?', args: [id] })
  if (Number(countRes.rows[0]?.cnt ?? 0) <= 1) {
    return c.json({ status: 'error', message: 'A campaign needs at least one frame.' }, 400)
  }

  const del = await client.execute({ sql: 'DELETE FROM dp_frames WHERE id = ? AND campaign_id = ?', args: [frameId, id] })
  if (del.rowsAffected === 0) return c.json({ status: 'error', message: 'Frame not found.' }, 404)
  await client.execute({ sql: 'UPDATE dp_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [id] })

  return c.json({ status: 'ok' })
})

// ── PATCH /api/dp/:id/frames/order ────────────────────────────────────────────
// Owner-only reorder. Body { orderedIds } must be exactly this campaign's frame
// ids; positions are rewritten to match the given order.
app.patch('/api/dp/:id/frames/order', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c.env)
  const owner = await requireOwner(client, id, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const body = await c.req.json() as { orderedIds?: string[] }
  const orderedIds = body.orderedIds
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return c.json({ status: 'error', message: 'orderedIds is required.' }, 400)
  }

  const existing = await client.execute({ sql: 'SELECT id FROM dp_frames WHERE campaign_id = ?', args: [id] })
  const existingIds = new Set(existing.rows.map(r => r.id as string))
  const uniqueGiven = new Set(orderedIds)
  if (uniqueGiven.size !== orderedIds.length || orderedIds.length !== existingIds.size || !orderedIds.every(fid => existingIds.has(fid))) {
    return c.json({ status: 'error', message: 'Frame order must list each of this campaign’s frames exactly once.' }, 400)
  }

  await client.batch([
    ...orderedIds.map((fid, i) => ({
      sql: 'UPDATE dp_frames SET position = ? WHERE id = ? AND campaign_id = ?',
      args: [i, fid, id],
    })),
    { sql: 'UPDATE dp_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [id] },
  ])

  return c.json({ status: 'ok' })
})

// ── PATCH /api/dp/:id ─────────────────────────────────────────────────────────
// Owner-only edit of title/description/caption/slug; bumps updated_at.
app.patch('/api/dp/:id', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c.env)
  const owner = await requireOwner(client, id, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const body = await c.req.json() as {
    title?: string
    description?: string
    captionTemplate?: string
    slug?: string
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
  if (body.slug !== undefined) {
    // Re-derive title for the auto-slug fallback when slug is cleared.
    const titleRow = await client.execute({ sql: 'SELECT title FROM dp_campaigns WHERE id = ?', args: [id] })
    const currentTitle = (body.title?.trim()) || (titleRow.rows[0]?.title as string) || ''
    const resolved = await resolveSlug(client, body.slug, currentTitle, id)
    if (resolved.error) return c.json({ status: 'error', message: resolved.error }, resolved.status ?? 400)
    updates.push('slug = ?'); args.push(resolved.slug!)
  }

  if (!updates.length) return c.json({ status: 'error', message: 'Nothing to update.' }, 400)

  updates.push('updated_at = CURRENT_TIMESTAMP')
  args.push(id)
  await client.execute({ sql: `UPDATE dp_campaigns SET ${updates.join(', ')} WHERE id = ?`, args })

  // Return the (possibly auto-generated) slug so the editor can reflect it.
  const after = await client.execute({ sql: 'SELECT slug FROM dp_campaigns WHERE id = ?', args: [id] })
  return c.json({ status: 'ok', slug: after.rows[0]?.slug })
})

// ── DELETE /api/dp/:id ────────────────────────────────────────────────────────
app.delete('/api/dp/:id', isOrgFeature, async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c.env)
  const owner = await requireOwner(client, id, user.sub!, c.req.header('X-Active-Org-Id'))
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  await client.batch([
    { sql: 'DELETE FROM dp_frames WHERE campaign_id = ?', args: [id] },
    { sql: 'DELETE FROM dp_campaigns WHERE id = ?', args: [id] },
  ])

  return c.json({ status: 'ok', message: 'Campaign deleted.' })
})

// ── POST /api/dp/:id/download ─────────────────────────────────────────────────
// Public, best-effort counter bump fired after a successful client-side export.
app.post('/api/dp/:id/download', async (c) => {
  const id = c.req.param('id')!
  const result = await db(c.env).execute({
    sql: 'UPDATE dp_campaigns SET download_count = download_count + 1 WHERE id = ?',
    args: [id],
  })
  if (result.rowsAffected === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  return c.json({ status: 'ok', ok: true })
})

// ── GET /api/dp/:slug ─────────────────────────────────────────────────────────
// Public page payload by slug, including every frame. Declared last so the more
// specific /:id/* routes above are matched first by segment count (Hono matches
// on segment count, so order is not strictly required, but this reads clearly).
app.get('/api/dp/:slug', async (c) => {
  const slug = c.req.param('slug')!
  const client = db(c.env)
  const result = await client.execute({
    sql: 'SELECT id, title, slug, description, caption_template FROM dp_campaigns WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)

  const row = result.rows[0]
  const frames = await client.execute({
    sql: 'SELECT id, image_url, label, position FROM dp_frames WHERE campaign_id = ? ORDER BY position, created_at',
    args: [row.id],
  })

  return c.json({
    status: 'ok',
    campaign: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      captionTemplate: row.caption_template,
      frames: frames.rows.map(f => ({ id: f.id, imageUrl: f.image_url, label: f.label, position: Number(f.position ?? 0) })),
    },
  })
})

export default app
