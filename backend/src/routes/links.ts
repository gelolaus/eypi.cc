import { Hono } from 'hono'
import { createClient } from '@libsql/client/web'
import type { Bindings } from '../lib/db'
import { requireAuth } from '../middleware/requireAuth'
import { validateDestinationUrl } from '../lib/validateDestinationUrl'
import { isReservedSlug } from '../../../shared/reservedSlugs'
import { logLinkClick, sanitizeReferrer } from '../../../shared/linkAnalytics'
import { encodeLinkKvEntry } from '../../../shared/linksKv'
import {
  parseLinkQrConfig,
  prepareQrConfigForSave,
  serializeLinkQrConfig,
  type LinkQrConfig,
} from '../../../shared/linkQrConfig'

const app = new Hono<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>()

const generateSlug = () => Math.random().toString(36).substring(2, 8)

const normalizeUrl = (url: string) => {
  let trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`
  return trimmed
}

// Link Routes (require JWT)
app.get('/api/links', requireAuth, async (c) => {
  try {
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'SELECT id, original_url, slug, clicks, qr_config FROM links WHERE user_id = ? ORDER BY created_at DESC',
      args: [c.var.userId],
    })
    const links = result.rows.map((row) => {
      const r = row as unknown as {
        id: string
        original_url: string
        slug: string
        clicks?: number
        qr_config?: string | null
      }
      return {
        id: r.id,
        original: r.original_url,
        short: `eypi.cc/${r.slug}`,
        clicks: r.clicks ?? 0,
        qrConfig: parseLinkQrConfig(r.qr_config),
      }
    })
    return c.json({ status: 'success', links })
  } catch {
    return c.json({ error: 'Unauthorized', message: 'Invalid session' }, 401)
  }
})

// Analytics aggregation (auth required, must be placed before :slug route)
app.get('/api/links/:id/analytics', requireAuth, async (c) => {
  const id = c.req.param('id')
  try {
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const ownership = await db.execute({
      sql: 'SELECT id FROM links WHERE id = ? AND user_id = ?',
      args: [id, c.var.userId],
    })
    if (ownership.rows.length === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    const [osResult, countryResult, referrerResult, timelineResult, peakResult] = await Promise.all([
      db.execute({
        sql: 'SELECT os, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY os',
        args: [id],
      }),
      db.execute({
        sql: 'SELECT country, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY country',
        args: [id],
      }),
      db.execute({
        sql: 'SELECT referrer, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY referrer',
        args: [id],
      }),
      db.execute({
        sql: "SELECT DATE(created_at) as date, COUNT(*) as count FROM analytics WHERE link_id = ? AND created_at >= date('now', '-30 days') GROUP BY DATE(created_at) ORDER BY date ASC",
        args: [id],
      }),
      db.execute({
        sql: "SELECT strftime('%w', datetime(created_at, '+8 hours')) as peakDay, strftime('%H', datetime(created_at, '+8 hours')) as peakHour, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY strftime('%w', datetime(created_at, '+8 hours')), strftime('%H', datetime(created_at, '+8 hours')) ORDER BY count DESC LIMIT 1",
        args: [id],
      }),
    ])
    const os = osResult.rows.map((r) => {
      const row = r as unknown as { os: string; count: number }
      return { os: row.os, count: row.count }
    })
    const country = countryResult.rows.map((r) => {
      const row = r as unknown as { country: string; count: number }
      return { country: row.country, count: row.count }
    })
    const referrer = referrerResult.rows.map((r) => {
      const row = r as unknown as { referrer: string; count: number }
      return { referrer: row.referrer, count: row.count }
    })
    const timeline = timelineResult.rows.map((r) => {
      const row = r as unknown as { date: string; count: number }
      return { date: row.date, count: row.count }
    })
    const peakEngagement =
      peakResult.rows.length > 0
        ? (peakResult.rows[0] as unknown as { peakDay: string; peakHour: string; count: number })
        : null
    return c.json({ os, country, referrer, timeline, peakEngagement })
  } catch {
    return c.json({ error: 'Unauthorized', message: 'Invalid session' }, 401)
  }
})

// Public redirect lookup (no auth required) — SPA fallback when edge KV misses
app.get('/api/links/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  })
  const result = await db.execute({
    sql: 'SELECT id, original_url FROM links WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) return c.json({ error: 'Not Found' }, 404)

  const row = result.rows[0] as unknown as { id: string; original_url: string }
  const userAgent = c.req.header('User-Agent')
  const referrer = sanitizeReferrer(c.req.header('X-Client-Referrer') || c.req.header('Referer'))
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? 'Unknown'

  try {
    c.executionCtx?.waitUntil(
      logLinkClick(db, {
        linkId: row.id,
        slug,
        userAgent: userAgent ?? null,
        referrer,
        country,
      })
    )
  } catch {
    // executionCtx not available (e.g. local dev / non-CF runtime)
  }

  return c.json({ original_url: row.original_url })
})

app.put('/api/links/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  try {
    const body = await c.req.json() as {
      original_url?: string
      slug?: string
      qr_config?: LinkQrConfig | null
    }
    const { original_url, slug } = body
    if (!original_url || typeof original_url !== 'string' || !slug || typeof slug !== 'string') {
      return c.json({ error: 'original_url and slug are required' }, 400)
    }
    if (isReservedSlug(slug)) {
      return c.json({ error: 'That slug is reserved by the eypi.cc suite. Choose another.' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    if (!validateDestinationUrl(normalizedUrl)) {
      return c.json({ error: 'Destination URL is not allowed.' }, 400)
    }
    const normalizedSlug = slug.toLowerCase()
    const prepared = prepareQrConfigForSave(parseLinkQrConfig(body.qr_config ?? null))
    const qrConfigJson = serializeLinkQrConfig(prepared.config)

    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const existing = await db.execute({
      sql: 'SELECT slug FROM links WHERE id = ? AND user_id = ?',
      args: [id, c.var.userId],
    })
    if (existing.rows.length === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    const oldSlug = (existing.rows[0] as unknown as { slug: string }).slug.toLowerCase()

    const result = await db.execute({
      sql: 'UPDATE links SET original_url = ?, slug = ?, qr_config = ? WHERE id = ? AND user_id = ?',
      args: [normalizedUrl, normalizedSlug, qrConfigJson, id, c.var.userId],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }

    try {
      await c.env.LINKS_KV.put(
        normalizedSlug,
        encodeLinkKvEntry({ id, url: normalizedUrl }),
      )
      if (oldSlug !== normalizedSlug) {
        await c.env.LINKS_KV.delete(oldSlug)
      }
    } catch {
      return c.json({ error: 'Link updated in database but edge cache sync failed.' }, 500)
    }

    return c.json({
      status: 'success',
      message: 'Link updated.',
      logoOmitted: prepared.logoOmitted,
      qrConfig: prepared.config,
    })
  } catch {
    return c.json({ error: 'Update failed' }, 400)
  }
})

app.delete('/api/links/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  try {
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const existing = await db.execute({
      sql: 'SELECT slug FROM links WHERE id = ? AND user_id = ?',
      args: [id, c.var.userId],
    })
    if (existing.rows.length === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    const slug = (existing.rows[0] as unknown as { slug: string }).slug.toLowerCase()

    const result = await db.execute({
      sql: 'DELETE FROM links WHERE id = ? AND user_id = ?',
      args: [id, c.var.userId],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }

    try {
      await c.env.LINKS_KV.delete(slug)
    } catch {
      // DB row is gone; stale KV entry may redirect briefly until manual cleanup
    }

    return c.json({ status: 'success', message: 'Link deleted.' })
  } catch {
    return c.json({ error: 'Delete failed' }, 400)
  }
})

app.post('/api/links', requireAuth, async (c) => {
  try {
    const { original_url } = await c.req.json() as { original_url?: string }
    if (!original_url || typeof original_url !== 'string') {
      return c.json({ error: 'original_url is required' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    if (!validateDestinationUrl(normalizedUrl)) {
      return c.json({ error: 'Destination URL is not allowed.' }, 400)
    }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    let slug = generateSlug()
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!isReservedSlug(slug)) {
        const existing = await db.execute({ sql: 'SELECT slug FROM links WHERE slug = ?', args: [slug] })
        if (existing.rows.length === 0) break
      }
      slug = generateSlug()
    }
    const linkId = crypto.randomUUID()
    await db.execute({
      sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
      args: [linkId, c.var.userId, normalizedUrl, slug],
    })

    try {
      await c.env.LINKS_KV.put(
        slug.toLowerCase(),
        encodeLinkKvEntry({ id: linkId, url: normalizedUrl }),
      )
    } catch {
      return c.json({ error: 'Link created in database but edge cache sync failed.' }, 500)
    }

    return c.json({ status: 'success', link: { slug, original_url: normalizedUrl } })
  } catch {
    return c.json({ error: 'Invalid Session' }, 401)
  }
})

export default app
