import { Hono } from 'hono'
import { db, type Bindings } from '../lib/db'
import { ApiError } from '../lib/errors'
import { putImage, type ImageFormat } from '../lib/media'
import { requireAdmin } from '../middleware/requireAdmin'
import { requireAuth } from '../middleware/requireAuth'

const app = new Hono<{ Bindings: Bindings }>()

const MAX_BYTES = 10 * 1024 * 1024
const FORMATS: readonly ImageFormat[] = ['png', 'jpeg', 'webp']

type Counts = {
  dryRun: boolean
  frames: number
  orgImages: number
  qrLogos: number
}

function dataImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.toLowerCase().startsWith('data:') ? trimmed : null
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

async function uploadDataUrl(
  env: Bindings,
  label: string,
  dataUrl: string,
  prefix: string,
  id: string,
): Promise<string> {
  const bytes = decodeDataUrl(dataUrl)
  if (!bytes) {
    throw new ApiError(422, 'invalid_image', `${label} is not a base64 image.`)
  }
  try {
    const stored = await putImage(env, {
      prefix,
      id,
      bytes,
      allowed: FORMATS,
      maxBytes: MAX_BYTES,
    })
    return stored.key
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ApiError(err.status, err.code, `${label} could not be stored. ${err.message}`)
    }
    throw err
  }
}

function qrSource(raw: string): { config: Record<string, unknown>; dataUrl: string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ApiError(422, 'invalid_image', 'A QR logo config is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const config = parsed as Record<string, unknown>
  const fromLegacy = dataImage(config.logoDataUrl)
  if (fromLegacy) return { config, dataUrl: fromLegacy }
  const fromLogo = dataImage(config.logo)
  if (fromLogo) return { config, dataUrl: fromLogo }
  return null
}

app.post('/api/admin/migrations/media', requireAuth, requireAdmin, async (c) => {
  // Anything other than dryRun=0 only reports. A missing flag must not write.
  const dryRun = c.req.query('dryRun') !== '0'
  const client = db(c)
  const counts: Counts = { dryRun, frames: 0, orgImages: 0, qrLogos: 0 }

  const frames = await client.execute(
    "SELECT id, campaign_id, image_url FROM dp_frames WHERE image_url LIKE 'data:%'",
  )
  for (const row of frames.rows) {
    const dataUrl = dataImage(row.image_url)
    if (!dataUrl) continue
    counts.frames += 1
    if (dryRun) continue
    const id = String(row.id)
    const key = await uploadDataUrl(c.env, `Frame ${id}`, dataUrl, `frames/${String(row.campaign_id)}`, id)
    await client.execute({
      sql: "UPDATE dp_frames SET image_url = ? WHERE id = ? AND image_url LIKE 'data:%'",
      args: [key, id],
    })
  }

  const orgs = await client.execute(
    `SELECT id, logo_url, banner_url FROM organizations
     WHERE logo_url LIKE 'data:%' OR banner_url LIKE 'data:%'`,
  )
  for (const row of orgs.rows) {
    const id = String(row.id)
    const logo = dataImage(row.logo_url)
    const banner = dataImage(row.banner_url)
    if (logo) {
      counts.orgImages += 1
      if (!dryRun) {
        const key = await uploadDataUrl(c.env, `Logo for org ${id}`, logo, `orgs/${id}`, 'logo')
        await client.execute({
          sql: "UPDATE organizations SET logo_url = ? WHERE id = ? AND logo_url LIKE 'data:%'",
          args: [key, id],
        })
      }
    }
    if (banner) {
      counts.orgImages += 1
      if (!dryRun) {
        const key = await uploadDataUrl(c.env, `Banner for org ${id}`, banner, `orgs/${id}`, 'banner')
        await client.execute({
          sql: "UPDATE organizations SET banner_url = ? WHERE id = ? AND banner_url LIKE 'data:%'",
          args: [key, id],
        })
      }
    }
  }

  const links = await client.execute(
    "SELECT id, qr_config FROM links WHERE qr_config LIKE '%data:%'",
  )
  for (const row of links.rows) {
    const raw = row.qr_config == null ? '' : String(row.qr_config)
    const source = qrSource(raw)
    if (!source) continue
    counts.qrLogos += 1
    if (dryRun) continue
    const id = String(row.id)
    const key = await uploadDataUrl(c.env, `QR logo for link ${id}`, source.dataUrl, 'qr-logos', id)
    const next: Record<string, unknown> = { ...source.config, logo: { key } }
    delete next.logoDataUrl
    await client.execute({
      sql: "UPDATE links SET qr_config = ? WHERE id = ? AND qr_config LIKE '%data:%'",
      args: [JSON.stringify(next), id],
    })
  }

  return c.json(counts)
})

export default app
