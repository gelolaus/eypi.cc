import { Hono } from 'hono'
import { db, type Bindings } from '../lib/db'
import { attachSession } from '../middleware/requireAuth'
import { hmacIp } from '../lib/ipHash'
import { checkRateLimit } from '../lib/rateLimit'

const REASONS = new Set(['phishing', 'malware', 'spam', 'inappropriate', 'other'])

const app = new Hono<{ Bindings: Bindings }>()

function invalid(fields: Record<string, string>) {
  return {
    error: {
      code: 'invalid',
      message: 'Check the highlighted fields.',
      fields,
    },
  } as const
}

app.post('/api/reports', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(invalid({ reason: 'Choose a valid reason.' }), 422)
  }

  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const reason = typeof record.reason === 'string' ? record.reason : ''
  const details = typeof record.details === 'string' ? record.details : undefined
  const slug = typeof record.slug === 'string' ? record.slug.trim() : ''

  const fields: Record<string, string> = {}
  if (!REASONS.has(reason)) fields.reason = 'Choose a valid reason.'
  if (details !== undefined && details.length > 1000) {
    fields.details = 'Keep details to 1000 characters.'
  }
  if (Object.keys(fields).length > 0) return c.json(invalid(fields), 422)

  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const secret = c.env.IP_HASH_SECRET?.trim()
  const reporterIpHash = secret ? await hmacIp(secret, ip) : null
  const allowed = await checkRateLimit(
    c.env.RATE_LIMIT_KV,
    `rl:report:${reporterIpHash ?? ip}`,
    5,
    3600,
  )
  if (!allowed) {
    return c.json({ error: { code: 'too_many', message: 'Too many requests. Try again later.' } }, 429)
  }

  const client = db(c)
  const found = await client.execute({
    sql: 'SELECT id FROM links WHERE slug = ? LIMIT 1',
    args: [slug],
  })
  if (found.rows.length === 0) {
    return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  }
  const unavailable = await attachSession(c)
  if (unavailable) return unavailable
  const id = crypto.randomUUID()

  await client.execute({
    sql: `INSERT INTO link_reports
      (id, link_id, slug, reason, details, reporter_ip_hash, reporter_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      String(found.rows[0].id),
      slug,
      reason,
      details ?? null,
      reporterIpHash,
      c.var.user?.id ?? null,
    ],
  })

  return c.json({ id }, 201)
})

export default app
