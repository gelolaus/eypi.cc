/** Route names reported by real-user speed samples. Keep in step with src/router/index.ts. */
export const RUM_ROUTE_NAMES = [
  'home', 'login', 'dashboard', 'invites', 'links',
  'forms', 'forms-concessionaire', 'forms-visitors-pass', 'forms-letter-of-intent',
  'dp-campaigns', 'dp-new', 'dp-edit', 'dp-public',
  'events', 'event-new', 'event-edit', 'event-select', 'event-manage', 'event-door', 'event-page', 'tickets', 'guest-ticket',
  'orgs-modify-index', 'orgs-modify', 'org-catalog', 'org-profile', 'org-insights','account',
  'admin-overview', 'admin-users', 'admin-links', 'admin-reports', 'admin-audit', 'admin-speed', 'admin-maintenance',
  'admin-orgs', 'admin-orgs-new', 'admin-orgs-edit',
  'privacy', 'terms', 'acceptable-use', 'consent', 'contact',
  'unlock', 'expired', 'report', 'redirect', 'not-found',
] as const

export const RUM_ROUTES: ReadonlySet<string> = new Set(RUM_ROUTE_NAMES)
