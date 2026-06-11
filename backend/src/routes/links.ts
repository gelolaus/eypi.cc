import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { createClient } from '@libsql/client/web'
import type { Bindings } from '../lib/db'

const app = new Hono<{ Bindings: Bindings }>()

const generateSlug = () => Math.random().toString(36).substring(2, 8)

const normalizeUrl = (url: string) => {
  let trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`
  return trimmed
}

// Reserved slugs that collide with first-level suite routes. A short link can
// never use one of these, or it would shadow a real page in the SPA router.
const RESERVED_SLUGS = new Set([
  'dashboard', 'links', 'forms', 'event', 'events', 'manage', 'login',
  'settings', 'verify', 'reset-password', 'privacy', 'terms', 'contact',
  'api', 'home',
])
const isReservedSlug = (slug: string) => RESERVED_SLUGS.has(slug.toLowerCase())

const REFERRER_MAP: Record<string, string> = {
  // Own properties
  'localhost': 'Localhost',
  'eypi.cc': 'Eypi',
  // Facebook
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  'fb.com': 'Facebook',
  'web.facebook.com': 'Facebook',
  // Instagram
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  // Twitter / X
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  // TikTok
  'tiktok.com': 'TikTok',
  'vm.tiktok.com': 'TikTok',
  'vt.tiktok.com': 'TikTok',
  // YouTube
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'm.youtube.com': 'YouTube',
  // Reddit
  'reddit.com': 'Reddit',
  'redd.it': 'Reddit',
  'old.reddit.com': 'Reddit',
  // LinkedIn
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  // Pinterest
  'pinterest.com': 'Pinterest',
  'pin.it': 'Pinterest',
  'pinterest.ph': 'Pinterest',
  // Snapchat
  'snapchat.com': 'Snapchat',
  't.snapchat.com': 'Snapchat',
  // WhatsApp
  'whatsapp.com': 'WhatsApp',
  'wa.me': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  // Telegram
  'telegram.org': 'Telegram',
  't.me': 'Telegram',
  'web.telegram.org': 'Telegram',
  // Discord
  'discord.com': 'Discord',
  'discord.gg': 'Discord',
  'ptb.discord.com': 'Discord',
  // Threads
  'threads.net': 'Threads',
  'l.threads.net': 'Threads',
  // Google
  'google.com': 'Google',
  'google.com.ph': 'Google',
  'google.co': 'Google',
  // Gmail
  'mail.google.com': 'Gmail',
  // Viber
  'viber.com': 'Viber',
  // Twitch
  'twitch.tv': 'Twitch',
  // GitHub
  'github.com': 'GitHub',
  // Medium
  'medium.com': 'Medium',
  // Substack
  'substack.com': 'Substack',
  // Notion
  'notion.so': 'Notion',
  'notion.site': 'Notion',
  // Bereal
  'bere.al': 'BeReal',
  'bereal.com': 'BeReal',
}

function sanitizeReferrer(raw: string | undefined): string {
  if (!raw) return 'Direct'
  try {
    // Handle bare hostnames (no protocol) by prepending https://
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const hostname = new URL(url).hostname.toLowerCase()
    if (REFERRER_MAP[hostname]) return REFERRER_MAP[hostname]
    const withoutWww = hostname.replace(/^www\./, '')
    if (REFERRER_MAP[withoutWww]) return REFERRER_MAP[withoutWww]
    // Check if it's localhost with a port (e.g. localhost:5173)
    if (withoutWww.startsWith('localhost')) return 'Localhost'
    return withoutWww || 'Direct'
  } catch {
    return 'Direct'
  }
}

function getOS(userAgent: string | null): string {
  if (!userAgent) return 'Unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('win')) return 'Windows'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
  if (ua.includes('mac')) return 'macOS'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('linux')) return 'Linux'
  return 'Unknown'
}

// Link Routes (require JWT)
app.get('/api/links', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  }
  const token = authHeader.split(' ')[1]
  if (!token) return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'SELECT id, original_url, slug, clicks FROM links WHERE user_id = ? ORDER BY created_at DESC',
      args: [payload.sub],
    })
    const links = result.rows.map((row) => {
      const r = row as unknown as { id: string; original_url: string; slug: string; clicks?: number }
      return {
        id: r.id,
        original: r.original_url,
        short: `eypi.cc/${r.slug}`,
        clicks: r.clicks ?? 0,
      }
    })
    return c.json({ status: 'success', links })
  } catch {
    return c.json({ error: 'Unauthorized', message: 'Invalid session' }, 401)
  }
})

// Analytics aggregation (auth required, must be placed before :slug route)
app.get('/api/links/:id/analytics', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  }
  const token = authHeader.split(' ')[1]
  if (!token) return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const ownership = await db.execute({
      sql: 'SELECT id FROM links WHERE id = ? AND user_id = ?',
      args: [id, payload.sub],
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

// Public redirect lookup (no auth required)
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
  const os = getOS(userAgent ?? null)
  const linkId = row.id

  try {
    c.executionCtx?.waitUntil(
      Promise.all([
        db.execute({
          sql: 'INSERT INTO analytics (link_id, os, country, referrer) VALUES (?, ?, ?, ?)',
          args: [linkId, os, country, referrer],
        }),
        db.execute({
          sql: 'UPDATE links SET clicks = COALESCE(clicks, 0) + 1 WHERE slug = ?',
          args: [slug],
        }),
      ])
    )
  } catch {
    // executionCtx not available (e.g. local dev / non-CF runtime)
  }

  return c.json({ original_url: row.original_url })
})

app.put('/api/links/:id', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const { original_url, slug } = await c.req.json() as { original_url?: string; slug?: string }
    if (!original_url || typeof original_url !== 'string' || !slug || typeof slug !== 'string') {
      return c.json({ error: 'original_url and slug are required' }, 400)
    }
    if (isReservedSlug(slug)) {
      return c.json({ error: 'That slug is reserved by the eypi.cc suite. Choose another.' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'UPDATE links SET original_url = ?, slug = ? WHERE id = ? AND user_id = ?',
      args: [normalizedUrl, slug.toLowerCase(), id, payload.sub],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    return c.json({ status: 'success', message: 'Link updated.' })
  } catch {
    return c.json({ error: 'Update failed' }, 400)
  }
})

app.delete('/api/links/:id', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'DELETE FROM links WHERE id = ? AND user_id = ?',
      args: [id, payload.sub],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    return c.json({ status: 'success', message: 'Link deleted.' })
  } catch {
    return c.json({ error: 'Delete failed' }, 400)
  }
})

app.post('/api/links', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const { original_url } = await c.req.json() as { original_url?: string }
    if (!original_url || typeof original_url !== 'string') {
      return c.json({ error: 'original_url is required' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    let slug = generateSlug()
    for (let attempt = 0; attempt < 10; attempt++) {
      // Skip reserved words and collisions so an auto-generated slug never
      // shadows a suite route.
      if (!isReservedSlug(slug)) {
        const existing = await db.execute({ sql: 'SELECT slug FROM links WHERE slug = ?', args: [slug] })
        if (existing.rows.length === 0) break
      }
      slug = generateSlug()
    }
    const linkId = crypto.randomUUID()
    await db.execute({
      sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
      args: [linkId, payload.sub, normalizedUrl, slug],
    })
    return c.json({ status: 'success', link: { slug, original_url: normalizedUrl } })
  } catch {
    return c.json({ error: 'Invalid Session' }, 401)
  }
})

export default app
