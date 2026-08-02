import { describe, expect, it } from 'vitest'
import { isAppNavActive, resolveAppNav } from './app-nav'

describe('resolveAppNav', () => {
  it('keeps mobile lean without org tools', () => {
    const nav = resolveAppNav({ hasOrgTools: false })
    expect(nav.mobilePrimary.map((i) => i.id)).toEqual(['home', 'links'])
    expect(nav.orgTools).toEqual([])
  })

  it('adds org tools overflow on mobile when membership active', () => {
    const nav = resolveAppNav({ hasOrgTools: true })
    expect(nav.mobilePrimary.map((i) => i.id)).toContain('org-tools')
    expect(nav.orgTools.map((i) => i.id)).toEqual(['orgs', 'forms', 'frames', 'tix'])
  })
})

describe('isAppNavActive', () => {
  it('matches nested forms routes', () => {
    expect(isAppNavActive('/forms', '/forms/concessionaire')).toBe(true)
  })
})
