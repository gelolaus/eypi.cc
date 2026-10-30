export type NavIconName =
  | 'home'
  | 'link'
  | 'ticket'
  | 'tickets'
  | 'frame'
  | 'form'
  | 'wallpaper'
  | 'orgs'
  | 'invites'
  | 'account'
  | 'admin'
  | 'login'
  | 'signup'

export type NavItem = {
  to: string
  label: string
  icon: NavIconName
  /** Path that marks the item active. `null` never matches. Defaults to the path part of `to`. */
  match?: string | null
  /** Match the path exactly instead of by prefix. */
  exact?: boolean
  /** Render as the gold call to action. */
  cta?: boolean
}

/** Number of items shown as tabs in the bottom bar; the rest live behind "More". */
export const TAB_COUNT = 4

const APP_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home', exact: true },
  { to: '/links', label: 'Links', icon: 'link' },
  { to: '/manage/tix', label: 'Tix', icon: 'ticket' },
  { to: '/tickets', label: 'My tickets', icon: 'tickets' },
  { to: '/manage/frames', label: 'Frames', icon: 'frame' },
  { to: '/forms', label: 'Forms', icon: 'form' },
  { to: '/wallpaper', label: 'Wallpaper', icon: 'wallpaper' },
  { to: '/orgs', label: 'Orgs', icon: 'orgs' },
  { to: '/invites', label: 'Invites', icon: 'invites' },
  { to: '/account', label: 'Account', icon: 'account' },
]

const ADMIN_ITEM: NavItem = { to: '/admin/users', label: 'Admin', icon: 'admin', match: '/admin' }

const PUBLIC_ITEMS: NavItem[] = [
  { to: '/orgs', label: 'Orgs', icon: 'orgs' },
  { to: '/login', label: 'Log in', icon: 'login' },
  { to: '/login?tab=register', label: 'Sign up', icon: 'signup', match: null, cta: true },
]

export function navItems({ authenticated, admin }: { authenticated: boolean; admin: boolean }): NavItem[] {
  if (!authenticated) return [...PUBLIC_ITEMS]
  return admin ? [...APP_ITEMS, ADMIN_ITEM] : [...APP_ITEMS]
}

export function tabItems(items: NavItem[]): NavItem[] {
  return items.slice(0, TAB_COUNT)
}

/** Home items (`/`, or `exact`) match exactly; every other item matches its path and anything below it. */
export function isNavActive(item: NavItem, path: string): boolean {
  const base = item.match === undefined ? item.to.split('?')[0] : item.match
  if (base === null) return false
  if (item.exact || base === '/') return path === base
  return path === base || path.startsWith(`${base}/`)
}

/** Signed-in users get the app shell on auth-only routes and on every nav destination (e.g. /orgs). */
export function isAppShellRoute({
  authenticated,
  path,
  requiresAuth,
}: {
  authenticated: boolean
  path: string
  requiresAuth: boolean
}): boolean {
  if (!authenticated) return false
  if (requiresAuth) return true
  return APP_ITEMS.some((item) => isNavActive(item, path))
}
