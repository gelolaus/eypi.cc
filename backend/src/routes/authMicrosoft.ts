import { Hono } from 'hono'
import {
  clearOAuthCookieHeader,
  oauthCookieHeader,
  readOAuthCookie,
  safeReturnTo,
  signOAuthCookie,
} from '../lib/auth/cookies'
import {
  AuthError,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  verifyIdToken,
  type OAuthEnv,
} from '../lib/auth/oauth'
import { checkRateLimit } from '../lib/rateLimit'

const app = new Hono<{ Bindings: OAuthEnv }>()

const LIMIT = 30
const WINDOW_SEC = 10 * 60

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function randomBase64Url(size = 32): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return bytesToBase64Url(new Uint8Array(digest))
}

function requestRedirectUri(requestUrl: string): string {
  const url = new URL(requestUrl)
  return `${url.origin}/api/auth/microsoft/callback`
}

function loginRedirect(env: OAuthEnv, error: string, clearCookie: boolean): Response {
  const origin = (env.FRONTEND_ORIGIN ?? '').replace(/\/$/, '')
  const headers = new Headers({ Location: `${origin}/login?error=${error}` })
  if (clearCookie) headers.set('Set-Cookie', clearOAuthCookieHeader())
  return new Response(null, { status: 302, headers })
}

function readRequestCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  return null
}

async function underLimit(env: OAuthEnv, bucket: 'start' | 'callback', ip: string): Promise<boolean> {
  try {
    return await checkRateLimit(env.RATE_LIMIT_KV, `rl:ms-${bucket}:${ip}`, LIMIT, WINDOW_SEC)
  } catch {
    return false
  }
}

function finishVerifiedSignIn(env: OAuthEnv): Response {
  // Task 2.3: create the session here.
  return loginRedirect(env, 'server', true)
}

app.get('/api/auth/microsoft/start', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (!await underLimit(c.env, 'start', ip)) return loginRedirect(c.env, 'server', false)

  const clientId = c.env.MS_CLIENT_ID?.trim() ?? ''
  const secret = c.env.AUTH_COOKIE_SECRET?.trim() ?? ''
  const origin = c.env.FRONTEND_ORIGIN?.trim() ?? ''
  if (!clientId || !secret || !origin) return loginRedirect(c.env, 'server', false)

  const state = randomBase64Url()
  const nonce = randomBase64Url()
  const verifier = randomBase64Url()
  const signed = await signOAuthCookie(secret, {
    state,
    nonce,
    verifier,
    returnTo: safeReturnTo(c.req.query('returnTo')),
  })
  const location = buildAuthorizeUrl(
    { MS_CLIENT_ID: clientId, MS_REDIRECT_URI: requestRedirectUri(c.req.url) },
    { state, nonce, codeChallenge: await codeChallenge(verifier) },
  )
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': oauthCookieHeader(signed),
    },
  })
})

app.get('/api/auth/microsoft/callback', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (!await underLimit(c.env, 'callback', ip)) return loginRedirect(c.env, 'server', true)

  const oauthError = c.req.query('error')
  if (oauthError === 'access_denied') return loginRedirect(c.env, 'cancelled', true)
  if (oauthError) return loginRedirect(c.env, 'server', true)

  const clientId = c.env.MS_CLIENT_ID?.trim() ?? ''
  const clientSecret = c.env.MS_CLIENT_SECRET?.trim() ?? ''
  const tenants = c.env.MS_ALLOWED_TENANT_IDS?.trim() ?? ''
  const secret = c.env.AUTH_COOKIE_SECRET?.trim() ?? ''
  const origin = c.env.FRONTEND_ORIGIN?.trim() ?? ''
  if (!clientId || !clientSecret || !tenants || !secret || !origin) {
    return loginRedirect(c.env, 'server', true)
  }

  const rawCookie = readRequestCookie(c.req.header('Cookie'), 'eypi_oauth')
  const stored = rawCookie ? await readOAuthCookie(secret, rawCookie) : null
  const state = c.req.query('state') ?? ''
  if (!stored || stored.state !== state) return loginRedirect(c.env, 'state', true)

  const code = c.req.query('code')?.trim() ?? ''
  if (!code) return loginRedirect(c.env, 'server', true)

  try {
    const idToken = await exchangeAuthorizationCode(
      { MS_CLIENT_ID: clientId, MS_CLIENT_SECRET: clientSecret },
      {
        code,
        codeVerifier: stored.verifier,
        redirectUri: requestRedirectUri(c.req.url),
      },
    )
    await verifyIdToken(
      { MS_CLIENT_ID: clientId, MS_ALLOWED_TENANT_IDS: c.env.MS_ALLOWED_TENANT_IDS },
      idToken,
      { nonce: stored.nonce },
    )
    return finishVerifiedSignIn(c.env)
  } catch (err) {
    if (err instanceof AuthError && (err.code === 'tenant' || err.code === 'domain')) {
      return loginRedirect(c.env, err.code, true)
    }
    return loginRedirect(c.env, 'server', true)
  }
})

export default app
