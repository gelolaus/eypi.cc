import { verify } from 'hono/jwt'
import { createClient } from '@libsql/client/web'
import type { Client } from '@libsql/client/web'

export async function getUserOrgId(
  client: Client,
  userId: string,
  requestedOrgId?: string,
): Promise<string | null> {
  if (requestedOrgId) {
    const r = await client.execute({
      sql: `
        SELECT id FROM (
          SELECT id FROM organizations WHERE id = ? AND owner_id = ?
          UNION
          SELECT org_id AS id FROM org_members WHERE org_id = ? AND user_id = ? AND activated_at IS NOT NULL
        ) LIMIT 1
      `,
      args: [requestedOrgId, userId, requestedOrgId, userId],
    })
    if (r.rows.length > 0) return r.rows[0].id as string
  }

  const r = await client.execute({
    sql: `
      SELECT id FROM (
        SELECT id FROM organizations WHERE owner_id = ?
        UNION
        SELECT org_id AS id FROM org_members WHERE user_id = ? AND activated_at IS NOT NULL
      ) LIMIT 1
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
}

export type JWTPayload = {
  sub: string
  email: string
  name?: string
  exp: number
}

// Single Turso/libSQL client factory shared across all route modules.
export function db(env: Bindings) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN })
}

// Verify the shared HS256 JWT (issued by /api/auth/login) and return its payload.
export async function getUser(
  c: { req: { header: (k: string) => string | undefined }; env: Bindings },
): Promise<JWTPayload | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as JWTPayload
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
