// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { Badge } from './index'

describe('Badge', () => {
  it('renders variants', () => {
    expect(mount(Badge).classes()).toContain('bg-primary')
    expect(mount(Badge, { props: { variant: 'secondary' } }).classes()).toContain('bg-secondary')
    expect(mount(Badge, { props: { variant: 'destructive' } }).classes()).toContain('text-destructive')
    expect(mount(Badge, { props: { variant: 'outline' } }).classes()).toContain('border-border')
    expect(mount(Badge).attributes('data-slot')).toBe('badge')
    expect(mount(Badge, { props: { variant: 'ghost' } }).attributes('data-variant')).toBe('ghost')
  })
  it('asChild renders child', () => {
    const w = mount(Badge, { props: { asChild: true }, slots: { default: () => h('a', 'x') } })
    expect(w.element.tagName).toBe('A')
  })
})
