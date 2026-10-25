import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { Hono } from 'hono'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readOAuthCookie, signOAuthCookie } from '../lib/auth/cookies'
import type { OAuthEnv } from '../lib/auth/oauth'
import microsoftAuth from './authMicrosoft'

const APC_TENANT = 'aeb745e6-8166-4f8f-9233-179e8109c49e'
const OTHER_TENANT = '11111111-1111-1111-1111-111111111111'
const CLIENT_ID = 'test-client-id'
const FRONTEND = 'http://localhost:5173'
const COOKIE_SECRET = 'test-cookie-secret'
const ORIGIN = 'http://localhost:8787'

function memoryKv(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
  } as unknown as KVNamespace
}

function oauthEnv(kv: KVNamespace = memoryKv()): OAuthEnv {
  return {
    MS_CLIENT_ID: CLIENT_ID,
    MS_CLIENT_SECRET: 'test-client-secret',
    MS_ALLOWED_TENANT_IDS: APC_TENANT,
    AUTH_COOKIE_SECRET: COOKIE_SECRET,
    FRONTEND_ORIGIN: FRONTEND,
    RATE_LIMIT_KV: kv,
  }
}

function testApp() {
  const app = new Hono<{ Bindings: OAuthEnv }>()
  app.route('/', microsoftAuth)
  return app
}

