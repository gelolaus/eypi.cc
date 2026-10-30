import { Hono } from 'hono'
import type { Client } from '@libsql/client/web'
import { db, type Bindings } from '../lib/db'
import { withEdgeCache } from '../lib/edgeCache'
import { ApiError } from '../lib/errors'
import { deleteWithVariants, mediaUrl, parseImageMeta, putImage, type ImageMeta } from '../lib/media'
import { reportError } from '../lib/reportError'
import { checkRateLimit } from '../lib/rateLimit'
import { isOrgFeature } from '../middleware/orgGuard'
import { noOrgBody } from '../middleware/orgContext'

// Profile-frame campaigns. Frames are validated PNGs in R2. The public page
// merges a visitor photo on a canvas. The server stores object keys.
const app = new Hono<{ Bindings: Bindings }>()

const TITLE_MAX = 200
const DESCRIPTION_MAX = 1000
const CAPTION_MAX = 2000
const LABEL_MAX = 80
const SLUG_MAX = 60
const MAX_FRAMES = 10
const MIN_FRAME_PX = 1080
const MAX_FRAME_BYTES = 10 * 1024 * 1024
const DOWNLOAD_LIMIT_PER_HOUR = 30
const DOWNLOAD_WINDOW_SEC = 60 * 60
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type StoredFrame = {
  id: string
  key: string
  label: string | null
}

function frameMessage(err: ApiError): string {
  if (err.code === 'not_square') return 'Use a square PNG.'
  if (err.code === 'too_small') return 'Use a PNG at least 1080 px on each side.'
  if (err.code === 'file_too_large') return 'Use a PNG under 10 MB.'
  if (err.code === 'invalid_image') return 'Use a transparent PNG.'
  return err.message
}

