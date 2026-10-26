import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { isApcEmail, normalizeEmail } from '../../../../shared/apcIdentity'

export type OAuthEnv = {
  MS_CLIENT_ID?: string
  MS_CLIENT_SECRET?: string
  MS_ALLOWED_TENANT_IDS?: string
  AUTH_COOKIE_SECRET?: string
  FRONTEND_ORIGIN?: string
  MS_REDIRECT_URI?: string
  ENVIRONMENT?: string
  IP_HASH_SECRET?: string
  RATE_LIMIT_KV: KVNamespace
}

export type VerifiedIdentity = {
  tid: string
  oid: string
  email: string
  name: string
}

export class AuthError extends Error {
  readonly code: 'tenant' | 'domain' | 'token'

  constructor(code: 'tenant' | 'domain' | 'token') {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const MICROSOFT_JWKS = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'),
)

export function buildAuthorizeUrl(
  env: Pick<OAuthEnv, 'MS_CLIENT_ID' | 'MS_REDIRECT_URI'>,
  input: { state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize')
  url.searchParams.set('client_id', env.MS_CLIENT_ID ?? '')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', env.MS_REDIRECT_URI ?? '')
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', input.state)
  url.searchParams.set('nonce', input.nonce)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'select_account')
  url.searchParams.set('domain_hint', 'apc.edu.ph')
  return url.toString()
}

function allowedTenantIds(env: Pick<OAuthEnv, 'MS_ALLOWED_TENANT_IDS'>): Set<string> {
  return new Set(
    (env.MS_ALLOWED_TENANT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
}

function stringClaim(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export async function verifyIdToken(
  env: Pick<OAuthEnv, 'MS_CLIENT_ID' | 'MS_ALLOWED_TENANT_IDS'>,
  idToken: string,
  options: { nonce: string },
  jwks?: JWTVerifyGetKey,
): Promise<VerifiedIdentity> {
  if (!env.MS_CLIENT_ID?.trim()) throw new AuthError('token')

  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(idToken, jwks ?? MICROSOFT_JWKS, {
      audience: env.MS_CLIENT_ID,
    }))
  } catch {
    throw new AuthError('token')
  }

  if (payload.nonce !== options.nonce) throw new AuthError('token')

  const tid = stringClaim(payload.tid)
  if (!tid || !allowedTenantIds(env).has(tid)) throw new AuthError('tenant')

  if (payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) {
    throw new AuthError('token')
  }

  const rawEmail = stringClaim(payload.email) ?? stringClaim(payload.preferred_username)
  if (!rawEmail) throw new AuthError('domain')
  const email = normalizeEmail(rawEmail)
  if (!isApcEmail(email)) throw new AuthError('domain')

  const oid = stringClaim(payload.oid)
  if (!oid) throw new AuthError('token')

  return {
    tid,
    oid,
    email,
    name: stringClaim(payload.name) ?? '',
  }
}

export async function exchangeAuthorizationCode(
  env: Pick<OAuthEnv, 'MS_CLIENT_ID' | 'MS_CLIENT_SECRET'>,
  input: { code: string; codeVerifier: string; redirectUri: string },
): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID ?? '',
    client_secret: env.MS_CLIENT_SECRET ?? '',
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: input.codeVerifier,
  })
  const response = await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!response.ok) throw new AuthError('token')
  const json = await response.json() as { id_token?: unknown }
  if (typeof json.id_token !== 'string' || json.id_token.length === 0) throw new AuthError('token')
  return json.id_token
}
