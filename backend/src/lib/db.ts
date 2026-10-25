import type { Context } from 'hono'
import { verify } from 'hono/jwt'
import { createClient } from '@libsql/client/web'
import type { Client } from '@libsql/client/web'

declare module 'hono' {
  interface ContextVariableMap {
    db?: Client
  }
}

export async function getUserOrgId(
  client: Client,
  userId: string,
  requestedOrgId?: string,
): Promise<string | null> {
  if (requestedOrgId) {
    const r = await client.execute({
      sql: `
        SELECT o.id AS id
        FROM organizations o
        WHERE o.id = ?
          AND (
            o.owner_id = ?
            OR EXISTS (
              SELECT 1 FROM org_members m
              WHERE m.org_id = o.id AND m.user_id = ? AND m.activated_at IS NOT NULL
            )
          )
        LIMIT 1
      `,
      args: [requestedOrgId, userId, userId],
    })
    return r.rows.length > 0 ? r.rows[0].id as string : null
  }

  const r = await client.execute({
    sql: `
      SELECT o.id AS id
      FROM organizations o
      WHERE o.owner_id = ?
         OR EXISTS (
           SELECT 1 FROM org_members m
           WHERE m.org_id = o.id AND m.user_id = ? AND m.activated_at IS NOT NULL
         )
      ORDER BY o.name
      LIMIT 1
    `,
    args: [userId, userId],
  })
  if (r.rows.length === 0) return null
  return r.rows[0].id as string
}

// Shared Cloudflare Worker bindings for the unified eypi.cc backend.
export type Bindings = {
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
  JWT_SECRET: string
  PASS_TOKEN_SECRET: string
  RESEND_API_KEY: string
  RATE_LIMIT_KV: KVNamespace
  LINKS_KV: KVNamespace
  ASSETS: Fetcher
  // Apple Wallet (.pkpass)
  APPLE_PASS_TYPE_ID?: string
  APPLE_TEAM_ID?: string
  APPLE_PASS_CERT_PEM?: string
  APPLE_PASS_KEY_PEM?: string
  APPLE_WWDR_CERT_PEM?: string
  // Google Wallet (JWT save link)
  GOOGLE_WALLET_ISSUER_ID?: string
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?: string
  GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY?: string
  /** SPA origin for verification emails (defaults to https://eypi.cc). */
  FRONTEND_URL?: string
}

export type JWTPayload = {
  sub: string
  email: string
  name?: string
  exp: number
}

// One Turso/libSQL client per request, reused from c.var.db.
export function db<E extends { Bindings: Bindings }>(c: Context<E>): Client {
  const existing = c.var.db
  if (existing) return existing
  const client = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  })
  c.set('db', client)
  return client
}

// Verify the shared HS256 JWT (issued by /api/auth/login) and return its payload.
export async function getUser(
  c: { req: { header: (k: string) => string | undefined }; env: Bindings },
): Promise<JWTPayload | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as Record<string, unknown>
    if (payload.typ !== undefined || typeof payload.email !== 'string') return null
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null
    return payload as JWTPayload
  } catch {
    return null
  }
}
