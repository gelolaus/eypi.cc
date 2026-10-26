import { isReservedSlug } from './reservedSlugs'

/** 1 character, or 3–32 characters, lowercase, no leading or trailing hyphen. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function normalizeSlugInput(input: string): string {
  return input.trim().toLowerCase()
}

export function validateSlug(input: string): 'ok' | 'invalid' | 'reserved' {
  const slug = normalizeSlugInput(input)
  if (!SLUG_RE.test(slug)) return 'invalid'
  if (isReservedSlug(slug)) return 'reserved'
  return 'ok'
}

export function generateSlug(): string {
  const chars: string[] = []
  while (chars.length < 7) {
    const bytes = crypto.getRandomValues(new Uint8Array(7))
    for (const byte of bytes) {
      // 252 is the largest multiple of 36 below 256, so the modulo stays uniform.
      if (byte >= 252) continue
      chars.push(ALPHABET[byte % ALPHABET.length] ?? 'a')
      if (chars.length === 7) break
    }
  }
  return chars.join('')
}
