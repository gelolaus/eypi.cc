import { describe, expect, it } from 'vitest'
import { TAB_COUNT, isAppShellRoute, isNavActive, navItems, tabItems } from './nav'

function labels(items: { label: string }[]) {
  return items.map((item) => item.label)
}

describe('nav items', () => {
  it('lists the public items when signed out', () => {
    expect(labels(navItems({ authenticated: false, admin: false }))).toEqual(['Orgs', 'Log in', 'Sign up'])
  })

  it('lists the app modules when signed in', () => {
    expect(labels(navItems({ authenticated: true, admin: false }))).toEqual([
      'Dashboard',
      'Links',
      'Tix',
      'My tickets',
      'Frames',
      'Forms',
      'Wallpaper',
      'Orgs',
      'Invites',
      'Account',
    ])
  })

  it('adds Admin for admins only', () => {
    const items = navItems({ authenticated: true, admin: true })
    const last = items[items.length - 1]
    expect(last.label).toBe('Admin')
    expect(last.to).toBe('/admin/users')
    expect(labels(navItems({ authenticated: false, admin: true }))).not.toContain('Admin')
  })

  it('keeps the existing destinations', () => {
    const byLabel = Object.fromEntries(navItems({ authenticated: true, admin: true }).map((item) => [item.label, item.to]))
    expect(byLabel).toEqual({
      Dashboard: '/dashboard',
      Links: '/links',
      Tix: '/manage/tix',
      'My tickets': '/tickets',
      Frames: '/manage/frames',
      Forms: '/forms',
      Wallpaper: '/wallpaper',
      Orgs: '/orgs',
      Invites: '/invites',
      Account: '/account',
      Admin: '/admin/users',
    })
    const signUp = navItems({ authenticated: false, admin: false }).find((item) => item.label === 'Sign up')
    expect(signUp?.to).toBe('/login?tab=register')
    expect(signUp?.cta).toBe(true)
  })

  it('puts the first four app items in the tab bar', () => {
    expect(TAB_COUNT).toBe(4)
    expect(labels(tabItems(navItems({ authenticated: true, admin: false })))).toEqual(['Dashboard', 'Links', 'Tix', 'My tickets'])
  })
})

describe('active matching', () => {
  const items = navItems({ authenticated: true, admin: true })
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
    expect(isNavActive(find('Orgs'), '/orgs/modify/apc')).toBe(true)
    expect(isNavActive(find('Links'), '/linksx')).toBe(false)
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
  })

  it('keeps public chrome for signed-out users and public pages', () => {
    expect(isAppShellRoute({ authenticated: false, path: '/links', requiresAuth: true })).toBe(false)
    expect(isAppShellRoute({ authenticated: true, path: '/', requiresAuth: false })).toBe(false)
    expect(isAppShellRoute({ authenticated: true, path: '/tix/abc', requiresAuth: false })).toBe(false)
  })
})
