import { describe, it, expect } from 'vitest'
import { isReservedSlug } from './reservedSlugs'

describe('isReservedSlug', () => {
  it('blocks known reserved slugs', () => {
    expect(isReservedSlug('links')).toBe(true)
    expect(isReservedSlug('orgs')).toBe(true)
    expect(isReservedSlug('dp')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isReservedSlug('LINKS')).toBe(true)
    expect(isReservedSlug('Orgs')).toBe(true)
  })

  it('allows slugs that are not reserved', () => {
    expect(isReservedSlug('my-cool-link')).toBe(false)
    expect(isReservedSlug('abc123')).toBe(false)
  })
})
