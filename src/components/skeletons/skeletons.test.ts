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

describe('skeleton geometry', () => {
  it('DetailSkeleton centres the title only when asked', () => {
    expect(mount(DetailSkeleton).find('[data-skeleton-block]').classes()).not.toContain('mx-auto')
    expect(mount(DetailSkeleton, { props: { align: 'center' } }).find('[data-skeleton-block]').classes()).toContain('mx-auto')
  })

  it('ListSkeleton swaps to the desktop row height at md', () => {
    const wrapper = mount(ListSkeleton, { props: { rows: 2, rowHeight: 210, mdRowHeight: 53 } })
    expect(heights(wrapper, '[data-skeleton-row]')).toEqual(['210px', '210px'])
    expect(heights(wrapper, '[data-skeleton-row-md]')).toEqual(['53px', '53px'])
  })

  it('OrgProfileSkeleton mirrors hero, tabs and about card with 24px radii', async () => {
    const OrgProfileSkeleton = (await import('./OrgProfileSkeleton.vue')).default
    const wrapper = mount(OrgProfileSkeleton)
    const el = (s: string) => wrapper.get(s).element as HTMLElement
    expect(el('[data-skeleton-hero]').style.height).toBe('368px')
    expect(el('[data-skeleton-hero-md]').style.height).toBe('412px')
    expect(el('[data-skeleton-hero]').style.borderRadius).toBe('24px')
    expect(el('[data-skeleton-tabs]').style.height).toBe('44px')
    expect(el('[data-skeleton-body]').style.height).toBe('200px')
  })
})
