import { Hono, type Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { InValue } from '@libsql/client'
import { db, type Bindings } from '../lib/db'
import { ApiError } from '../lib/errors'
import { deleteObject, mediaUrl, putImage } from '../lib/media'
import { requireAuth } from '../middleware/requireAuth'
import { requireConsent } from '../middleware/requireConsent'
import { checkRateLimit } from '../lib/rateLimit'
import { visitorHash } from '../lib/ipHash'
import { isBot } from '../lib/links/bots'
import { toCsv } from '../lib/links/csv'
import { hashLinkPassword, verifyLinkPassword } from '../lib/links/password'
import { checkSafeBrowsing } from '../lib/links/safeBrowsing'
import { reportError } from '../lib/reportError'
import { manilaDaySpan, manilaSql, manilaTimestamp, manilaWindow } from '../lib/manilaTime'
import { getOS, logLinkClick, sanitizeReferrer } from '../../../shared/linkAnalytics'
import { encodeLinkKv, type LinkKvEntry } from '../../../shared/linksKv'
import { generateSlug, normalizeSlugInput, validateSlug } from '../../../shared/slugRules'
import { validateDestination, type DestinationCode } from '../../../shared/urlSafety'
import {
  parseLinkQrConfig,
  prepareQrConfigForSave,
  serializeLinkQrConfig,
} from '../../../shared/linkQrConfig'

const SELF_HOSTS = ['eypi.cc']
const PAGE_SIZE = 25
const LINK_QUOTA = 500
const CREATE_LIMIT = 30
const EDIT_LIMIT = 120
const HOUR_SEC = 3600
const UNLOCK_LIMIT = 10
const UNLOCK_WINDOW_SEC = 15 * 60
const RESOLVE_LIMIT = 60
const RESOLVE_WINDOW_SEC = 60
const QR_LOGO_MAX_BYTES = 3 * 1024 * 1024

const LINK_COLUMNS = `id, slug, original_url, clicks, created_at, expires_at, disabled_at,
  disabled_reason, password_hash, qr_config`

type LinkVars = { userId: string; userEmail: string }
type AppContext = Context<{ Bindings: Bindings; Variables: LinkVars }>
type Sort = 'new' | 'old' | 'clicks'
type LinkRow = {
  id: string
  slug: string
  original_url: string
  clicks: number
  created_at: string | null
  expires_at: string | null
  disabled_at: string | null
  disabled_reason: string | null
  password_hash: string | null
  qr_config: string | null
}

const app = new Hono<{ Bindings: Bindings; Variables: LinkVars }>()

function fail(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  const error: { code: string; message: string; fields?: Record<string, string> } = { code, message }
  if (fields) error.fields = fields
  return c.json({ error }, status)
}

function tooMany(c: Context, retryAfter: number, message = 'Too many requests. Try again later.') {
  c.header('Retry-After', String(retryAfter))
  return fail(c, 429, 'too_many', message)
}

function text(value: unknown): string | null {
  if (value == null) return null
  const raw = String(value)
  return raw.length === 0 ? null : raw
}

function mapRow(row: Record<string, unknown>): LinkRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    original_url: String(row.original_url),
    clicks: Number(row.clicks ?? 0),
    created_at: text(row.created_at),
    expires_at: text(row.expires_at),
    disabled_at: text(row.disabled_at),
    disabled_reason: text(row.disabled_reason),
    password_hash: text(row.password_hash),
    qr_config: text(row.qr_config),
  }
}

function iso(value: string | null): string | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : value
}

function epochSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined
}

function isExpired(value: string | null, now = Date.now()): boolean {
  const seconds = epochSeconds(value)
  return seconds !== undefined && seconds * 1000 <= now
}

function linkStatus(row: Pick<LinkRow, 'disabled_at' | 'expires_at' | 'password_hash'>, now = Date.now()): string {
  if (row.disabled_at) return 'disabled'
  if (isExpired(row.expires_at, now)) return 'expired'
  if (row.password_hash) return 'protected'
  return 'active'
}

function analyticsRange(value: string | undefined): 7 | 30 | 90 {
  if (value === '7' || value === '30' || value === '90') return Number(value) as 7 | 30 | 90
  return 30
}

function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function sqlNow(now = new Date()): string {
  return now.toISOString().slice(0, 19).replace('T', ' ')
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

function readLogoKey(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { logo?: unknown }
    if (!parsed.logo || typeof parsed.logo !== 'object') return null
    const key = (parsed.logo as { key?: unknown }).key
    if (typeof key !== 'string' || !key.startsWith('qr-logos/') || key.includes('..') || key.includes('\\')) {
      return null
    }
    return key
  } catch {
    return null
  }
}

