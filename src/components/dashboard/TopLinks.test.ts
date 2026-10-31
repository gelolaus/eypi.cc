// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TopLinks from './TopLinks.vue'
import { sampleTrends } from './trendsFixture'
import { useToast } from '@/composables/useToast'

const RouterLink = { props: ['to'], template: '<a :href="String(to)"><slot /></a>' }
const global = { stubs: { RouterLink } }

describe('TopLinks', () => {
  beforeEach(() => {
    useToast().toasts.value = []
  })

  it('renders at most five rows labelled eypi.cc/{slug}', () => {
    const wrapper = mount(TopLinks, { props: { trends: sampleTrends, status: 'ready' }, global })
    expect(wrapper.text()).toContain('eypi.cc/aa')
    expect(wrapper.text()).toContain('eypi.cc/ee')
    expect(wrapper.text()).not.toContain('eypi.cc/ff')
    const rows = wrapper.findAll('[data-top-link]')
    expect(rows.length).toBeLessThanOrEqual(5)
    expect(rows.length).toBe(5)
  })

  it('shows No links yet with an action to /links', () => {
    const trends = {
      ...sampleTrends,
      totals: { ...sampleTrends.totals, links: 0 },
      top: { ...sampleTrends.top, links: [] },
    }
    const wrapper = mount(TopLinks, { props: { trends, status: 'ready' }, global })
    expect(wrapper.text()).toContain('No links yet')
    expect(wrapper.get('a').attributes('href')).toBe('/links')
  })

  it('shows No clicks in this period when links exist but clicks are zero', () => {
    const trends = {
      ...sampleTrends,
      totals: { ...sampleTrends.totals, clicks: 0, links: 2 },
      top: { ...sampleTrends.top, links: [] },
    }
    const wrapper = mount(TopLinks, { props: { trends, status: 'ready' }, global })
    expect(wrapper.text()).toContain('No clicks in this period')
  })

  it('gives each row a 44px copy button labelled Copy eypi.cc/{slug}', () => {
    const wrapper = mount(TopLinks, { props: { trends: sampleTrends, status: 'ready' }, global })
    for (const slug of ['aa', 'bb', 'cc', 'dd', 'ee']) {
      const btn = wrapper.get(`button[aria-label="Copy eypi.cc/${slug}"]`)
      expect(btn.classes().join(' ')).toMatch(/size-11|min-h-11|h-11/)
    }
  })

  it('copies https://eypi.cc/{slug} and shows the success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(TopLinks, { props: { trends: sampleTrends, status: 'ready' }, global })
    await wrapper.get('button[aria-label="Copy eypi.cc/aa"]').trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('https://eypi.cc/aa')
    expect(useToast().toasts.value.some((t) => t.type === 'success' && t.message === 'Link copied.')).toBe(true)
  })

  it('shows an error toast when copy fails and does not throw', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(TopLinks, { props: { trends: sampleTrends, status: 'ready' }, global })
    await expect(wrapper.get('button[aria-label="Copy eypi.cc/bb"]').trigger('click')).resolves.toBeUndefined()
    await Promise.resolve()
    await Promise.resolve()
    expect(useToast().toasts.value.some((t) => t.type === 'error' && t.message === 'Could not copy the link.')).toBe(true)
  })
})
