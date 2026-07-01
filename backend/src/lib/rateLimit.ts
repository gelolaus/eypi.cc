export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const raw = await kv.get(key)
  const now = Math.floor(Date.now() / 1000)
  let count = 0
  let windowExpiry = now + windowSeconds

  if (raw !== null) {
    const parts = raw.split(':')
    count = parseInt(parts[0], 10)
    if (parts[1]) windowExpiry = parseInt(parts[1], 10)
  }

  if (count >= limit) return false

  // Preserve the original window expiry so the TTL doesn't slide forward on
  // each request — without this, any attempt resets the 15-minute clock.
  const ttl = Math.max(windowExpiry - now, 60)
  await kv.put(key, `${count + 1}:${windowExpiry}`, { expirationTtl: ttl })
  return true
}
