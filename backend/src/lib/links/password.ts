const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return diff === 0
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
    },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashLinkPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt)
  return `pbkdf2$sha256$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export async function verifyLinkPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 5) return false
  const [scheme, hashName, iterations, saltB64, hashB64] = parts
  if (scheme !== 'pbkdf2' || hashName !== 'sha256' || iterations !== String(ITERATIONS)) return false
  if (!saltB64 || !hashB64) return false
  const salt = base64ToBytes(saltB64)
  const expected = base64ToBytes(hashB64)
  if (!salt || !expected) return false
  const actual = await derive(password, salt)
  return constantTimeEqual(actual, expected)
}
