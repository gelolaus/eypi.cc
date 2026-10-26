import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('lets the later conflicting utility win and drops falsy values', () => {
    expect(cn('px-2', false && 'x', 'px-4')).toBe('px-4')
  })
  it('flattens arrays', () => {
    expect(cn('p-2', ['m-1'])).toBe('p-2 m-1')
  })
})
