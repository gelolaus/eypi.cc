import type { Client } from '@libsql/client/web'
import type { Context, MiddlewareHandler } from 'hono'
import { LEGAL_VERSIONS } from '../../../shared/legalVersions'
import { db, type Bindings } from '../lib/db'

export const CONSENT_REQUIRED_MESSAGE = 'Accept the current privacy policy and terms to continue.'

export const CONSENT_REQUIRED_BODY = {
  error: {
    code: 'consent_required',
    message: CONSENT_REQUIRED_MESSAGE,
  },
} as const

export const CONSENT_DOCUMENTS = ['privacy', 'terms'] as const

type ConsentRow = { document: string; version: string }

export async function needsConsentList(client: Client, userId: string): Promise<ConsentRow[]> {
  const result = await client.execute({
    sql: `SELECT document FROM legal_consents
          WHERE user_id = ?
            AND ((document = 'privacy' AND version = ?) OR (document = 'terms' AND version = ?))`,
    args: [userId, LEGAL_VERSIONS.privacy, LEGAL_VERSIONS.terms],
  })
  const accepted = new Set(result.rows.map((row) => String(row.document)))
  return CONSENT_DOCUMENTS
    .filter((document) => !accepted.has(document))
    .map((document) => ({ document, version: LEGAL_VERSIONS[document] }))
}

export async function enforceConsent<E extends { Bindings: Bindings }>(
  c: Context<E>,
): Promise<Response | null> {
  const userId = c.var.userId || c.var.user?.id
  if (!userId || (await needsConsentList(db(c), userId)).length > 0) {
    return c.json(CONSENT_REQUIRED_BODY, 403)
  }
  return null
}

export const requireConsent: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const denied = await enforceConsent(c)
  if (denied) return denied
  await next()
}
