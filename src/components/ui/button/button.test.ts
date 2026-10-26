// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { Button, buttonVariants } from './index'

describe('Button', () => {
  it('renders default classes and slot data', () => {
    const w = mount(Button, { slots: { default: 'Go' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('data-slot')).toBe('button')
    expect(w.attributes('data-variant')).toBe('default')
    expect(w.attributes('data-size')).toBe('default')
    expect(w.classes()).toEqual(expect.arrayContaining(['h-11', 'rounded-xl', 'bg-primary']))
  })
  it('applies size lg', () => {
    expect(mount(Button, { props: { size: 'lg' } }).classes()).toContain('h-12')
  })
  it('applies outline variant', () => {
    expect(mount(Button, { props: { variant: 'outline' } }).classes()).toContain('border-border')
  })
  it('renders the child when asChild', () => {
    const w = mount(Button, {
      props: { asChild: true },
      slots: { default: () => h('a', { href: '/x' }, 'Link') },
    })
    expect(w.element.tagName).toBe('A')
    expect(w.classes()).toContain('bg-primary')
    expect(w.attributes('data-slot')).toBe('button')
  })
  it('supports disabled', () => {
    const w = mount(Button, { attrs: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.classes()).toContain('disabled:opacity-50')
  })
  it('buttonVariants merges class', () => {
    expect(buttonVariants({ size: 'icon', class: 'size-20' })).toContain('size-20')
  })
})
