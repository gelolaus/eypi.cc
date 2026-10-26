import { describe, expect, it } from 'vitest'
import { APP_NAV, appNav, isAppNavActive, isAppNavEntryActive, overflowEntries, tabEntries } from './appNav'

describe('APP_NAV', () => {
  it('lists the signed-in modules in order with a label and an icon component', () => {
    expect(APP_NAV.map((entry) => entry.label)).toEqual([
      'Dashboard', 'Links', 'Tix', 'Frames', 'Forms', 'Orgs', 'Invites', 'Account',
    ])
    expect(APP_NAV.map((entry) => entry.to)).toEqual([
      '/dashboard', '/links', '/manage/tix', '/manage/frames', '/forms', '/orgs', '/invites', '/account',
    ])
    for (const entry of APP_NAV) expect(entry.icon).toBeTruthy()
  })

  it('adds Admin only for admins', () => {
    expect(appNav({ admin: true }).slice(-1)[0]?.label).toBe('Admin')
    expect(appNav({ admin: false }).some((entry) => entry.label === 'Admin')).toBe(false)
  })

  it('splits into at most four tabs and the overflow', () => {
    const entries = appNav({ admin: true })
    expect(tabEntries(entries).map((entry) => entry.label)).toEqual(['Dashboard', 'Links', 'Tix', 'Frames'])
    expect(overflowEntries(entries).map((entry) => entry.label)).toEqual(['Forms', 'Orgs', 'Invites', 'Account', 'Admin'])
  })
})

describe('isAppNavActive', () => {
  it('matches the exact path or a child path', () => {
    expect(isAppNavActive('/links', '/links')).toBe(true)
    expect(isAppNavActive('/links', '/links/abc')).toBe(true)
    expect(isAppNavActive('/links', '/linksx')).toBe(false)
    expect(isAppNavActive('/links', '/forms')).toBe(false)
  })

  it('keeps Admin active across /admin pages via the shared nav config', () => {
    const admin = appNav({ admin: true }).find((entry) => entry.label === 'Admin')!
    expect(isAppNavEntryActive(admin, '/admin/orgs')).toBe(true)
    expect(isAppNavEntryActive(admin, '/links')).toBe(false)
  })
})
