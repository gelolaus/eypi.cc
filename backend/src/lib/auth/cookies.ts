const COOKIE_TTL_SEC = 600

export type OAuthCookiePayload = {
  state: string
  nonce: string
  verifier: string
  returnTo: string
}

type StoredOAuthCookie = OAuthCookiePayload & { exp: number }

export function safeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/dashboard'
  if (!raw.startsWith('/')) return '/dashboard'
  if (raw.startsWith('//')) return '/dashboard'
  if (raw.includes('\\')) return '/dashboard'
  return raw
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const pad = (4 - (value.length % 4)) % 4
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return new Uint8Array(signature)
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

export async function signOAuthCookie(secret: string, payload: OAuthCookiePayload): Promise<string> {
  const stored: StoredOAuthCookie = {
    state: payload.state,
    nonce: payload.nonce,
    verifier: payload.verifier,
    returnTo: payload.returnTo,
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SEC,
  }
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(stored)))
  const sig = bytesToBase64Url(await hmacSha256(secret, body))
  return `${body}.${sig}`
}

export async function readOAuthCookie(secret: string, value: string): Promise<OAuthCookiePayload | null> {
  const parts = value.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null

  let actual: Uint8Array
  try {
    actual = base64UrlToBytes(sig)
  } catch {
    return null
  }
  const expected = await hmacSha256(secret, body)
  if (!timingSafeEqual(actual, expected)) return null

  let stored: StoredOAuthCookie
  try {
    stored = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as StoredOAuthCookie
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (
    typeof stored?.exp !== 'number'
    || stored.exp <= now
    || typeof stored.state !== 'string'
    || typeof stored.nonce !== 'string'
    || typeof stored.verifier !== 'string'
    || typeof stored.returnTo !== 'string'
  ) {
    return null
  }

  return {
    state: stored.state,
    nonce: stored.nonce,
    verifier: stored.verifier,
    returnTo: stored.returnTo,
  }
}

export function oauthCookieHeader(value: string): string {
  return `eypi_oauth=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/auth`
}

export function clearOAuthCookieHeader(): string {
  return 'eypi_oauth=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth'
}
