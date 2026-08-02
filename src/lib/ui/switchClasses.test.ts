import { describe, expect, it } from 'vitest'
import { switchClasses } from './switchClasses'

describe('switchClasses', () => {
  it('uses bg-g-primary when checked', () => {
    const cls = switchClasses({ checked: true })
    expect(cls).toContain('bg-g-primary')
  })

  it('does not use bg-g-primary when unchecked', () => {
    const cls = switchClasses({ checked: false })
    expect(cls).not.toContain('bg-g-primary')
  })
})
