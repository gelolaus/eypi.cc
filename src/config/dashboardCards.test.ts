import { describe, expect, it } from 'vitest'
import { navItems } from '@/config/nav'
import { CARD_DESCRIPTIONS } from './dashboardCards'

describe('CARD_DESCRIPTIONS', () => {
  it('covers every grouped nav item except Dashboard', () => {
    const items = navItems({ authenticated: true, admin: false, org: true })
      .filter((item) => item.group && item.to !== '/dashboard')
    for (const item of items) {
      expect(CARD_DESCRIPTIONS[item.to], item.to).toBeTruthy()
    }
  })
})