function isOwnQrLogoKey(linkId: string, key: string): boolean {
  const prefix = `qr-logos/${linkId}-`
  if (!key.startsWith(prefix) || !key.endsWith('.png') || key.includes('..')) return false
  return /^[0-9a-f]{8}$/.test(key.slice(prefix.length, -'.png'.length))
}

function storeQrConfig(config: ReturnType<typeof parseLinkQrConfig>, logoKey: string | null): string {
  const styles = JSON.parse(serializeLinkQrConfig({ ...config, logoDataUrl: null })) as Record<string, unknown>
  delete styles.logoDataUrl
  if (logoKey) styles.logo = { key: logoKey }
  return JSON.stringify(styles)
}

type LogoWrite = {
  qrConfig: string
  deleteKey: string | null
  uploadedKey: string | null
}

async function writeQrLogo(
  c: AppContext,
  linkId: string,
  config: ReturnType<typeof parseLinkQrConfig>,
  currentRaw: string | null,
): Promise<LogoWrite> {
  const previousKey = readLogoKey(currentRaw)
  const logo = config.logoDataUrl?.trim() || null
  let nextKey = previousKey
  let uploadedKey: string | null = null

  if (!logo) {
    nextKey = null
  } else if (logo.startsWith('/media/')) {
    const key = logo.slice('/media/'.length)
    nextKey = isOwnQrLogoKey(linkId, key) ? key : previousKey
  } else if (logo.startsWith('data:')) {
    const bytes = decodeDataUrl(logo)
    if (!bytes) throw new ApiError(422, 'invalid_image', 'Use a PNG image.')
    const stored = await putImage(c.env, {
      prefix: 'qr-logos',
      id: linkId,
      bytes,
      allowed: ['png'],
      maxBytes: QR_LOGO_MAX_BYTES,
    })
    nextKey = stored.key
    uploadedKey = stored.key === previousKey ? null : stored.key
  }

  return {
    qrConfig: storeQrConfig(config, nextKey),
    deleteKey: nextKey === previousKey ? null : previousKey,
    uploadedKey,
  }
}

async function discardLogo(c: AppContext, key: string | null) {
  if (!key) return
  try {
    await deleteObject(c.env, key)
  } catch (err) {
    reportError(c, err, { code: 'media_delete_failed', message: 'Could not delete the QR logo.' })
  }
}

function hasLogo(raw: string | null): boolean {
  if (readLogoKey(raw)) return true
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as { logoDataUrl?: unknown }
    return typeof parsed.logoDataUrl === 'string' && parsed.logoDataUrl.length > 0
  } catch {
    return false
  }
}

function toListItem(row: LinkRow) {
  return {
    id: row.id,
    slug: row.slug,
    url: row.original_url,
    clicks: row.clicks,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    disabledAt: iso(row.disabled_at),
    disabledReason: row.disabled_reason,
    protected: Boolean(row.password_hash),
    hasLogo: hasLogo(row.qr_config),
  }
}

function toDetail(row: LinkRow) {
  const config = parseLinkQrConfig(row.qr_config)
  const key = readLogoKey(row.qr_config)
  if (key) config.logoDataUrl = mediaUrl(key)
  return {
    ...toListItem(row),
    qrConfig: config,
  }
}

function kvValue(row: Pick<LinkRow, 'id' | 'original_url' | 'expires_at' | 'password_hash'>): string {
  const entry: LinkKvEntry = { id: row.id, url: row.original_url }
  const exp = epochSeconds(row.expires_at)
  if (exp !== undefined) entry.exp = exp
  if (row.password_hash) entry.pw = true
  return encodeLinkKv(entry)
}

function requestSource(src: string | undefined): 'qr' | 'direct' {
  return src === 'qr' ? 'qr' : 'direct'
}

function isSlugConflict(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return /links\.slug/i.test(err.message)
}

function slugMessage(verdict: 'invalid' | 'reserved'): string {
  return verdict === 'reserved'
    ? 'That slug is reserved.'
    : 'Use lowercase letters, numbers, and hyphens.'
}

function destinationMessage(code: DestinationCode): string {
  if (code === 'userinfo') return 'Remove the username from that URL.'
  if (code === 'self_link') return 'That destination points at eypi.cc.'
  if (code === 'shortener') return 'Use the full destination instead of another shortener.'
  if (code === 'private_address' || code === 'blocked_host') return 'That destination is not allowed.'
  return 'Enter a valid http or https URL.'
}