function cookieValue(setCookie: string | null): string {
  const pair = setCookie?.split(';')[0] ?? ''
  const eq = pair.indexOf('=')
  return eq === -1 ? '' : pair.slice(eq + 1)
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  let binary = ''
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let publicJwk: Record<string, unknown>

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  privateKey = pair.privateKey
  const jwk = await exportJWK(pair.publicKey)
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  jwk.kid = 'test-key'
  publicJwk = jwk
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function signIdToken(claims: Record<string, unknown>): Promise<string> {
  const tid = String(claims.tid)
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setAudience(CLIENT_ID)
    .setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .sign(privateKey)
}

function stubMicrosoft(idToken: string): { tokenBodies: string[] } {
  const tokenBodies: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://login.microsoftonline.com/common/discovery/v2.0/keys') {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url === 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token') {
      tokenBodies.push(typeof init?.body === 'string' ? init.body : '')
      return new Response(JSON.stringify({ id_token: idToken }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  return { tokenBodies }
}

describe('GET /api/auth/microsoft/start', () => {
  it('sets the oauth cookie and redirects to Microsoft with the request redirect uri', async () => {
    const app = testApp()
    const env = oauthEnv()

    const res = await app.request(`${ORIGIN}/api/auth/microsoft/start?returnTo=/links`, {}, env)

    expect(res.status).toBe(302)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('eypi_oauth=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Max-Age=600')
    expect(setCookie).toContain('Path=/api/auth')

    const location = new URL(res.headers.get('location') ?? '')
    expect(location.origin + location.pathname).toBe('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize')
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/microsoft/callback`)
    expect(location.searchParams.get('scope')).toBe('openid profile email')
    expect(location.searchParams.get('prompt')).toBe('select_account')
    expect(location.searchParams.get('domain_hint')).toBe('apc.edu.ph')
    expect(location.searchParams.get('response_mode')).toBe('query')
    expect(location.searchParams.get('response_type')).toBe('code')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')

    const stored = await readOAuthCookie(COOKIE_SECRET, cookieValue(setCookie))
    expect(stored?.returnTo).toBe('/links')
    expect(stored?.state).toBe(location.searchParams.get('state'))
    expect(stored?.nonce).toBe(location.searchParams.get('nonce'))
    expect(location.searchParams.get('code_challenge')).toBe(await sha256Base64Url(stored?.verifier ?? ''))
  })

  it('stores the default return path when returnTo is protocol-relative', async () => {
    const app = testApp()
    const res = await app.request(`${ORIGIN}/api/auth/microsoft/start?returnTo=//evil.com`, {}, oauthEnv())
    const stored = await readOAuthCookie(COOKIE_SECRET, cookieValue(res.headers.get('set-cookie')))
    expect(stored?.returnTo).toBe('/dashboard')
  })

  it('redirects to login?error=server when Microsoft config is missing', async () => {
    const app = testApp()
    const env = oauthEnv()
    env.MS_CLIENT_ID = ''

    const res = await app.request(`${ORIGIN}/api/auth/microsoft/start`, {}, env)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=server`)
  })

  it('redirects to login?error=server after 30 starts in 10 minutes', async () => {
    const app = testApp()
    const env = oauthEnv()

    for (let i = 0; i < 30; i++) {
      const res = await app.request(`${ORIGIN}/api/auth/microsoft/start`, {}, env)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('login.microsoftonline.com')
    }

    const blocked = await app.request(`${ORIGIN}/api/auth/microsoft/start`, {}, env)
    expect(blocked.status).toBe(302)
    expect(blocked.headers.get('location')).toBe(`${FRONTEND}/login?error=server`)
  })
})

describe('GET /api/auth/microsoft/callback', () => {
  it('callback with mismatched state returns 302 to /login?error=state', async () => {
    const app = testApp()
    const signed = await signOAuthCookie(COOKIE_SECRET, {
      state: 'expected-state',
      nonce: 'nonce-1',
      verifier: 'verifier-1',
      returnTo: '/links',
    })

    const res = await app.request(
      `${ORIGIN}/api/auth/microsoft/callback?code=auth-code&state=other-state`,
      { headers: { Cookie: `eypi_oauth=${signed}` } },
      oauthEnv(),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=state`)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(res.headers.get('set-cookie')).toContain('Path=/api/auth')
  })

  it('callback ?error=access_denied returns /login?error=cancelled', async () => {
    const app = testApp()

    const res = await app.request(
      `${ORIGIN}/api/auth/microsoft/callback?error=access_denied&state=state-1`,
      {},
      oauthEnv(),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=cancelled`)
  })

  it('redirects to login?error=server after 30 callbacks in 10 minutes', async () => {
    const app = testApp()
    const env = oauthEnv()

    for (let i = 0; i < 30; i++) {
      const res = await app.request(
        `${ORIGIN}/api/auth/microsoft/callback?error=access_denied`,
        {},
        env,
      )
      expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=cancelled`)
    }

    const blocked = await app.request(
      `${ORIGIN}/api/auth/microsoft/callback?error=access_denied`,
      {},
      env,
    )
    expect(blocked.status).toBe(302)
    expect(blocked.headers.get('location')).toBe(`${FRONTEND}/login?error=server`)
  })

  it('redirects another tenant to login?error=tenant', async () => {
    const app = testApp()
    const idToken = await signIdToken({
      tid: OTHER_TENANT,
      oid: 'oid-other',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    })
    const { tokenBodies } = stubMicrosoft(idToken)
    const signed = await signOAuthCookie(COOKIE_SECRET, {
      state: 'state-1',
      nonce: 'nonce-1',
      verifier: 'verifier-1',
      returnTo: '/links',
    })

    const res = await app.request(
      `${ORIGIN}/api/auth/microsoft/callback?code=auth-code&state=state-1`,
      { headers: { Cookie: `eypi_oauth=${signed}` } },
      oauthEnv(),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=tenant`)
    const body = new URLSearchParams(tokenBodies[0])
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBe('verifier-1')
    expect(body.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/microsoft/callback`)
    expect(body.get('client_id')).toBe(CLIENT_ID)
  })

  it('redirects a verified sign-in to login?error=server until sessions exist', async () => {
    const app = testApp()
    const idToken = await signIdToken({
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    })
    stubMicrosoft(idToken)
    const signed = await signOAuthCookie(COOKIE_SECRET, {
      state: 'state-1',
      nonce: 'nonce-1',
      verifier: 'verifier-1',
      returnTo: '/links',
    })

    const res = await app.request(
      `${ORIGIN}/api/auth/microsoft/callback?code=auth-code&state=state-1`,
      { headers: { Cookie: `eypi_oauth=${signed}` } },
      oauthEnv(),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${FRONTEND}/login?error=server`)
    expect(res.headers.get('location')).not.toContain('/links')
  })
})
