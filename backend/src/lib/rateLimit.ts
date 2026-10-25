export type RateLimitInput = {
  bucket: string
  subject: string
  limit: number
  windowSec: number
}

export type RateLimitDecision =
  | { ok: true; retryAfter: 0 }
  | { ok: false; retryAfter: number }

export async function checkRateLimit(
  kv: KVNamespace,
  opts: RateLimitInput,
): Promise<RateLimitDecision> {
  const key = `rl:${opts.bucket}:${opts.subject}`
  const now = Math.floor(Date.now() / 1000)
  const raw = await kv.get(key)
  let count = 0
  let windowExpiry = now + opts.windowSec

  if (raw) {
    const [countPart, expiryPart] = raw.split(':')
    const parsedCount = Number.parseInt(countPart ?? '', 10)
    const parsedExpiry = Number.parseInt(expiryPart ?? '', 10)
    if (Number.isFinite(parsedCount)) count = parsedCount
    if (Number.isFinite(parsedExpiry)) windowExpiry = parsedExpiry
  }

  if (windowExpiry <= now) {
    count = 0
    windowExpiry = now + opts.windowSec
  }

  if (count >= opts.limit) {
    return { ok: false, retryAfter: Math.max(windowExpiry - now, 1) }
  }

  const ttl = Math.max(windowExpiry - now, 60)
  await kv.put(key, `${count + 1}:${windowExpiry}`, { expirationTtl: ttl })
  return { ok: true, retryAfter: 0 }
}