async function rejectUnsafeDestination(c: AppContext, url: string): Promise<Response | null> {
  const decision = await checkSafeBrowsing(url, c.env.SAFE_BROWSING_API_KEY)
  if (decision.outcome === 'unsafe') {
    const message = 'That destination is unsafe.'
    return fail(c, 422, 'unsafe_destination', message, { url: message })
  }
  if (decision.outcome === 'fail_open') {
    reportError(c, decision.error, {
      code: 'safe_browsing_unavailable',
      message: 'Safe Browsing lookup failed.',
    })
  }
  return null
}

async function readBody(c: Context): Promise<Record<string, unknown> | Response> {
  try {
    const body = await c.req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.')
    }
    return body as Record<string, unknown>
  } catch {
    return fail(c, 422, 'invalid', 'Check the highlighted fields.')
  }
}

async function loadBySlug(c: AppContext, slug: string): Promise<LinkRow | null> {
  const result = await db(c).execute({
    sql: `SELECT ${LINK_COLUMNS} FROM links WHERE slug = ?`,
    args: [slug],
  })
  const row = result.rows[0]
  return row ? mapRow(row as unknown as Record<string, unknown>) : null
}

async function loadOwned(c: AppContext, id: string): Promise<LinkRow | null> {
  const result = await db(c).execute({
    sql: `SELECT ${LINK_COLUMNS} FROM links WHERE id = ? AND user_id = ?`,
    args: [id, c.var.userId],
  })
  const row = result.rows[0]
  return row ? mapRow(row as unknown as Record<string, unknown>) : null
}

async function deleteKvKey(kv: KVNamespace, key: string): Promise<void> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await kv.delete(key)
      return
    } catch (err) {
      last = err
    }
  }
  throw last instanceof Error ? last : new Error('Could not delete the edge key')
}

async function restoreEdge(c: AppContext, slug: string): Promise<void> {
  const row = await loadBySlug(c, slug)
  if (!row || row.disabled_at) {
    await deleteKvKey(c.env.LINKS_KV, slug)
    return
  }
  await c.env.LINKS_KV.put(slug, kvValue(row))
}

async function enforceEditLimit(c: AppContext): Promise<Response | null> {
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'edit',
    subject: c.var.userId,
    limit: EDIT_LIMIT,
    windowSec: HOUR_SEC,
  })
  if (!decision.ok) return tooMany(c, decision.retryAfter)
  return null
}

async function recordClick(
  c: AppContext,
  linkId: string,
  referrer: string | undefined,
  source: 'qr' | 'direct',
): Promise<void> {
  const userAgent = c.req.header('User-Agent') ?? null
  if (isBot(userAgent)) return
  const secret = c.env.IP_HASH_SECRET?.trim()
  const ip = c.req.header('CF-Connecting-IP') ?? ''
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const hashed = secret ? await visitorHash(secret, day, ip, userAgent ?? '') : null
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? 'Unknown'
  await logLinkClick(db(c), {
    linkId,
    os: getOS(userAgent),
    country,
    referrer: sanitizeReferrer(referrer),
    source,
    visitorHash: hashed,
  })
}

function encodeCursor(payload: { sort: Sort; value: string; id: string }): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeCursor(raw: string): { sort: string; value: string; id: string } | null {
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const binary = atob(padded + pad)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      sort?: unknown
      value?: unknown
      id?: unknown
    }
    if (typeof parsed.sort !== 'string' || typeof parsed.value !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return { sort: parsed.sort, value: parsed.value, id: parsed.id }
  } catch {
    return null
  }
}

function likePattern(q: string): string {
  return `%${q.replace(/[!%_]/g, (char) => `!${char}`)}%`
}

