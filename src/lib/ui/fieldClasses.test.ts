import { describe, expect, it } from 'vitest'
import { fieldClasses } from './fieldClasses'

describe('fieldClasses', () => {
  it('uses h-11 and surface tokens', () => {
    const cls = fieldClasses()
    expect(cls).toContain('h-11')
    expect(cls).toContain('border-g-border')
    expect(cls).toContain('bg-g-surface')
  })
})
