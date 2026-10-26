// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from './index'

describe('Card', () => {
  it('renders classes and size', () => {
    const w = mount(Card)
    expect(w.attributes('data-slot')).toBe('card')
    expect(w.attributes('data-size')).toBe('default')
    expect(w.classes()).toEqual(expect.arrayContaining(['ring-1', 'ring-foreground/10', 'rounded-xl']))
    expect(mount(Card, { props: { size: 'sm' } }).attributes('data-size')).toBe('sm')
  })
  it.each([
    [CardHeader, 'card-header'],
    [CardTitle, 'card-title'],
    [CardDescription, 'card-description'],
    [CardAction, 'card-action'],
    [CardContent, 'card-content'],
    [CardFooter, 'card-footer'],
  ])('parts carry slot names', (C, slot) => {
    expect(mount(C, { slots: { default: 'x' } }).attributes('data-slot')).toBe(slot)
  })
})