app.get('/api/links', requireAuth, async (c) => {
  const sort: Sort = c.req.query('sort') === 'old' || c.req.query('sort') === 'clicks'
    ? c.req.query('sort') as Sort
    : 'new'
  const status = c.req.query('status') ?? 'all'
  const q = (c.req.query('q') ?? '').trim()
  const where = ['user_id = ?']
  const args: InValue[] = [c.var.userId]

  if (q) {
    const pattern = likePattern(q)
    where.push("(slug LIKE ? ESCAPE '!' OR original_url LIKE ? ESCAPE '!')")
    args.push(pattern, pattern)
  }
  if (status === 'active') {
    where.push("disabled_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))")
  } else if (status === 'expired') {
    where.push("expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')")
  } else if (status === 'disabled') {
    where.push('disabled_at IS NOT NULL')
  } else if (status === 'protected') {
    where.push("password_hash IS NOT NULL AND password_hash != ''")
  }

  const cursor = decodeCursor(c.req.query('cursor') ?? '')
  if (cursor && cursor.sort === sort) {
    if (sort === 'old') {
      where.push('(created_at > ? OR (created_at = ? AND id > ?))')
      args.push(cursor.value, cursor.value, cursor.id)
    } else if (sort === 'clicks') {
      where.push('(COALESCE(clicks, 0) < ? OR (COALESCE(clicks, 0) = ? AND id < ?))')
      args.push(Number(cursor.value), Number(cursor.value), cursor.id)
    } else {
      where.push('(created_at < ? OR (created_at = ? AND id < ?))')
      args.push(cursor.value, cursor.value, cursor.id)
    }
  }

  const order = sort === 'old'
    ? 'created_at ASC, id ASC'
    : sort === 'clicks'
      ? 'COALESCE(clicks, 0) DESC, id DESC'
      : 'created_at DESC, id DESC'
  const result = await db(c).execute({
    sql: `SELECT ${LINK_COLUMNS} FROM links WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`,
    args: [...args, PAGE_SIZE + 1],
  })
  const rows = result.rows.map((row) => mapRow(row as unknown as Record<string, unknown>))
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last
    ? encodeCursor({
      sort,
      value: sort === 'clicks' ? String(last.clicks) : String(last.created_at ?? ''),
      id: last.id,
    })
    : null
  return c.json({ items: page.map(toListItem), nextCursor })
})

app.get('/api/links/slug-available', requireAuth, async (c) => {
  const slug = normalizeSlugInput(c.req.query('slug') ?? '')
  const verdict = validateSlug(slug)
  if (verdict !== 'ok') return c.json({ available: false, reason: verdict })
  const taken = await loadBySlug(c, slug)
  if (taken) return c.json({ available: false, reason: 'taken' })
  return c.json({ available: true })
})

app.get('/api/links/resolve/:slug', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'resolve',
    subject: ip,
    limit: RESOLVE_LIMIT,
    windowSec: RESOLVE_WINDOW_SEC,
  })
  if (!decision.ok) return tooMany(c, decision.retryAfter)

  const row = await loadBySlug(c, normalizeSlugInput(c.req.param('slug')))
  if (!row || row.disabled_at) return fail(c, 404, 'not_found', 'Not found')
  if (isExpired(row.expires_at)) {
    return fail(c, 410, 'link_expired', 'This link has expired.')
  }
  if (row.password_hash) return c.json({ protected: true })

  await recordClick(c, row.id, c.req.query('r'), requestSource(c.req.query('src')))
  return c.json({ url: row.original_url })
})

app.get('/api/links/export.csv', requireAuth, async (c) => {
  const result = await db(c).execute({
    sql: `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    args: [c.var.userId],
  })
  const rows: string[][] = [[
    'slug',
    'short_url',
    'destination',
    'clicks',
    'created_at',
    'expires_at',
    'status',
  ]]
  for (const item of result.rows) {
    const row = mapRow(item as unknown as Record<string, unknown>)
    rows.push([
      row.slug,
      `https://eypi.cc/${row.slug}`,
      row.original_url,
      String(row.clicks),
      iso(row.created_at) ?? '',
      iso(row.expires_at) ?? '',
      linkStatus(row),
    ])
  }
  return csvResponse(toCsv(rows), 'links.csv')
})

