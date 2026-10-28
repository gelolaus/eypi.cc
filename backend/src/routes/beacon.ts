import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { db, type Bindings } from '../lib/db'
import { badRequest } from '../lib/errors'
import { visitorHash } from '../lib/ipHash'
import { manilaDay } from '../lib/manilaTime'

const MAX_BODY_BYTES = 512
const MAX_PER_HOUR = 20
const SUBJECT = /^[A-Za-z0-9_-]{1,64}(:[A-Za-z0-9_-]{1,64})?$/

const ACTIONS = {
  frames: ['view', 'photo_added', 'download', 'share'],
  org: ['view'],
} as const
type ModuleName = keyof typeof ACTIONS

const INVALID = 'Send { module, subjectId, action }.'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * Public, no session, no cookies: navigator.sendBeacon posts text/plain.
 * Well-formed bodies always get 204, whether or not the subject exists or the event was kept.
 */
// bodyLimit counts bytes and also stops a chunked body that lies about (or omits) its length.
const limitBody = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: () => {
    throw badRequest('invalid', INVALID)
  },
})

app.post('/api/beacon', limitBody, async (c) => {
  const text = await c.req.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw badRequest('invalid', INVALID)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw badRequest('invalid', INVALID)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('invalid', INVALID)
  const { module, subjectId, action } = body as Record<string, unknown>
  if (typeof module !== 'string' || !Object.hasOwn(ACTIONS, module)) throw badRequest('invalid', INVALID)
  if (typeof subjectId !== 'string' || !SUBJECT.test(subjectId)) throw badRequest('invalid', INVALID)
  if (typeof action !== 'string' || !(ACTIONS[module as ModuleName] as readonly string[]).includes(action)) {
    throw badRequest('invalid', INVALID)
  }

  // Without the secret there is no safe visitor id, so keep nothing rather than store an IP.
  const secret = c.env.IP_HASH_SECRET?.trim()
  if (!secret) return c.body(null, 204)

  const client = db(c)
  const [campaignId, frameId] = subjectId.split(':')
  let orgId: string | null = null
  if (module === 'frames') {
    const campaign = await client.execute({ sql: 'SELECT org_id FROM dp_campaigns WHERE id = ?', args: [campaignId] })
    if (campaign.rows.length === 0) return c.body(null, 204)
    if (frameId !== undefined) {
      const frame = await client.execute({
        sql: 'SELECT 1 FROM dp_frames WHERE id = ? AND campaign_id = ?',
        args: [frameId, campaignId],
      })
      if (frame.rows.length === 0) return c.body(null, 204)
    }
    orgId = (campaign.rows[0].org_id as string | null) ?? null
  } else {
    // Org profiles are addressed by org id (the public slug); only opted-in public profiles count.
    if (subjectId.includes(':')) return c.body(null, 204)
    const org = await client.execute({
      sql: 'SELECT id FROM organizations WHERE id = ? AND is_public_catalog = 1',
      args: [subjectId],
    })
    if (org.rows.length === 0) return c.body(null, 204)
    orgId = org.rows[0].id as string
  }

  const now = new Date()
  const day = manilaDay(now)
  // 'b|' keeps this hash apart from the link click hash, so a visitor cannot be joined across the two tables.
  // A visitor who changes User-Agent gets a new hash and a fresh limit; that only inflates the organizer's own numbers.
  const visitor = await visitorHash(
    secret,
    `b|${day.replace(/-/g, '')}`,
    c.req.header('CF-Connecting-IP') ?? '',
    c.req.header('User-Agent') ?? '',
  )

  // Limit per campaign (or org page), not per exact subject, so cycling through frames cannot dodge it.
  // The subject range [id:, id;) matches every 'id:frame' without LIKE ('_' is a wildcard there); ';' follows ':'.
  // The created_at bound keeps the count to the last hour (idx_module_events_visitor).
  const recent = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM module_events
          WHERE visitor_hash = ?1 AND action = ?3 AND created_at >= datetime('now', '-1 hour')
            AND (subject_id = ?2 OR (subject_id >= ?2 || ':' AND subject_id < ?2 || ';'))`,
    args: [visitor, campaignId, action],
  })
  if (Number(recent.rows[0]?.n ?? 0) >= MAX_PER_HOUR) return c.body(null, 204)

  await client.execute({
    sql: `INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [orgId, module, subjectId, action, visitor, day],
  })
  return c.body(null, 204)
})

export default app
