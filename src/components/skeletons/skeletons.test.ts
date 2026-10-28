// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CardGridSkeleton from './CardGridSkeleton.vue'
import DetailSkeleton from './DetailSkeleton.vue'
import ListSkeleton from './ListSkeleton.vue'

function heights(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.findAll(selector).map((n) => (n.element as HTMLElement).style.height)
}

describe('skeleton layouts', () => {
  it('ListSkeleton renders rows of a fixed height inside an aria-busy region', () => {
    const wrapper = mount(ListSkeleton, { props: { rows: 4, rowHeight: 112 } })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('Loading')
    expect(heights(wrapper, '[data-skeleton-row]')).toEqual(['112px', '112px', '112px', '112px'])
  })

  it('CardGridSkeleton renders cards of a fixed height', () => {
    const wrapper = mount(CardGridSkeleton, { props: { count: 6, cardHeight: 192 } })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(heights(wrapper, '[data-skeleton-card]')).toEqual(Array(6).fill('192px'))
  })

  it('DetailSkeleton reserves a fixed height for every block', () => {
    const wrapper = mount(DetailSkeleton)
    expect(wrapper.attributes('aria-busy')).toBe('true')
    const blocks = heights(wrapper, '[data-skeleton-block]')
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    for (const h of blocks) expect(h).toMatch(/^\d+px$/)
  })

  it('never renders a spinner', () => {
    for (const c of [ListSkeleton, CardGridSkeleton, DetailSkeleton]) {
      expect(mount(c).find('.animate-spin').exists()).toBe(false)
    }
  })
})
