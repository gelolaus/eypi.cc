// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TopLinks from './TopLinks.vue'
import { sampleTrends } from './trendsFixture'

const RouterLink = { props: ['to'], template: '<a :href="String(to)"><slot /></a>' }
const global = { stubs: { RouterLink } }

describe('TopLinks', () => {
  it('renders at most five rows labelled eypi.cc/{slug}', () => {
    const wrapper = mount(TopLinks, { props: { trends: sampleTrends, status: 'ready' }, global })
    expect(wrapper.text()).toContain('eypi.cc/aa')
    expect(wrapper.text()).toContain('eypi.cc/ee')
    expect(wrapper.text()).not.toContain('eypi.cc/ff')
    const rows = wrapper.findAll('ul[role="img"] li')
    expect(rows.length).toBeLessThanOrEqual(5)
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
})