// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Skeleton from './Skeleton.vue'

describe('Skeleton', () => {
  it('uses fixed pixel dimensions from props', () => {
    const el = mount(Skeleton, { props: { w: 120, h: 48, radius: 16 } }).element as HTMLElement
    expect(el.style.height).toBe('48px')
    expect(el.style.width).toBe('120px')
    expect(el.style.borderRadius).toBe('16px')
  })

  it('accepts a css width and is hidden from assistive tech', () => {
    const wrapper = mount(Skeleton, { props: { w: '100%', h: 20 } })
    expect((wrapper.element as HTMLElement).style.width).toBe('100%')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('gates the shimmer behind reduced motion', () => {
    const classes = mount(Skeleton, { props: { h: 8 } }).classes()
    expect(classes).toContain('motion-safe:animate-pulse')
    expect(classes).not.toContain('animate-pulse')
  })
})
