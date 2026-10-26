// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageSkeleton from './PageSkeleton.vue'

describe('PageSkeleton', () => {
  it('is a busy region with layout-shaped blocks', () => {
    const wrapper = mount(PageSkeleton)
    const root = wrapper.get('[aria-busy="true"]')
    expect(root.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('Loading')
    expect(wrapper.findAll('.rounded-3xl').length).toBeGreaterThanOrEqual(2)
  })

  it('gates the pulse behind reduced motion', () => {
    const blocks = mount(PageSkeleton).findAll('.rounded-3xl')
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block.classes()).toContain('motion-safe:animate-pulse')
      expect(block.classes()).not.toContain('animate-pulse')
    }
  })

  it('honors the rows prop', () => {
    expect(mount(PageSkeleton, { props: { rows: 4 } }).findAll('[data-skeleton-row]')).toHaveLength(4)
  })
})