function decodeDataUrl(value: string): Uint8Array | null {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(value.trim())
  if (!match?.[1]) return null
  let binary: string
  try {
    binary = atob(match[1].replace(/\s/g, ''))
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function pngHasAlpha(bytes: Uint8Array): boolean {
  if (bytes.length < 26 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return false
  }
  if (bytes[25] === 4 || bytes[25] === 6) return true
  for (let i = 8; i + 8 < bytes.length; i += 1) {
    if (bytes[i] === 0x74 && bytes[i + 1] === 0x52 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x53) return true
  }
  return false
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < 1 || height < 1) return null
  return { width, height }
}

function readFrameBytes(imageData: unknown): Uint8Array {
  if (typeof imageData !== 'string') {
    throw new ApiError(422, 'invalid_image', 'Use a transparent PNG.')
  }
  const bytes = decodeDataUrl(imageData)
  if (!bytes || !pngHasAlpha(bytes)) {
    throw new ApiError(422, 'invalid_image', 'Use a transparent PNG.')
  }
  return bytes
}

function frameLabel(label: unknown): string | null {
  if (typeof label !== 'string') return null
  const trimmed = label.trim().slice(0, LABEL_MAX)
  return trimmed || null
}

function isFrameKey(value: string): boolean {
  return value.startsWith('frames/') && !value.includes('..')
}

type DiscardItem = string | { key: string; meta: ImageMeta | null }

async function discardKeys(env: Bindings, items: DiscardItem[]) {
  await Promise.all(items.map(async (item) => {
    const { key, meta } = typeof item === 'string' ? { key: item, meta: null } : item
    try {
      await deleteWithVariants(env, key, meta)
    } catch {
      // The write already failed. A missing object should not hide that error.
    }
  }))
}

async function storeFrame(
  env: Bindings,
  campaignId: string,
  bytes: Uint8Array,
  label: string | null,
): Promise<StoredFrame> {
  const id = crypto.randomUUID()
  const image = await putImage(env, {
    prefix: `frames/${campaignId}`,
    id,
    bytes,
    allowed: ['png'],
    maxBytes: MAX_FRAME_BYTES,
    requireSquare: true,
    minSize: MIN_FRAME_PX,
  })
  return { id, key: image.key, label }
}

async function presentFrame(env: Bindings, stored: string): Promise<{ url: string; width: number; height: number }> {
  if (stored.startsWith('data:')) {
    const bytes = decodeDataUrl(stored)
    const size = bytes ? pngSize(bytes) : null
    return { url: stored, width: size?.width ?? 0, height: size?.height ?? 0 }
  }
  if (stored.startsWith('/media/') || stored.startsWith('http://') || stored.startsWith('https://')) {
    return { url: stored, width: 0, height: 0 }
  }
  let width = 0
  let height = 0
  const object = await env.MEDIA.get(stored)
  if (object) {
    const size = pngSize(new Uint8Array(await object.arrayBuffer()))
    if (size) {
      width = size.width
      height = size.height
    }
  }
  return { url: mediaUrl(stored), width, height }
}

async function loadFrames(env: Bindings, client: Client, campaignId: string) {
  const frames = await client.execute({
    sql: 'SELECT id, image_url, image_meta, label, position FROM dp_frames WHERE campaign_id = ? ORDER BY position, created_at',
    args: [campaignId],
  })
  return Promise.all(frames.rows.map(async (frame) => {
    const presented = await presentFrame(env, String(frame.image_url ?? ''))
    return {
      id: String(frame.id),
      label: frame.label == null ? null : String(frame.label),
      url: presented.url,
      imageMeta: presented.url.startsWith('/media/') ? parseImageMeta(frame.image_meta) : null,
      width: presented.width,
      height: presented.height,
      position: Number(frame.position ?? 0),
    }
  }))
}

function slugify(title: string): string {
  const base = title.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return base || 'frame'
}

async function slugTaken(client: Client, candidate: string, excludeId?: string): Promise<boolean> {
  const campaign = await client.execute({ sql: 'SELECT id FROM dp_campaigns WHERE slug = ?', args: [candidate] })
  if (campaign.rows.some((row) => row.id !== excludeId)) return true
  const history = await client.execute({
    sql: 'SELECT campaign_id FROM dp_slug_history WHERE old_slug = ?',
    args: [candidate],
  })
  return history.rows.some((row) => row.campaign_id !== excludeId)
}

// Find a slug not already taken (ignoring excludeId, the campaign being edited).
async function uniqueSlug(client: Client, base: string, excludeId?: string): Promise<string> {
  let candidate = base
  for (let n = 2; ; n++) {
    if (!(await slugTaken(client, candidate, excludeId))) return candidate
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
  if (await slugTaken(client, wanted, excludeId)) {
    return { error: 'That link is already taken. Choose another.', status: 409 }
  }
  return { slug: wanted }
}

// Shared owner guard: returns the campaign row id or a typed failure.
async function requireOwner(client: Client, id: string, orgId: string | undefined): Promise<{ ok: true } | { ok: false; status: 403 | 404; message: string }> {
  const existing = await client.execute({ sql: 'SELECT org_id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (existing.rows.length === 0) return { ok: false, status: 404, message: 'Campaign not found.' }
  const campaignOrgId = existing.rows[0].org_id

  if (!orgId || campaignOrgId !== orgId) return { ok: false, status: 403, message: 'Forbidden.' }
  return { ok: true }
}

// ── POST /api/dp ──────────────────────────────────────────────────────────────
// Create a campaign with one or more frames.
app.post('/api/dp', isOrgFeature, async (c) => {
  const user = c.var.user
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

  let decoded: { bytes: Uint8Array; label: string | null }[]
  try {
    decoded = frames.map((frame) => ({
      bytes: readFrameBytes(frame.imageData),
      label: frameLabel(frame.label),
    }))
  } catch (err) {
    if (err instanceof ApiError) return c.json({ status: 'error', message: frameMessage(err) }, 422)
    throw err
  }

  const client = db(c)
  const resolved = await resolveSlug(client, body.slug, title)
  if (resolved.error) return c.json({ status: 'error', message: resolved.error }, resolved.status ?? 400)
  const slug = resolved.slug!

  const id = crypto.randomUUID()
  // frame_image_url is a vestigial NOT NULL column from the baseline; frames live in dp_frames.
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)

  const stored: StoredFrame[] = []
  try {
    for (const frame of decoded) {
      stored.push(await storeFrame(c.env, id, frame.bytes, frame.label))
    }
    await client.batch([
      {
        sql: 'INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, description, frame_image_url, caption_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [id, user.id, orgId, title, slug, description || null, '', captionTemplate || null],
      },
      ...stored.map((frame, index) => ({
        sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
        args: [frame.id, id, frame.key, frame.label, index],
      })),
    ], 'write')
  } catch (err) {
    await discardKeys(c.env, stored.map((frame) => frame.key))
    if (err instanceof ApiError) return c.json({ status: 'error', message: frameMessage(err) }, 422)
    reportError(c, err)
    return c.json({ status: 'error', message: 'Could not create the campaign.' }, 500)
  }

  return c.json({
    status: 'ok',
    campaign: {
      id,
      title,
      slug,
      frames: stored.map((frame) => ({ id: frame.id, key: frame.key, url: mediaUrl(frame.key) })),
    },
  }, 201)
})

// ── GET /api/dp ───────────────────────────────────────────────────────────────
// List the creator's campaigns with frame + download counts (no heavy images).
app.get('/api/dp', isOrgFeature, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const client = db(c)
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)

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
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const slug = c.req.param('slug')!
  const client = db(c)

  const camp = await client.execute({ sql: 'SELECT id, org_id, title, slug, description, caption_template FROM dp_campaigns WHERE slug = ?', args: [slug] })
  if (camp.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)
  const row = camp.rows[0]

  const userOrgId = c.var.orgId
  if (!userOrgId || row.org_id !== userOrgId) return c.json({ status: 'error', message: 'Forbidden.' }, 403)

  return c.json({
    status: 'ok',
    campaign: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      captionTemplate: row.caption_template,
      frames: await loadFrames(c.env, client, String(row.id)),
    },
  })
})