app.get('/api/links/:id/analytics', requireAuth, async (c) => {
  const row = await loadOwned(c, c.req.param('id'))
  if (!row) return fail(c, 404, 'not_found', 'Not found')

  const range = analyticsRange(c.req.query('range'))
  const now = new Date()
  const bounds = manilaWindow(range, now)
  const where = `link_id = ? AND datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)`
  const args: InValue[] = [row.id, bounds.start, bounds.end]
  const dayExpr = `date(${manilaSql('created_at')})`
  const hourExpr = `strftime('%H', ${manilaSql('created_at')})`
  const client = db(c)
  const [summaryResult, referrerResult, countryResult, osResult, timelineResult, peakResult] = await Promise.all([
    client.execute({
      sql: `SELECT COUNT(*) AS total,
          COUNT(DISTINCT visitor_hash) AS unique_visitors,
          COALESCE(SUM(CASE WHEN source = 'qr' THEN 1 ELSE 0 END), 0) AS qr,
          COALESCE(SUM(CASE WHEN source = 'qr' THEN 0 ELSE 1 END), 0) AS direct
        FROM analytics WHERE ${where}`,
      args,
    }),
    client.execute({
      sql: `SELECT referrer, COUNT(*) AS n FROM analytics
        WHERE ${where} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY n DESC LIMIT 5`,
      args,
    }),
    client.execute({
      sql: `SELECT country, COUNT(*) AS n FROM analytics
        WHERE ${where} AND country IS NOT NULL AND country != ''
        GROUP BY country ORDER BY n DESC LIMIT 5`,
      args,
    }),
    client.execute({
      sql: `SELECT os, COUNT(*) AS n FROM analytics
        WHERE ${where} AND os IS NOT NULL AND os != ''
        GROUP BY os ORDER BY n DESC LIMIT 5`,
      args,
    }),
    client.execute({
      sql: `SELECT ${dayExpr} AS day, COUNT(*) AS n FROM analytics
        WHERE ${where} GROUP BY ${dayExpr} ORDER BY day ASC`,
      args,
    }),
    client.execute({
      sql: `SELECT ${hourExpr} AS peak_hour FROM analytics
        WHERE ${where} GROUP BY ${hourExpr} ORDER BY COUNT(*) DESC LIMIT 1`,
      args,
    }),
  ])

  const summary = summaryResult.rows[0] as unknown as {
    total: number
    unique_visitors: number
    qr: number
    direct: number
  } | undefined
  const clicksByDay = new Map(timelineResult.rows.map((item) => {
    const point = item as unknown as { day: string; n: number }
    return [String(point.day), Number(point.n)] as const
  }))
  const peak = peakResult.rows[0] as unknown as { peak_hour: string | number } | undefined

  return c.json({
    total: Number(summary?.total ?? 0),
    unique: Number(summary?.unique_visitors ?? 0),
    qr: Number(summary?.qr ?? 0),
    direct: Number(summary?.direct ?? 0),
    timeline: manilaDaySpan(range, now).map((day) => ({
      day,
      clicks: clicksByDay.get(day) ?? 0,
    })),
    topReferrers: referrerResult.rows.map((item) => {
      const ranked = item as unknown as { referrer: string; n: number }
      return { referrer: String(ranked.referrer), count: Number(ranked.n) }
    }),
    topCountries: countryResult.rows.map((item) => {
      const ranked = item as unknown as { country: string; n: number }
      return { country: String(ranked.country), count: Number(ranked.n) }
    }),
    topOs: osResult.rows.map((item) => {
      const ranked = item as unknown as { os: string; n: number }
      return { os: String(ranked.os), count: Number(ranked.n) }
    }),
    peakHour: peak ? Number(peak.peak_hour) : null,
  })
})

app.get('/api/links/:id/analytics.csv', requireAuth, async (c) => {
  const row = await loadOwned(c, c.req.param('id'))
  if (!row) return fail(c, 404, 'not_found', 'Not found')
  const result = await db(c).execute({
    sql: `SELECT created_at, country, os, referrer, source
      FROM analytics WHERE link_id = ? ORDER BY created_at ASC, id ASC`,
    args: [row.id],
  })
  const rows: string[][] = [['timestamp', 'country', 'os', 'referrer', 'source']]
  for (const item of result.rows) {
    const click = item as unknown as Record<string, unknown>
    rows.push([
      click.created_at ? manilaTimestamp(String(click.created_at)) : '',
      text(click.country) ?? '',
      text(click.os) ?? '',
      text(click.referrer) ?? '',
      text(click.source) ?? '',
    ])
  }
  return csvResponse(toCsv(rows), 'analytics.csv')
})

app.get('/api/links/:id', requireAuth, async (c) => {
  const row = await loadOwned(c, c.req.param('id'))
  if (!row) return fail(c, 404, 'not_found', 'Not found')
  return c.json(toDetail(row))
})

