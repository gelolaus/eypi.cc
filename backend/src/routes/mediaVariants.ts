import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Client } from '@libsql/client/web'
import { recordAudit } from '../lib/audit'
import { db, type Bindings } from '../lib/db'
import { ApiError } from '../lib/errors'
import {
  deleteObject,
  parseImageMeta,
  putVariant,
  sniff,
  variantKeys,
  type ImageFormat,
  type ImageMeta,
} from '../lib/media'
import { checkRateLimit } from '../lib/rateLimit'
import { reportError } from '../lib/reportError'
import { enforceConsent } from '../middleware/requireConsent'
import { requireAuth } from '../middleware/requireAuth'

type Variables = {
  userId: string
  userEmail: string
  user?: { id: string; email?: string; name?: string; role?: string }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const MAX_VARIANT_BYTES = 2 * 1024 * 1024
const MAX_PLACEHOLDER_CHARS = 2000
const MAX_VARIANTS = 4
// Three 2 MB variants as base64 plus the JSON wrapper. Anything larger is refused unread.
const MAX_BODY_BYTES = 9 * 1024 * 1024
// Mirrors src/lib/images/profiles.ts (the browser maker). Keep the two in step.
const PROFILE_WIDTHS: Record<KeyKind, readonly number[]> = {
  orgLogo: [96, 192, 384],
  banner: [640, 1280, 1920],
  frame: [256, 512, 1024],
}
const FORMATS: readonly ImageFormat[] = ['webp', 'jpeg', 'png']

type KeyKind = 'orgLogo' | 'banner' | 'frame'

type KeyTarget =
  | { kind: 'orgLogo' | 'banner'; column: 'logo' | 'banner' }
  | { kind: 'frame' }

// Only these shapes can ever be written to. The original key patterns are
// produced by putImage: `{prefix}/{id}-{sha8}.{ext}`.
const ORG_KEY = /^orgs\/[a-z0-9-]{1,64}\/(logo|banner)-[0-9a-f]{8}\.(png|jpg|webp)$/
const FRAME_KEY = /^frames\/[A-Za-z0-9-]{1,64}\/[A-Za-z0-9-]{1,64}-[0-9a-f]{8}\.png$/

function fail(status: ContentfulStatusCode, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function classifyKey(key: string): KeyTarget | null {
  const org = ORG_KEY.exec(key)
  if (org) return org[1] === 'logo' ? { kind: 'orgLogo', column: 'logo' } : { kind: 'banner', column: 'banner' }
  if (FRAME_KEY.test(key)) return { kind: 'frame' }
  return null
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function decodeImageDataUrl(value: unknown, maxBytes: number): Uint8Array {
  const invalid = () => new ApiError(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
  if (typeof value !== 'string') throw invalid()
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value)
  if (!match) throw invalid()
  // Check the encoded length first so an oversized payload is never decoded.
  if (Math.ceil((match[1].length * 3) / 4) > maxBytes + 2) {
    throw new ApiError(422, 'file_too_large', 'That image is too large.')
  }
  const bytes = decodeBase64(match[1])
  if (!bytes) throw invalid()
  if (bytes.byteLength > maxBytes) throw new ApiError(422, 'file_too_large', 'That image is too large.')
  return bytes
}

type Row = { orgId: string; column: 'logo_meta' | 'banner_meta' | 'image_meta'; table: 'organizations' | 'dp_frames'; id: string; keyColumn: string; meta: ImageMeta | null; rowKey: string }

async function findRow(client: Client, key: string, target: KeyTarget): Promise<Row | null> {
  if (target.kind === 'frame') {
    const res = await client.execute({
      sql: `SELECT f.id AS id, f.image_meta AS meta, c.org_id AS org_id
            FROM dp_frames f JOIN dp_campaigns c ON c.id = f.campaign_id
            WHERE f.image_url = ? LIMIT 1`,
      args: [key],
    })
    const row = res.rows[0]
    if (!row) return null
    return {
      orgId: String(row.org_id ?? ''),
      column: 'image_meta',
      table: 'dp_frames',
      id: String(row.id),
      keyColumn: 'image_url',
      meta: parseImageMeta(row.meta),
      rowKey: key,
    }
  }
  const url = target.column === 'logo' ? 'logo_url' : 'banner_url'
  const metaColumn = target.column === 'logo' ? 'logo_meta' : 'banner_meta'
  const res = await client.execute({
    sql: `SELECT id, ${metaColumn} AS meta FROM organizations WHERE ${url} = ? LIMIT 1`,
    args: [key],
  })
  const row = res.rows[0]
  if (!row) return null
  return {
    orgId: String(row.id),
    column: metaColumn,
    table: 'organizations',
    id: String(row.id),
    keyColumn: url,
    meta: parseImageMeta(row.meta),
    rowKey: key,
  }
}

async function canWrite(client: Client, user: { id: string; role?: string }, orgId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!orgId) return false
  const res = await client.execute({
    sql: `SELECT 1 FROM organizations WHERE id = ? AND owner_id = ?
          UNION ALL
          SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND activated_at IS NOT NULL
          LIMIT 1`,
    args: [orgId, user.id, orgId, user.id],
  })
  return res.rows.length > 0
}

app.use('/api/media/*', async (c, next) => {
  let denied: Response | null = null
  const authed = await requireAuth(c, async () => {
    denied = await enforceConsent(c)
    if (!denied) await next()
  })
  if (denied) return denied
  return authed
})

/**
 * PUT /api/media/variants
 * Stores right-sized variants and the placeholder for an image already saved in R2,
 * then records its meta on the row that holds the key. Idempotent: a re-run replaces
 * the variants and removes any the new meta no longer lists.
 */
app.put('/api/media/variants', async (c) => {
  const user = c.var.user
  if (!user?.id) return fail(401, 'unauthorized', 'Sign in to continue.')

  const limited = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'media-variants',
    subject: user.id,
    limit: 30,
    windowSec: 60,
  })
  if (!limited.ok) return fail(429, 'rate_limited', 'Too many image uploads. Try again shortly.')

  const declared = Number(c.req.header('Content-Length') ?? 0)
  if (declared > MAX_BODY_BYTES) return fail(413, 'payload_too_large', 'That request is too large.')
  const text = await c.req.text()
  if (text.length > MAX_BODY_BYTES) return fail(413, 'payload_too_large', 'That request is too large.')

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return fail(400, 'invalid_body', 'Send a JSON body.')
  }
  if (!body || typeof body !== 'object') return fail(400, 'invalid_body', 'Send a JSON body.')
  const input = body as Record<string, unknown>

  const rawKey = typeof input.key === 'string' ? input.key.trim() : ''
  const key = rawKey.startsWith('/media/') ? rawKey.slice('/media/'.length) : rawKey
  const target = classifyKey(key)
  if (!target) return fail(404, 'not_found', 'Image not found.')

  const client = db(c)
  try {
    const row = await findRow(client, key, target)
    if (!row) return fail(404, 'not_found', 'Image not found.')
    if (!(await canWrite(client, user, row.orgId))) {
      return fail(403, 'forbidden', 'You cannot change this image.')
    }

    const variantsInput = input.variants
    if (!Array.isArray(variantsInput) || variantsInput.length > MAX_VARIANTS) {
      return fail(422, 'invalid_variants', 'Send at most four variants.')
    }

    const profile = PROFILE_WIDTHS[target.kind]

    const original = await c.env.MEDIA.get(key)
    if (!original) return fail(404, 'not_found', 'Image not found.')
    const originalImage = sniff(new Uint8Array(await original.arrayBuffer()))
    if (!originalImage) return fail(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')

    const metaInput = input.meta && typeof input.meta === 'object' ? input.meta as Record<string, unknown> : {}

    let placeholder = ''
    if (input.placeholder !== undefined && input.placeholder !== '') {
      if (typeof input.placeholder !== 'string' || input.placeholder.length > MAX_PLACEHOLDER_CHARS) {
        return fail(422, 'invalid_placeholder', 'The placeholder is not valid.')
      }
      const bytes = decodeImageDataUrl(input.placeholder, MAX_PLACEHOLDER_CHARS)
      const sniffed = sniff(bytes)
      if (!sniffed) return fail(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
      // Rebuild from the sniffed format so the client's declared MIME is never stored.
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      placeholder = `data:image/${sniffed.format};base64,${btoa(binary)}`
    }

    const seen = new Set<number>()
    const decoded: { width: number; bytes: Uint8Array; format: ImageFormat }[] = []
    for (const entry of variantsInput) {
      if (!entry || typeof entry !== 'object') return fail(422, 'invalid_variants', 'A variant is not valid.')
      const { width, dataUrl } = entry as { width?: unknown; dataUrl?: unknown }
      if (typeof width !== 'number' || !Number.isInteger(width) || !profile.includes(width) || seen.has(width)) {
        return fail(422, 'invalid_width', 'That variant width is not allowed.')
      }
      if (width > originalImage.width) {
        return fail(422, 'variant_too_wide', 'A variant cannot be wider than the original.')
      }
      seen.add(width)
      const bytes = decodeImageDataUrl(dataUrl, MAX_VARIANT_BYTES)
      const image = sniff(bytes)
      if (!image) return fail(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
      if (image.width !== width) return fail(422, 'invalid_width', 'The variant is not the width it claims.')
      decoded.push({ width, bytes, format: image.format })
    }

    let fmt: ImageFormat
    if (decoded.length > 0) {
      fmt = decoded[0].format
      if (decoded.some((variant) => variant.format !== fmt)) {
        return fail(422, 'mixed_formats', 'Send every variant in one format.')
      }
    } else {
      fmt = FORMATS.includes(metaInput.fmt as ImageFormat) ? metaInput.fmt as ImageFormat : originalImage.format
    }

    decoded.sort((a, b) => a.width - b.width)
    const meta: ImageMeta = {
      w: originalImage.width,
      h: originalImage.height,
      fmt,
      widths: decoded.map((variant) => variant.width),
      ph: placeholder,
    }

    const written: string[] = []
    try {
      for (const variant of decoded) {
        written.push(await putVariant(c.env, {
          originalKey: key,
          width: variant.width,
          fmt,
          bytes: variant.bytes,
        }))
      }
      const updated = await client.execute({
        sql: `UPDATE ${row.table} SET ${row.column} = ? WHERE id = ? AND ${row.keyColumn} = ?`,
        args: [JSON.stringify(meta), row.id, key],
      })
      if (Number(updated.rowsAffected) !== 1) throw new ApiError(404, 'not_found', 'Image not found.')
    } catch (err) {
      await Promise.all(written.map(async (variant) => {
        try {
          await deleteObject(c.env, variant)
        } catch {
          // Keep the original error.
        }
      }))
      throw err
    }

    // A re-run can change widths or format; drop variants the new meta no longer lists.
    const keep = new Set(written)
    await Promise.all(variantKeys(key, row.meta).filter((old) => !keep.has(old)).map(async (old) => {
      try {
        await deleteObject(c.env, old)
      } catch {
        // A leftover variant is harmless.
      }
    }))

    await recordAudit(client, {
      actorUserId: user.id,
      action: 'media.variants',
      targetType: row.table === 'organizations' ? 'organization' : 'dp_frame',
      targetId: row.id,
      meta: { key, widths: meta.widths, fmt },
    })

    return c.json({ meta })
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.status as ContentfulStatusCode, err.code, err.message)
    }
    reportError(c, err, { message: 'Error storing image variants.' })
    return fail(500, 'internal_error', 'Internal server error')
  }
})

export default app