// ── POST /api/dp/:id/frames ───────────────────────────────────────────────────
app.post('/api/dp/:id/frames', isOrgFeature, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c)
  const owner = await requireOwner(client, id, c.var.orgId)
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const body = await c.req.json() as { imageData?: string; label?: string }
  let bytes: Uint8Array
  try {
    bytes = readFrameBytes(body.imageData)
  } catch (err) {
    if (err instanceof ApiError) return c.json({ status: 'error', message: frameMessage(err) }, 422)
    throw err
  }

  let stored: StoredFrame
  try {
    stored = await storeFrame(c.env, id, bytes, frameLabel(body.label))
  } catch (err) {
    if (err instanceof ApiError) return c.json({ status: 'error', message: frameMessage(err) }, 422)
    throw err
  }

  const inserted = await client.execute({
    sql: `INSERT INTO dp_frames (id, campaign_id, image_url, label, position)
          SELECT ?, ?, ?, ?, COALESCE((SELECT MAX(position) FROM dp_frames WHERE campaign_id = ?), -1) + 1
          WHERE (SELECT COUNT(*) FROM dp_frames WHERE campaign_id = ?) < ?`,
    args: [stored.id, id, stored.key, stored.label, id, id, MAX_FRAMES],
  })
  if (Number(inserted.rowsAffected) !== 1) {
    await discardKeys(c.env, [stored.key])
    return c.json({ status: 'error', message: `A campaign can have at most ${MAX_FRAMES} frames.` }, 400)
  }
  await client.execute({ sql: 'UPDATE dp_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [id] })
  const placed = await client.execute({ sql: 'SELECT position FROM dp_frames WHERE id = ?', args: [stored.id] })

  return c.json({ status: 'ok', frame: { id: stored.id, key: stored.key, url: mediaUrl(stored.key), position: Number(placed.rows[0]?.position ?? 0) } }, 201)
})

