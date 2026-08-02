import { describe, expect, it } from 'vitest'
import { buttonVariants } from './buttonVariants'

describe('buttonVariants', () => {
  it('primary uses gold fill and dark foreground', () => {
    const cls = buttonVariants({ variant: 'primary', size: 'default' })
    expect(cls).toContain('bg-g-primary')
    expect(cls).toContain('text-g-primary-fg')
    expect(cls).toContain('h-11')
  })

  it('lg is h-12', () => {
    expect(buttonVariants({ size: 'lg' })).toContain('h-12')
  })

  it('destructive uses destructive token', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-g-destructive')
  })
})
