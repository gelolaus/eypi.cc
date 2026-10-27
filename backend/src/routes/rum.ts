import { Hono } from 'hono'
import { db, type Bindings } from '../lib/db'
import { ApiError, badRequest, tooMany } from '../lib/errors'
import { hmacIp } from '../lib/ipHash'
import { checkRateLimit } from '../lib/rateLimit'
import { parseRumBatch } from '../lib/rum'

const MAX_BODY_BYTES = 4096

const app = new Hono<{ Bindings: Bindings }>()

// Public, no session: navigator.sendBeacon posts text/plain.
app.post('/api/rum', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const secret = c.env.IP_HASH_SECRET?.trim()
  const subject = secret ? await hmacIp(secret, ip) : ip
  const decision = await checkRateLimit(c.env.RATE_LIMIT_KV, {
    bucket: 'rum',
    subject,
    limit: 60,
    windowSec: 60,
  })
  if (!decision.ok) throw tooMany()

  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) throw badRequest('too_large', 'That batch is too large.')

  let body: unknown
  try {
    const text = await c.req.text()
    if (text.length > MAX_BODY_BYTES) throw badRequest('too_large', 'That batch is too large.')
    body = JSON.parse(text)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw badRequest('invalid', 'Send a JSON array of samples.')
  }
  const samples = parseRumBatch(body)
  if (!samples) throw badRequest('invalid', 'Send a JSON array of samples.')

  const day = new Date().toISOString().slice(0, 10)
  await db(c).batch(
    samples.map((s) => ({
      sql: `INSERT INTO rum_samples (day, route, metric, value, rating, device, connection, nav_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [day, s.route, s.metric, s.value, s.rating, s.device, s.connection, s.navType],
    })),
    'write',
  )
  return c.body(null, 204)
})

export default app