// ── DELETE /api/dp/:id/frames/:frameId ────────────────────────────────────────
app.delete('/api/dp/:id/frames/:frameId', isOrgFeature, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const frameId = c.req.param('frameId')!
  const client = db(c)
  const owner = await requireOwner(client, id, c.var.orgId)
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const countRes = await client.execute({ sql: 'SELECT COUNT(*) AS cnt FROM dp_frames WHERE campaign_id = ?', args: [id] })
  if (Number(countRes.rows[0]?.cnt ?? 0) <= 1) {
    return c.json({ status: 'error', message: 'A campaign needs at least one frame.' }, 400)
  }

  const existingFrame = await client.execute({
    sql: 'SELECT image_url, image_meta FROM dp_frames WHERE id = ? AND campaign_id = ?',
    args: [frameId, id],
  })
  if (existingFrame.rows.length === 0) return c.json({ status: 'error', message: 'Frame not found.' }, 404)
  const imageKey = String(existingFrame.rows[0]?.image_url ?? '')

  const del = await client.execute({ sql: 'DELETE FROM dp_frames WHERE id = ? AND campaign_id = ?', args: [frameId, id] })
  if (del.rowsAffected === 0) return c.json({ status: 'error', message: 'Frame not found.' }, 404)
  await client.execute({ sql: 'UPDATE dp_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [id] })
  if (isFrameKey(imageKey)) {
    await discardKeys(c.env, [{ key: imageKey, meta: parseImageMeta(existingFrame.rows[0]?.image_meta) }])
  }

  return c.json({ status: 'ok' })
})

// ── PATCH /api/dp/:id/frames/order ────────────────────────────────────────────
// Owner-only reorder. Body { orderedIds } must be exactly this campaign's frame
// ids; positions are rewritten to match the given order.
app.patch('/api/dp/:id/frames/order', isOrgFeature, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c)
  const owner = await requireOwner(client, id, c.var.orgId)
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
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c)
  const owner = await requireOwner(client, id, c.var.orgId)
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
  let nextSlug: string | undefined
  if (body.slug !== undefined) {
    // Re-derive title for the auto-slug fallback when slug is cleared.
    const titleRow = await client.execute({ sql: 'SELECT title FROM dp_campaigns WHERE id = ?', args: [id] })
    const currentTitle = (body.title?.trim()) || (titleRow.rows[0]?.title as string) || ''
    const resolved = await resolveSlug(client, body.slug, currentTitle, id)
    if (resolved.error) return c.json({ status: 'error', message: resolved.error }, resolved.status ?? 400)
    nextSlug = resolved.slug
    updates.push('slug = ?'); args.push(nextSlug!)
  }

  if (!updates.length) return c.json({ status: 'error', message: 'Nothing to update.' }, 400)

  const current = await client.execute({ sql: 'SELECT slug FROM dp_campaigns WHERE id = ?', args: [id] })
  const oldSlug = String(current.rows[0]?.slug ?? '')
  updates.push('updated_at = CURRENT_TIMESTAMP')
  args.push(id)

  const statements: { sql: string; args: (string | null)[] }[] = []
  if (nextSlug && nextSlug !== oldSlug) {
    statements.push(
      {
        sql: 'DELETE FROM dp_slug_history WHERE old_slug = ? AND campaign_id = ?',
        args: [nextSlug, id],
      },
      {
        sql: `INSERT INTO dp_slug_history (old_slug, campaign_id) VALUES (?, ?)
              ON CONFLICT(old_slug) DO UPDATE SET campaign_id = excluded.campaign_id`,
        args: [oldSlug, id],
      },
    )
  }
  statements.push({ sql: `UPDATE dp_campaigns SET ${updates.join(', ')} WHERE id = ?`, args })
  await client.batch(statements, 'write')

  // Return the (possibly auto-generated) slug so the editor can reflect it.
  const after = await client.execute({ sql: 'SELECT slug FROM dp_campaigns WHERE id = ?', args: [id] })
  return c.json({ status: 'ok', slug: after.rows[0]?.slug })
})

