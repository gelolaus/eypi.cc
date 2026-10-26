import { Hono } from 'hono'
import {
  FORM_CATALOG,
  TEMPLATE_ALLOWLIST,
  TEMPLATE_MISSING_CODE,
  TEMPLATE_MISSING_MESSAGE,
} from '../../../shared/formsCatalog'
import type { Bindings } from '../lib/db'
import { isOrgFeature } from '../middleware/orgGuard'
import { noOrgBody } from '../middleware/orgContext'

const app = new Hono<{ Bindings: Bindings }>()

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PRIVATE_CACHE = 'private, max-age=3600'

const NOT_FOUND = { error: { code: 'not_found', message: 'Not found' } }
const TEMPLATE_MISSING = {
  error: { code: TEMPLATE_MISSING_CODE, message: TEMPLATE_MISSING_MESSAGE },
}

function quotedEtag(value: string): string {
  return value.startsWith('"') ? value : `"${value}"`
}

async function hashEtag(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
  return `"${hex}"`
}

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  return header.split(',').some((part) => part.trim() === etag)
}

app.get('/api/forms', isOrgFeature, (c) => {
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)
  return c.json({ status: 'ok', orgId, forms: FORM_CATALOG })
})

app.get('/api/forms/templates/:filename', isOrgFeature, async (c) => {
  const orgId = c.var.orgId
  if (!orgId) return c.json(noOrgBody(), 403)
  const filename = c.req.param('filename')
  if (!filename || !TEMPLATE_ALLOWLIST.has(filename)) {
    return c.json(NOT_FOUND, 404)
  }

  const object = await c.env.MEDIA.get(`templates/${filename}`)
  if (!object) return c.json(TEMPLATE_MISSING, 404)

  const httpEtag = object.httpEtag
  const rawEtag = object.etag
  let etag = httpEtag || (rawEtag ? quotedEtag(rawEtag) : '')
  let bytes: ArrayBuffer | null = null
  if (!etag) {
    bytes = await object.arrayBuffer()
    etag = await hashEtag(bytes)
  }

  const headers = {
    'Content-Type': DOCX_TYPE,
    'Cache-Control': PRIVATE_CACHE,
    ETag: etag,
  }
  if (etagMatches(c.req.header('If-None-Match'), etag)) {
    return new Response(null, { status: 304, headers })
  }
  if (!bytes) bytes = await object.arrayBuffer()
  return new Response(bytes, { status: 200, headers })
})

export default app
