import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readOAuthCookie, safeReturnTo, signOAuthCookie } from './cookies'
import { AuthError, buildAuthorizeUrl, verifyIdToken, type OAuthEnv } from './oauth'

const APC_TENANT = 'aeb745e6-8166-4f8f-9233-179e8109c49e'
const OTHER_TENANT = '11111111-1111-1111-1111-111111111111'
const CLIENT_ID = 'test-client-id'
const COOKIE_SECRET = 'test-cookie-secret'

const env: Pick<OAuthEnv, 'MS_CLIENT_ID' | 'MS_ALLOWED_TENANT_IDS'> = {
  MS_CLIENT_ID: CLIENT_ID,
  MS_ALLOWED_TENANT_IDS: APC_TENANT,
}

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let jwks: JWTVerifyGetKey

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  privateKey = pair.privateKey
  const jwk = await exportJWK(pair.publicKey)
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  jwk.kid = 'test-key'
  jwks = createLocalJWKSet({ keys: [jwk] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function signIdToken(
  claims: Record<string, unknown>,
  overrides: { aud?: string; iss?: string; exp?: number; iat?: number } = {},
): Promise<string> {
  const tid = String(claims.tid)
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setAudience(overrides.aud ?? CLIENT_ID)
    .setIssuer(overrides.iss ?? `https://login.microsoftonline.com/${tid}/v2.0`)
    .setIssuedAt(overrides.iat ?? now)
    .setExpirationTime(overrides.exp ?? now + 120)
    .sign(privateKey)
}

async function expectAuthCode(
  run: () => Promise<unknown>,
  code: 'tenant' | 'domain' | 'token',
): Promise<void> {
  const err = await run().then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(err).toBeInstanceOf(AuthError)
  expect((err as AuthError).code).toBe(code)
}

describe('verifyIdToken', () => {
  it('rejects a token from another tenant even with an @apc.edu.ph email', async () => {
    const token = await signIdToken({
      tid: OTHER_TENANT,
      oid: 'oid-other',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    })

    await expectAuthCode(
      () => verifyIdToken(env, token, { nonce: 'nonce-1' }, jwks),
      'tenant',
    )
  })

  it('rejects an issuer that does not match the tid', async () => {
    const token = await signIdToken(
      {
        tid: APC_TENANT,
        oid: 'oid-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        nonce: 'nonce-1',
      },
      { iss: `https://login.microsoftonline.com/${OTHER_TENANT}/v2.0` },
    )

    await expectAuthCode(
      () => verifyIdToken(env, token, { nonce: 'nonce-1' }, jwks),
      'token',
    )
  })

  it('rejects a wrong aud, wrong nonce, expired token', async () => {
    const claims = {
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    }
    const now = Math.floor(Date.now() / 1000)

    const wrongAud = await signIdToken(claims, { aud: 'wrong-client' })
    await expectAuthCode(
      () => verifyIdToken(env, wrongAud, { nonce: 'nonce-1' }, jwks),
      'token',
    )

    const wrongNonce = await signIdToken({ ...claims, nonce: 'expected-nonce' })
    await expectAuthCode(
      () => verifyIdToken(env, wrongNonce, { nonce: 'other-nonce' }, jwks),
      'token',
    )

    const expired = await signIdToken(claims, { iat: now - 120, exp: now - 60 })
    await expectAuthCode(
      () => verifyIdToken(env, expired, { nonce: 'nonce-1' }, jwks),
      'token',
    )
  })

  it('rejects APC tenant users whose email is not an APC domain', async () => {
    const token = await signIdToken({
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'ada@gmail.com',
      name: 'Ada',
      nonce: 'nonce-1',
    })

    await expectAuthCode(
      () => verifyIdToken(env, token, { nonce: 'nonce-1' }, jwks),
      'domain',
    )
  })

  it('prefers email claim, falls back to preferred_username, lowercases', async () => {
    const preferred = await signIdToken({
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'Ada@APC.edu.ph',
      preferred_username: 'other@student.apc.edu.ph',
      name: 'Ada Lovelace',
      nonce: 'nonce-1',
    })

    await expect(verifyIdToken(env, preferred, { nonce: 'nonce-1' }, jwks)).resolves.toEqual({
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada Lovelace',
    })

    const fallback = await signIdToken({
      tid: APC_TENANT,
      oid: 'oid-2',
      preferred_username: 'Ada@Student.APC.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    })

    await expect(verifyIdToken(env, fallback, { nonce: 'nonce-1' }, jwks)).resolves.toEqual({
      tid: APC_TENANT,
      oid: 'oid-2',
      email: 'ada@student.apc.edu.ph',
      name: 'Ada',
    })
  })

  it('accepts a tenant id surrounded by spaces in the allow list', async () => {
    const token = await signIdToken({
      tid: APC_TENANT,
      oid: 'oid-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      nonce: 'nonce-1',
    })

    await expect(verifyIdToken(
      { MS_CLIENT_ID: CLIENT_ID, MS_ALLOWED_TENANT_IDS: ` ${APC_TENANT} ` },
      token,
      { nonce: 'nonce-1' },
      jwks,
    )).resolves.toMatchObject({ tid: APC_TENANT, email: 'ada@apc.edu.ph' })
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds the organizations authorize url with pkce and the apc domain hint', () => {
    const href = buildAuthorizeUrl(
      {
        MS_CLIENT_ID: CLIENT_ID,
        MS_REDIRECT_URI: 'http://localhost:8787/api/auth/microsoft/callback',
      },
      { state: 'state-1', nonce: 'nonce-1', codeChallenge: 'challenge-1' },
    )
    const url = new URL(href)

    expect(href.startsWith('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?')).toBe(true)
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8787/api/auth/microsoft/callback')
    expect(url.searchParams.get('response_mode')).toBe('query')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.get('nonce')).toBe('nonce-1')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('prompt')).toBe('select_account')
    expect(url.searchParams.get('domain_hint')).toBe('apc.edu.ph')
  })
})

describe('safeReturnTo', () => {
  it("safeReturnTo('//evil.com') returns /dashboard", () => {
    expect(safeReturnTo('//evil.com')).toBe('/dashboard')
  })

  it('keeps an in-app path', () => {
    expect(safeReturnTo('/links')).toBe('/links')
  })

  it('rejects an absolute url and a backslash', () => {
    expect(safeReturnTo('https://evil.com')).toBe('/dashboard')
    expect(safeReturnTo('/foo\\bar')).toBe('/dashboard')
    expect(safeReturnTo('')).toBe('/dashboard')
  })
})

describe('oauth cookie', () => {
  const payload = {
    state: 'state-1',
    nonce: 'nonce-1',
    verifier: 'verifier-1',
    returnTo: '/links',
  }

  it('round-trips a signed payload', async () => {
    const value = await signOAuthCookie(COOKIE_SECRET, payload)
    await expect(readOAuthCookie(COOKIE_SECRET, value)).resolves.toEqual(payload)
  })

  it('rejects a different secret and a tampered signature', async () => {
    const value = await signOAuthCookie(COOKIE_SECRET, payload)
    const dot = value.indexOf('.')
    const sig = value.slice(dot + 1)
    const flippedSig = `${sig.startsWith('A') ? 'B' : 'A'}${sig.slice(1)}`
    const tampered = `${value.slice(0, dot)}.${flippedSig}`

    await expect(readOAuthCookie('other-secret', value)).resolves.toBeNull()
    await expect(readOAuthCookie(COOKIE_SECRET, tampered)).resolves.toBeNull()
  })

  it('expires after 10 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'))
    const value = await signOAuthCookie(COOKIE_SECRET, payload)

    vi.setSystemTime(new Date('2026-10-25T12:09:59Z'))
    await expect(readOAuthCookie(COOKIE_SECRET, value)).resolves.toEqual(payload)

    vi.setSystemTime(new Date('2026-10-25T12:10:00Z'))
    await expect(readOAuthCookie(COOKIE_SECRET, value)).resolves.toBeNull()
  })
})
