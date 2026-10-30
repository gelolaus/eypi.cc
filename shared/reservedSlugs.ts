/** First-segment paths that must never be used as short-link slugs. */
export const RESERVED_SLUGS = [
  // Suite modules (from src/router/index.ts)
  'dashboard', 'links', 'forms', 'wallpaper', 'manage', 'frames', 'tix', 'orgs',
  // Account & legal
  'settings', 'login', 'verify', 'reset-password', 'privacy', 'terms', 'acceptable-use', 'consent', 'contact',
  // Defensive / legacy
  'home', 'api', 'dp', 'event', 'events',
  // Planned suite routes and static prefixes
  'admin', 'account', 'assets', 'auth', 'logout', 'signup', 'help', 'about',
  'qr', 'static', 'invites', 'report', 'unlock', 'expired', 'media', 'p',
  // Tix: /tickets (my tickets) and /t/:token (guest ticket)
  't', 'tickets',
] as const

export const RESERVED_SLUG_SET = new Set(RESERVED_SLUGS.map((s) => s.toLowerCase()))

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.toLowerCase())
}
