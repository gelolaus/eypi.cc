import { describe, expect, it } from 'vitest'
import {
  APP_NAV,
  appNav,
  groupedEntries,
  isAppNavActive,
  isAppNavEntryActive,
  menuEntries,
  orgEntries,
  overflowEntries,
  tabEntries,
} from './appNav'

const RAMS_LABELS = ['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites', 'Orgs']
const MEMBER_LABELS = [...RAMS_LABELS, 'Tix', 'Frames', 'Forms', 'My org']

describe('APP_NAV', () => {
  it('is the member list in order with a label and an icon component', () => {
    expect(APP_NAV.map((entry) => entry.label)).toEqual(MEMBER_LABELS)
    expect(APP_NAV.map((entry) => entry.to)).toEqual([
      '/dashboard', '/links', '/tickets', '/wallpaper', '/invites', '/orgs',
      '/manage/tix', '/manage/frames', '/forms', '/orgs/modify',
    ])
    for (const entry of APP_NAV) expect(entry.icon).toBeTruthy()
  })

  it('gives My org a different icon from the Orgs directory', () => {
    const icon = (label: string) => APP_NAV.find((entry) => entry.label === label)!.icon
    expect(icon('My org')).not.toBe(icon('Orgs'))
  })
})

describe('appNav', () => {
  it('lists only the Rams items for a non-member', () => {
    expect(appNav({ admin: false, org: false }).map((entry) => entry.label)).toEqual(RAMS_LABELS)
  })

  it('adds the Orgs group for a member', () => {
    expect(appNav({ admin: false, org: true }).map((entry) => entry.label)).toEqual(MEMBER_LABELS)
  })

  it('keeps Account and Admin out of the rail', () => {
    for (const org of [false, true]) {
      const labels = appNav({ admin: true, org }).map((entry) => entry.label)
      expect(labels).not.toContain('Account')
      expect(labels).not.toContain('Admin')
    }
  })

  it('lists Account, and Admin only for admins, in the account menu', () => {
    expect(menuEntries({ admin: false }).map((entry) => entry.label)).toEqual(['Account'])
    expect(menuEntries({ admin: true }).map((entry) => entry.label)).toEqual(['Admin', 'Account'])
  })
})

describe('groupedEntries', () => {
  it('returns one Rams group for a non-member', () => {
    const groups = groupedEntries(appNav({ admin: false, org: false }))
    expect(groups.map((group) => group.group)).toEqual(['rams'])
    expect(groups.map((group) => group.label)).toEqual(['Rams'])
    expect(groups[0].entries.map((entry) => entry.label)).toEqual(RAMS_LABELS)
  })

  it('returns Rams then Orgs for a member', () => {
    const groups = groupedEntries(appNav({ admin: false, org: true }))
    expect(groups.map((group) => group.label)).toEqual(['Rams', 'Orgs'])
    expect(groups[0].entries.map((entry) => entry.label)).toEqual(RAMS_LABELS)
    expect(groups[1].entries.map((entry) => entry.label)).toEqual(['Tix', 'Frames', 'Forms', 'My org'])
  })
})

describe('tabs and overflow', () => {
  it('splits into five tabs and the overflow', () => {
    const entries = appNav({ admin: true, org: true })
    expect(tabEntries(entries).map((entry) => entry.label)).toEqual(['Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites'])
    expect(overflowEntries(entries).map((entry) => entry.label)).toEqual(['Orgs'])
  })

  it('keeps the Rams overflow to Orgs for a non-member too', () => {
    const entries = appNav({ admin: false, org: false })
    expect(tabEntries(entries)).toHaveLength(5)
    expect(overflowEntries(entries).map((entry) => entry.label)).toEqual(['Orgs'])
  })

  it('never puts the Orgs group in the overflow', () => {
    const labels = overflowEntries(appNav({ admin: false, org: true })).map((entry) => entry.label)
    for (const label of ['Tix', 'Frames', 'Forms', 'My org']) expect(labels).not.toContain(label)
  })
})

describe('orgEntries', () => {
  it('is empty for a non-member', () => {
    expect(orgEntries(appNav({ admin: false, org: false }))).toEqual([])
  })

  it('is the four org items for a member', () => {
    expect(orgEntries(appNav({ admin: false, org: true })).map((entry) => entry.label)).toEqual([
      'Tix', 'Frames', 'Forms', 'My org',
    ])
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
