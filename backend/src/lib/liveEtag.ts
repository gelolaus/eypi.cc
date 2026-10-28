/** Weak ETag helpers for the small polled "live" endpoints. */

/** Compact weak ETag from a string (FNV-1a, 32 bit). Content-derived, not cryptographic. */
export function weakEtagOf(content: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `W/"${(h >>> 0).toString(36)}"`
}

/** True when an If-None-Match header names this ETag (or is `*`). */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  const sent = (ifNoneMatch ?? '').split(',').map((t) => t.trim())
  return sent.includes(etag) || sent.includes('*')
}

export const LIVE_CACHE_CONTROL = 'private, no-cache'
