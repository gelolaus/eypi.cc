export type NavIconName =
  | 'home'
  | 'link'
  | 'ticket'
  | 'tickets'
  | 'frame'
  | 'form'
  | 'wallpaper'
  | 'orgs'
  | 'myorg'
  | 'invites'
  | 'account'
  | 'admin'
  | 'login'
  | 'signup'

export type NavGroup = 'rams' | 'orgs'

export const GROUP_LABELS: Record<NavGroup, string> = { rams: 'Rams', orgs: 'Orgs' }

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
  /** Rail section the item belongs to. Ungrouped items (Account, Admin) sit below the groups. */
  group?: NavGroup
  /** Only listed for members of an org. */
  orgOnly?: boolean
  /** Shown as a tab in the phone bottom bar. */
  tab?: boolean
  /** Path (and anything under it) that never marks the item active. */
  except?: string
}

/** Number of items flagged 	ab in the bottom bar. */
export const TAB_COUNT = 5

const APP_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home', exact: true, group: 'rams', tab: true },
  { to: '/links', label: 'Links', icon: 'link', group: 'rams', tab: true },
  { to: '/tickets', label: 'My tickets', icon: 'tickets', group: 'rams', tab: true },
  { to: '/wallpaper', label: 'Wallpaper', icon: 'wallpaper', group: 'rams', tab: true },
  { to: '/invites', label: 'Invites', icon: 'invites', group: 'rams', tab: true },
  { to: '/orgs', label: 'Orgs', icon: 'orgs', group: 'rams', except: '/orgs/modify' },
  { to: '/manage/tix', label: 'Tix', icon: 'ticket', group: 'orgs', orgOnly: true },
  { to: '/manage/frames', label: 'Frames', icon: 'frame', group: 'orgs', orgOnly: true },
  { to: '/forms', label: 'Forms', icon: 'form', group: 'orgs', orgOnly: true },
  { to: '/orgs/modify', label: 'My org', icon: 'myorg', group: 'orgs', orgOnly: true },
  { to: '/account', label: 'Account', icon: 'account' },
]

const ADMIN_ITEM: NavItem = { to: '/admin/users', label: 'Admin', icon: 'admin', match: '/admin' }

const PUBLIC_ITEMS: NavItem[] = [
  { to: '/orgs', label: 'Orgs', icon: 'orgs' },
  { to: '/login', label: 'Log in', icon: 'login' },
  { to: '/login?tab=register', label: 'Sign up', icon: 'signup', match: null, cta: true },
]

export function navItems({
  authenticated,
  admin,
  org = false,
}: {
  authenticated: boolean
  admin: boolean
  org?: boolean
}): NavItem[] {
  if (!authenticated) return [...PUBLIC_ITEMS]
  const items = APP_ITEMS.filter((item) => org || !item.orgOnly)
  return admin ? [...items, ADMIN_ITEM] : items
}

export function tabItems(items: NavItem[]): NavItem[] {
  return items.filter((item) => item.tab)
}

/** Home items (`/`, or `exact`) match exactly; every other item matches its path and anything below it. */
export function isNavActive(item: NavItem, path: string): boolean {
  const base = item.match === undefined ? item.to.split('?')[0] : item.match
  if (base === null) return false
  if (item.except && (path === item.except || path.startsWith(`${item.except}/`))) return false
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
