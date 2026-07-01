/** First-segment paths that must never be used as short-link slugs. */
export const RESERVED_SLUGS = [
  // Suite modules (from src/router/index.ts)
  'dashboard', 'links', 'forms', 'manage', 'frames', 'tix', 'orgs',
  // Account & legal
  'settings', 'login', 'verify', 'reset-password', 'privacy', 'terms', 'contact',
  // Defensive / legacy
  'home', 'api', 'dp', 'event', 'events',
] as const

export const RESERVED_SLUG_SET = new Set(RESERVED_SLUGS.map((s) => s.toLowerCase()))

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.toLowerCase())
}