// ── DELETE /api/dp/:id ────────────────────────────────────────────────────────
app.delete('/api/dp/:id', isOrgFeature, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ status: 'error', message: 'Authentication required.' }, 401)

  const id = c.req.param('id')!
  const client = db(c)
  const owner = await requireOwner(client, id, c.var.orgId)
  if (!owner.ok) return c.json({ status: 'error', message: owner.message }, owner.status)

  const frames = await client.execute({ sql: 'SELECT image_url, image_meta FROM dp_frames WHERE campaign_id = ?', args: [id] })
  await client.batch([
    { sql: 'DELETE FROM dp_frames WHERE campaign_id = ?', args: [id] },
    { sql: 'DELETE FROM dp_campaigns WHERE id = ?', args: [id] },
  ], 'write')
  await discardKeys(
    c.env,
    frames.rows
      .map((frame) => ({ key: String(frame.image_url ?? ''), meta: parseImageMeta(frame.image_meta) }))
      .filter((frame) => isFrameKey(frame.key)),
  )

  return c.json({ status: 'ok', message: 'Campaign deleted.' })
})

// ── POST /api/dp/:id/download ─────────────────────────────────────────────────
// Public counter. Counts every save; a loose hourly guard per IP per campaign stops scripted floods.
app.post('/api/dp/:id/download', async (c) => {
  const id = c.req.param('id')!
  const client = db(c)
  const existing = await client.execute({ sql: 'SELECT id FROM dp_campaigns WHERE id = ?', args: [id] })
  if (existing.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)

  const ip = c.req.header('CF-Connecting-IP')?.trim() || 'unknown'
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'dp-download-hour',
    subject: `${id}:${ip}`,
    limit: DOWNLOAD_LIMIT_PER_HOUR,
    windowSec: DOWNLOAD_WINDOW_SEC,
  })
  if (!decision.ok) {
    return c.json({ status: 'error', message: 'You are saving too fast. Try again in a little while.' }, 429)
  }

  await client.execute({
    sql: 'UPDATE dp_campaigns SET download_count = download_count + 1 WHERE id = ?',
    args: [id],
  })
  return c.json({ status: 'ok', ok: true })
})

// ── GET /api/dp/:slug ─────────────────────────────────────────────────────────
// Public page payload by slug, including every frame. Declared last so the more
// specific /:id/* routes above are matched first by segment count (Hono matches
// on segment count, so order is not strictly required, but this reads clearly).
app.get('/api/dp/:slug', (c) => withEdgeCache(c, 30, async () => {
  const slug = c.req.param('slug')!
  const client = db(c)
  let result = await client.execute({
    sql: 'SELECT id, title, slug, description, caption_template, download_count FROM dp_campaigns WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) {
    const history = await client.execute({
      sql: 'SELECT campaign_id FROM dp_slug_history WHERE old_slug = ?',
      args: [slug],
    })
    if (history.rows.length > 0) {
      result = await client.execute({
        sql: 'SELECT id, title, slug, description, caption_template, download_count FROM dp_campaigns WHERE id = ?',
        args: [history.rows[0]?.campaign_id],
      })
    }
  }
  if (result.rows.length === 0) return c.json({ status: 'error', message: 'Campaign not found.' }, 404)

  const row = result.rows[0]
  // Same source as the Insights funnel (downloads plus shares), so the public page and Insights agree.
  // The subject range [id:, id;) matches every 'id:frame' without LIKE ('_' is a wildcard there); ';' follows ':'.
  const saved = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM module_events
          WHERE module = 'frames' AND action IN ('download', 'share')
            AND (subject_id = ?1 OR (subject_id >= ?1 || ':' AND subject_id < ?1 || ';'))`,
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
      downloadCount: Number(saved.rows[0]?.n ?? 0),
      frames: await loadFrames(c.env, client, String(row.id)),
    },
  })
}))

export default app
