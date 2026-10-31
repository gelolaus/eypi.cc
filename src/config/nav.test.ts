import { describe, expect, it } from 'vitest'
import { GROUP_LABELS, TAB_COUNT, isAppShellRoute, isNavActive, navItems, tabItems } from './nav'

function labels(items: { label: string }[]) {
  return items.map((item) => item.label)
}

describe('nav items', () => {
  it('lists the public items when signed out', () => {
    expect(labels(navItems({ authenticated: false, admin: false }))).toEqual(['Orgs', 'Log in', 'Sign up'])
  })

  it('lists the Rams items for a signed-in user who is not in an org', () => {
    const expected = ['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites', 'Orgs', 'Account']
    expect(labels(navItems({ authenticated: true, admin: false, org: false }))).toEqual(expected)
    expect(labels(navItems({ authenticated: true, admin: false }))).toEqual(expected)
  })

  it('adds the org-only items for org members', () => {
    expect(labels(navItems({ authenticated: true, admin: false, org: true }))).toEqual([
      'Dashboard',
      'Links',
      'My tickets',
      'Wallpaper',
      'Invites',
      'Orgs',
      'Tix',
      'Frames',
      'Forms',
      'My org',
      'Account',
    ])
  })

  it('adds Admin for admins only', () => {
    for (const org of [false, true, undefined]) {
      const items = navItems({ authenticated: true, admin: true, org })
      const last = items[items.length - 1]
      expect(last.label).toBe('Admin')
      expect(last.to).toBe('/admin/users')
    }
    expect(labels(navItems({ authenticated: false, admin: true }))).not.toContain('Admin')
  })

  it('groups items as rams and orgs', () => {
    expect(GROUP_LABELS).toEqual({ rams: 'Rams', orgs: 'Orgs' })
    const items = navItems({ authenticated: true, admin: false, org: true })
    const inGroup = (group: string) => labels(items.filter((item) => item.group === group))
    expect(inGroup('rams')).toEqual(['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites', 'Orgs'])
    expect(inGroup('orgs')).toEqual(['Tix', 'Frames', 'Forms', 'My org'])
  })

  it('keeps the destinations and adds My org', () => {
    const byLabel = Object.fromEntries(navItems({ authenticated: true, admin: true, org: true }).map((item) => [item.label, item.to]))
    expect(byLabel).toEqual({
      Dashboard: '/dashboard',
      Links: '/links',
      'My tickets': '/tickets',
      Wallpaper: '/wallpaper',
      Invites: '/invites',
      Orgs: '/orgs',
      Tix: '/manage/tix',
      Frames: '/manage/frames',
      Forms: '/forms',
      'My org': '/orgs/modify',
      Account: '/account',
      Admin: '/admin/users',
    })
    const signUp = navItems({ authenticated: false, admin: false }).find((item) => item.label === 'Sign up')
    expect(signUp?.to).toBe('/login?tab=register')
    expect(signUp?.cta).toBe(true)
  })

  it('puts five Rams items in the tab bar', () => {
    expect(TAB_COUNT).toBe(5)
    const all = navItems({ authenticated: true, admin: true, org: true })
    expect(labels(tabItems(all))).toEqual(['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites'])
    expect(labels(tabItems(navItems({ authenticated: true, admin: false })))).toEqual([
      'Dashboard',
      'Links',
      'My tickets',
      'Wallpaper',
      'Invites',
    ])
  })
})

describe('active matching', () => {
  const items = navItems({ authenticated: true, admin: true, org: true })
  const find = (label: string) => items.find((item) => item.label === label)!

  it('matches the home item exactly', () => {
    const home = { to: '/', label: 'Home', icon: 'home' as const }
    expect(isNavActive(home, '/')).toBe(true)
    expect(isNavActive(home, '/links')).toBe(false)
    expect(isNavActive(find('Dashboard'), '/dashboard')).toBe(true)
    expect(isNavActive(find('Dashboard'), '/dashboard/extra')).toBe(false)
  })

  it('matches other items by path prefix', () => {
    expect(isNavActive(find('Tix'), '/manage/tix')).toBe(true)
    expect(isNavActive(find('Tix'), '/manage/tix/abc/select')).toBe(true)
    expect(isNavActive(find('Tix'), '/tix/abc')).toBe(false)
    expect(isNavActive(find('Links'), '/linksx')).toBe(false)
  })

  it('keeps Orgs off the My org pages', () => {
    const orgs = find('Orgs')
    const myOrg = find('My org')
    expect(isNavActive(orgs, '/orgs')).toBe(true)
    expect(isNavActive(orgs, '/orgs/jpcs-apc')).toBe(true)
    expect(isNavActive(orgs, '/orgs/modify')).toBe(false)
    expect(isNavActive(orgs, '/orgs/modify/jpcs-apc')).toBe(false)
    expect(isNavActive(myOrg, '/orgs/modify')).toBe(true)
    expect(isNavActive(myOrg, '/orgs/modify/jpcs-apc')).toBe(true)
    expect(isNavActive(myOrg, '/orgs')).toBe(false)
  })

  it('matches Admin across every admin page', () => {
    expect(isNavActive(find('Admin'), '/admin/audit')).toBe(true)
    expect(isNavActive(find('Admin'), '/admin')).toBe(true)
  })

  it('never marks Sign up active, so Log in owns /login', () => {
    const pub = navItems({ authenticated: false, admin: false })
    expect(isNavActive(pub.find((item) => item.label === 'Log in')!, '/login')).toBe(true)
    expect(isNavActive(pub.find((item) => item.label === 'Sign up')!, '/login')).toBe(false)
  })
})
describe('app shell routes', () => {
  it('uses the app shell for signed-in users on auth routes and nav destinations', () => {
    expect(isAppShellRoute({ authenticated: true, path: '/links', requiresAuth: true })).toBe(true)
    expect(isAppShellRoute({ authenticated: true, path: '/orgs/apc', requiresAuth: false })).toBe(true)
    expect(isAppShellRoute({ authenticated: true, path: '/orgs/modify', requiresAuth: false })).toBe(true)
    expect(isAppShellRoute({ authenticated: true, path: '/forms', requiresAuth: false })).toBe(true)
  })

  it('keeps public chrome for signed-out users and public pages', () => {
    expect(isAppShellRoute({ authenticated: false, path: '/links', requiresAuth: true })).toBe(false)
    expect(isAppShellRoute({ authenticated: true, path: '/', requiresAuth: false })).toBe(false)
    expect(isAppShellRoute({ authenticated: true, path: '/tix/abc', requiresAuth: false })).toBe(false)
  })
})
