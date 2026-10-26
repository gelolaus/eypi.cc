function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
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

export async function hmacIp(secret: string, ip: string): Promise<string> {
  return toHex(await hmacSha256(secret, ip)).slice(0, 32)
}

export async function visitorHash(secret: string, dayYYYYMMDD: string, ip: string, ua: string): Promise<string> {
  return toHex(await hmacSha256(secret, `${dayYYYYMMDD}|${ip}|${ua}`)).slice(0, 16)
}
