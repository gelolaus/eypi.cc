import { Hono } from 'hono'
import { isLegalDocument, LEGAL_VERSIONS, type LegalDocument } from '../../../shared/legalVersions'
import { db, type Bindings } from '../lib/db'
import { hmacIp } from '../lib/ipHash'
import { requireAuth } from '../middleware/requireAuth'

const INVALID_DOCUMENT = {
  error: {
    code: 'invalid_document',
    message: 'Choose a known legal document.',
  },
} as const

const app = new Hono<{ Bindings: Bindings }>()

function documentsFrom(body: unknown): LegalDocument[] | null {
  if (!body || typeof body !== 'object' || !('documents' in body)) return null
  const documents = (body as { documents: unknown }).documents
  if (!Array.isArray(documents) || documents.length === 0) return null
  const names = documents.filter(isLegalDocument)
  if (names.length !== documents.length) return null
  return [...new Set(names)]
}

app.post('/api/legal/consent', requireAuth, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(INVALID_DOCUMENT, 400)
  }
  const documents = documentsFrom(body)
  if (!documents) return c.json(INVALID_DOCUMENT, 400)

  const userId = c.var.userId || c.var.user?.id
  if (!userId) return c.json(INVALID_DOCUMENT, 400)

  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const secret = c.env.IP_HASH_SECRET?.trim()
  const ipHash = secret ? await hmacIp(secret, ip) : null
  const userAgent = c.req.header('User-Agent') || null
  const client = db(c)
  await client.batch(
    documents.map((document) => ({
      sql: `INSERT INTO legal_consents (id, user_id, document, version, ip_hash, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, document, version) DO NOTHING`,
      args: [crypto.randomUUID(), userId, document, LEGAL_VERSIONS[document], ipHash, userAgent],
    })),
    'write',
  )
  return c.json({ ok: true })
})

export default app
