import { Hono } from 'hono'
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
app.post('/api/beacon', async (c) => {
  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) throw badRequest('invalid', INVALID)
  const text = await c.req.text()
  if (text.length > MAX_BODY_BYTES) throw badRequest('invalid', INVALID)

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
  const visitor = await visitorHash(
    secret,
    day.replace(/-/g, ''),
    c.req.header('CF-Connecting-IP') ?? '',
    c.req.header('User-Agent') ?? '',
  )

  const recent = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM module_events
          WHERE visitor_hash = ? AND subject_id = ? AND action = ?
            AND created_at >= datetime('now', '-1 hour')`,
    args: [visitor, subjectId, action],
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
