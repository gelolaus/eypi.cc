import type { Context } from 'hono'
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
  PASS_TOKEN_SECRET: string
  RESEND_API_KEY: string
  RATE_LIMIT_KV: KVNamespace
  LINKS_KV: KVNamespace
  /** HMAC key for IP hashing. Reports store the hash, never the raw IP. */
  IP_HASH_SECRET?: string
  /** Optional Google Safe Browsing v4 key. Unset skips the lookup and does not fail health. */
  SAFE_BROWSING_API_KEY?: string
  /** `production` drops localhost from the CORS and CSRF allowlists. */
  ENVIRONMENT?: string
  MS_CLIENT_ID?: string
  MS_CLIENT_SECRET?: string
  /** Comma-separated Entra tenant ids allowed to sign in. */
  MS_ALLOWED_TENANT_IDS?: string
  /** HMAC key for the short-lived Microsoft sign-in cookie. */
  AUTH_COOKIE_SECRET?: string
  /** SPA origin for Microsoft sign-in redirects. */
  FRONTEND_ORIGIN?: string
  ASSETS: Fetcher
  /** Public and private objects in the eypi-media bucket. */
  MEDIA: R2Bucket
  // Google Wallet (JWT save link)
  GOOGLE_WALLET_ISSUER_ID?: string
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?: string
  GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY?: string
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
