import { describe, expect, it } from 'vitest'
import { APP_NAV, appNav, isAppNavActive, isAppNavEntryActive, menuEntries, overflowEntries, tabEntries } from './appNav'

describe('APP_NAV', () => {
  it('lists the signed-in modules in order with a label and an icon component', () => {
    expect(APP_NAV.map((entry) => entry.label)).toEqual([
      'Dashboard', 'Links', 'Tix', 'My tickets', 'Frames', 'Forms', 'Orgs', 'Invites',
    ])
    expect(APP_NAV.map((entry) => entry.to)).toEqual([
      '/dashboard', '/links', '/manage/tix', '/tickets', '/manage/frames', '/forms', '/orgs', '/invites',
    ])
    for (const entry of APP_NAV) expect(entry.icon).toBeTruthy()
  })

  it('keeps Account and Admin out of the rail', () => {
    expect(appNav({ admin: true }).map((entry) => entry.label)).not.toEqual(expect.arrayContaining(['Account']))
    expect(appNav({ admin: true }).some((entry) => entry.label === 'Admin')).toBe(false)
  })

  it('lists Account, and Admin only for admins, in the account menu', () => {
    expect(menuEntries({ admin: false }).map((entry) => entry.label)).toEqual(['Account'])
    expect(menuEntries({ admin: true }).map((entry) => entry.label)).toEqual(['Admin', 'Account'])
  })

  it('splits into at most four tabs and the overflow', () => {
    const entries = appNav({ admin: true })
    expect(tabEntries(entries).map((entry) => entry.label)).toEqual(['Dashboard', 'Links', 'Tix', 'My tickets'])
    expect(overflowEntries(entries).map((entry) => entry.label)).toEqual(['Frames', 'Forms', 'Orgs', 'Invites'])
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
    const admin = menuEntries({ admin: true }).find((entry) => entry.label === 'Admin')!
    expect(isAppNavEntryActive(admin, '/admin/orgs')).toBe(true)
    expect(isAppNavEntryActive(admin, '/links')).toBe(false)
  })
})
