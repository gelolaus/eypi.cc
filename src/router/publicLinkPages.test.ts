// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import router from './index'

describe('public link pages', () => {
  it('resolves unlock, expired, and report without an auth guard', () => {
    const unlock = router.resolve('/unlock/promo')
    const expired = router.resolve('/expired')
    const report = router.resolve('/report')

    expect(unlock.name).toBe('unlock')
    expect(unlock.meta.requiresAuth).toBeUndefined()
    expect(expired.name).toBe('expired')
    expect(expired.meta.requiresAuth).toBeUndefined()
    expect(report.name).toBe('report')
    expect(report.meta.requiresAuth).toBeUndefined()
  })
})