app.post('/api/links', requireAuth, requireConsent, async (c) => {
  const body = await readBody(c)
  if (body instanceof Response) return body

  if (typeof body.url !== 'string') {
    return fail(c, 422, 'invalid', 'Check the highlighted fields.', { url: 'Enter a destination URL.' })
  }
  const destination = validateDestination(body.url, { selfHosts: SELF_HOSTS })
  if (!destination.ok) {
    return fail(c, 422, destination.code, destinationMessage(destination.code), {
      url: destinationMessage(destination.code),
    })
  }

  let customSlug: string | null = null
  if (body.slug != null && body.slug !== '') {
    if (typeof body.slug !== 'string') {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { slug: slugMessage('invalid') })
    }
    customSlug = normalizeSlugInput(body.slug)
    const verdict = validateSlug(customSlug)
    if (verdict !== 'ok') {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { slug: slugMessage(verdict) })
    }
  }

  let expiresAt: string | null = null
  if (body.expiresAt != null && body.expiresAt !== '') {
    if (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt))) {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { expiresAt: 'Enter a valid date.' })
    }
    expiresAt = sqlNow(new Date(body.expiresAt))
  }

  let passwordHash: string | null = null
  if (body.password != null && body.password !== '') {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', {
        password: 'Use 8 to 128 characters.',
      })
    }
    passwordHash = await hashLinkPassword(body.password)
  }

  const prepared = prepareQrConfigForSave(parseLinkQrConfig(body.qrConfig ?? null))
  const client = db(c)
  const counted = await client.execute({
    sql: 'SELECT COUNT(*) AS n FROM links WHERE user_id = ?',
    args: [c.var.userId],
  })
  if (Number(counted.rows[0]?.n ?? 0) >= LINK_QUOTA) {
    return fail(c, 429, 'quota_exceeded', "You've reached 500 links. Delete some to add more.")
  }

  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'create',
    subject: c.var.userId,
    limit: CREATE_LIMIT,
    windowSec: HOUR_SEC,
  })
  if (!decision.ok) return tooMany(c, decision.retryAfter)

  const blocked = await rejectUnsafeDestination(c, destination.url)
  if (blocked) return blocked

  if (customSlug) {
    const existing = await loadBySlug(c, customSlug)
    if (existing) return fail(c, 409, 'slug_taken', 'That slug is taken.')
  }

  const id = crypto.randomUUID()
  let logoWrite: LogoWrite
  try {
    logoWrite = await writeQrLogo(c, id, prepared.config, null)
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(c, err.status as ContentfulStatusCode, err.code, err.message)
    }
    throw err
  }
  const qrConfig = logoWrite.qrConfig

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = customSlug ?? generateSlug()
    if (!customSlug && validateSlug(slug) !== 'ok') continue
    const row: LinkRow = {
      id,
      slug,
      original_url: destination.url,
      clicks: 0,
      created_at: sqlNow(),
      expires_at: expiresAt,
      disabled_at: null,
      disabled_reason: null,
      password_hash: passwordHash,
      qr_config: qrConfig,
    }
    await c.env.LINKS_KV.put(slug, kvValue(row))
    let inserted = false
    try {
      await client.execute({
        sql: `INSERT INTO links
          (id, user_id, original_url, slug, expires_at, password_hash, qr_config, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, c.var.userId, destination.url, slug, expiresAt, passwordHash, qrConfig, row.created_at],
      })
      inserted = true
      const saved = await loadOwned(c, id)
      return c.json(toDetail(saved ?? row), 201)
    } catch (err) {
      if (isSlugConflict(err)) {
        await restoreEdge(c, slug)
        if (customSlug) {
          await discardLogo(c, logoWrite.uploadedKey)
          return fail(c, 409, 'slug_taken', 'That slug is taken.')
        }
        continue
      }
      if (!inserted) {
        await deleteKvKey(c.env.LINKS_KV, slug).catch(() => {})
        await discardLogo(c, logoWrite.uploadedKey)
      }
      throw err
    }
  }
  await discardLogo(c, logoWrite.uploadedKey)
  throw new Error('Could not allocate a slug')
})

app.post('/api/links/bulk', requireAuth, requireConsent, async (c) => {
  const limited = await enforceEditLimit(c)
  if (limited) return limited
  const body = await readBody(c)
  if (body instanceof Response) return body
  const action = body.action
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
  if ((action !== 'delete' && action !== 'disable' && action !== 'enable') || ids.length === 0 || ids.length > 100) {
    return fail(c, 422, 'invalid', 'Check the highlighted fields.', {
      ids: 'Choose up to 100 links.',
    })
  }

  const placeholders = ids.map(() => '?').join(', ')
  const found = await db(c).execute({
    sql: `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? AND id IN (${placeholders})`,
    args: [c.var.userId, ...ids],
  })
  const rows = found.rows.map((row) => mapRow(row as unknown as Record<string, unknown>))
  if (action === 'enable' && rows.some((row) => row.disabled_reason === 'admin' || row.disabled_reason === 'abuse')) {
    return fail(c, 403, 'moderator_disabled', 'A moderator disabled this link.')
  }

  const now = sqlNow()
  for (const row of rows) {
    if (action === 'delete') {
      await db(c).execute({
        sql: 'DELETE FROM links WHERE id = ? AND user_id = ?',
        args: [row.id, c.var.userId],
      })
      await deleteKvKey(c.env.LINKS_KV, row.slug)
      continue
    }
    if (action === 'disable') {
      const reason = row.disabled_reason === 'admin' || row.disabled_reason === 'abuse' ? row.disabled_reason : 'owner'
      await db(c).execute({
        sql: `UPDATE links SET disabled_at = COALESCE(disabled_at, ?), disabled_reason = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        args: [now, reason, now, row.id, c.var.userId],
      })
      await deleteKvKey(c.env.LINKS_KV, row.slug)
      continue
    }
    const enabled = { ...row, disabled_at: null, disabled_reason: null }
    await c.env.LINKS_KV.put(row.slug, kvValue(enabled))
    await db(c).execute({
      sql: `UPDATE links SET disabled_at = NULL, disabled_reason = NULL, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      args: [now, row.id, c.var.userId],
    })
  }
  return c.json({ ok: true })
})

app.post('/api/links/:slug/unlock', async (c) => {
  const slug = normalizeSlugInput(c.req.param('slug'))
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'unlock',
    subject: `${ip}:${slug}`,
    limit: UNLOCK_LIMIT,
    windowSec: UNLOCK_WINDOW_SEC,
  })
  if (!decision.ok) return tooMany(c, decision.retryAfter, 'Too many attempts. Wait a few minutes and try again.')

  const body = await readBody(c)
  if (body instanceof Response) return body
  const password = typeof body.password === 'string' ? body.password : ''
  const row = await loadBySlug(c, slug)
  if (!row || row.disabled_at || !row.password_hash) return fail(c, 404, 'not_found', 'Not found')
  if (isExpired(row.expires_at)) return fail(c, 410, 'link_expired', 'This link has expired.')
  const matches = password.length >= 8 && password.length <= 128
    && await verifyLinkPassword(password, row.password_hash)
  if (!matches) return fail(c, 401, 'wrong_password', 'That password is wrong.')

  await recordClick(c, row.id, undefined, requestSource(c.req.query('src')))
  return c.json({ url: row.original_url })
})

app.put('/api/links/:id/qr-logo', requireAuth, requireConsent, async (c) => {
  const limited = await enforceEditLimit(c)
  if (limited) return limited
  const current = await loadOwned(c, c.req.param('id'))
  if (!current) return fail(c, 404, 'not_found', 'Not found')

  const body = await readBody(c)
  if (body instanceof Response) return body
  const imageData = body.imageData
  const clearing = imageData === null
  if (!clearing && (typeof imageData !== 'string' || !imageData.trim().toLowerCase().startsWith('data:'))) {
    return fail(c, 422, 'invalid_image', 'Use a PNG image.', { imageData: 'Use a PNG image.' })
  }

  const config = parseLinkQrConfig(current.qr_config)
  config.logoDataUrl = typeof imageData === 'string' ? imageData : null
  let logoWrite: LogoWrite
  try {
    logoWrite = await writeQrLogo(c, current.id, config, current.qr_config)
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(c, err.status as ContentfulStatusCode, err.code, err.message, {
        imageData: err.message,
      })
    }
    throw err
  }

  const key = clearing ? null : readLogoKey(logoWrite.qrConfig)
  if (!clearing && !key) {
    await discardLogo(c, logoWrite.uploadedKey)
    return fail(c, 422, 'invalid_image', 'Use a PNG image.', { imageData: 'Use a PNG image.' })
  }

  try {
    const updated = await db(c).execute({
      sql: 'UPDATE links SET qr_config = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      args: [logoWrite.qrConfig, sqlNow(), current.id, c.var.userId],
    })
    if (updated.rowsAffected === 0) {
      await discardLogo(c, logoWrite.uploadedKey)
      return fail(c, 404, 'not_found', 'Not found')
    }
  } catch (err) {
    await discardLogo(c, logoWrite.uploadedKey)
    throw err
  }

  await discardLogo(c, logoWrite.deleteKey)
  if (clearing || !key) return c.json({ url: null, logo: null })
  return c.json({ url: mediaUrl(key), logo: { key } })
})

app.patch('/api/links/:id', requireAuth, requireConsent, async (c) => {
  const limited = await enforceEditLimit(c)
  if (limited) return limited
  const body = await readBody(c)
  if (body instanceof Response) return body
  const current = await loadOwned(c, c.req.param('id'))
  if (!current) return fail(c, 404, 'not_found', 'Not found')

  if (body.disabled === false && (current.disabled_reason === 'admin' || current.disabled_reason === 'abuse')) {
    return fail(c, 403, 'moderator_disabled', 'A moderator disabled this link.')
  }

  let url = current.original_url
  if ('url' in body) {
    if (typeof body.url !== 'string') {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { url: 'Enter a destination URL.' })
    }
    const destination = validateDestination(body.url, { selfHosts: SELF_HOSTS })
    if (!destination.ok) {
      return fail(c, 422, destination.code, destinationMessage(destination.code), {
        url: destinationMessage(destination.code),
      })
    }
    url = destination.url
    const blocked = await rejectUnsafeDestination(c, url)
    if (blocked) return blocked
  }

  let slug = current.slug
  if ('slug' in body && body.slug != null && body.slug !== '') {
    if (typeof body.slug !== 'string') {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { slug: slugMessage('invalid') })
    }
    slug = normalizeSlugInput(body.slug)
    const verdict = validateSlug(slug)
    if (verdict !== 'ok') {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { slug: slugMessage(verdict) })
    }
    if (slug !== current.slug) {
      const taken = await loadBySlug(c, slug)
      if (taken && taken.id !== current.id) return fail(c, 409, 'slug_taken', 'That slug is taken.')
    }
  }

  let expiresAt = current.expires_at
  if ('expiresAt' in body) {
    if (body.expiresAt == null || body.expiresAt === '') {
      expiresAt = null
    } else if (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt))) {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { expiresAt: 'Enter a valid date.' })
    } else {
      expiresAt = sqlNow(new Date(body.expiresAt))
    }
  }

  let passwordHash = current.password_hash
  if ('password' in body) {
    if (body.password == null || body.password === '') {
      passwordHash = null
    } else if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      return fail(c, 422, 'invalid', 'Check the highlighted fields.', { password: 'Use 8 to 128 characters.' })
    } else {
      passwordHash = await hashLinkPassword(body.password)
    }
  }

  let qrConfig = current.qr_config
  let logoWrite: LogoWrite | null = null
  if ('qrConfig' in body) {
    const prepared = prepareQrConfigForSave(parseLinkQrConfig(body.qrConfig))
    try {
      logoWrite = await writeQrLogo(c, current.id, prepared.config, current.qr_config)
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(c, err.status as ContentfulStatusCode, err.code, err.message)
      }
      throw err
    }
    qrConfig = logoWrite.qrConfig
  }

  // The loaded disabled_* values may be stale by the time we write. The UPDATE
  // never writes them from memory: an owner disable only fills an empty state,
  // and an owner enable only clears a disable the owner made.
  const now = sqlNow()
  let disabledSql = ''
  const disabledArgs: string[] = []
  if (body.disabled === true) {
    disabledSql = `, disabled_at = COALESCE(disabled_at, ?), disabled_reason = COALESCE(disabled_reason, 'owner')`
    disabledArgs.push(now)
  } else if (body.disabled === false) {
    const ownerOnly = `COALESCE(disabled_reason, '') NOT IN ('admin', 'abuse')`
    disabledSql = `, disabled_at = CASE WHEN ${ownerOnly} THEN NULL ELSE disabled_at END,
            disabled_reason = CASE WHEN ${ownerOnly} THEN NULL ELSE disabled_reason END`
  }
  try {
    const updated = await db(c).execute({
      sql: `UPDATE links
        SET original_url = ?, slug = ?, expires_at = ?, password_hash = ?, qr_config = ?,
            updated_at = ?${disabledSql}
        WHERE id = ? AND user_id = ?`,
      args: [url, slug, expiresAt, passwordHash, qrConfig, now, ...disabledArgs, current.id, c.var.userId],
    })
    if (updated.rowsAffected === 0) {
      await discardLogo(c, logoWrite?.uploadedKey ?? null)
      return fail(c, 404, 'not_found', 'Not found')
    }
  } catch (err) {
    await discardLogo(c, logoWrite?.uploadedKey ?? null)
    if (isSlugConflict(err)) return fail(c, 409, 'slug_taken', 'That slug is taken.')
    throw err
  }
  await discardLogo(c, logoWrite?.deleteKey ?? null)

  // Decide the edge key from the row as written, then re-check once so a
  // disable that lands between the read and the put never leaves a live key.
  let saved = await loadOwned(c, current.id)
  if (slug !== current.slug) await deleteKvKey(c.env.LINKS_KV, current.slug)
  if (saved && !saved.disabled_at) {
    await c.env.LINKS_KV.put(slug, kvValue(saved))
    saved = await loadOwned(c, current.id)
    if (!saved || saved.disabled_at) await deleteKvKey(c.env.LINKS_KV, slug)
  } else {
    await deleteKvKey(c.env.LINKS_KV, slug)
  }
  return c.json(toDetail(saved ?? current))
})

app.delete('/api/links/:id', requireAuth, requireConsent, async (c) => {
  const limited = await enforceEditLimit(c)
  if (limited) return limited
  const row = await loadOwned(c, c.req.param('id'))
  if (!row) return fail(c, 404, 'not_found', 'Not found')
  const deleted = await db(c).execute({
    sql: 'DELETE FROM links WHERE id = ? AND user_id = ?',
    args: [row.id, c.var.userId],
  })
  if (deleted.rowsAffected === 0) return fail(c, 404, 'not_found', 'Not found')
  await deleteKvKey(c.env.LINKS_KV, row.slug)
  return c.json({ ok: true })
})

export default app
