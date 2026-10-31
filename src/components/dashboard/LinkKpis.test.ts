// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LinkKpis from './LinkKpis.vue'
import { sampleTrends } from './trendsFixture'

describe('LinkKpis', () => {
  it('renders the five tiles with deltas against previous', () => {
    const wrapper = mount(LinkKpis, { props: { trends: sampleTrends, status: 'ready' } })
    const text = wrapper.text()
    expect(text).toContain('Clicks')
    expect(text).toContain('Daily uniques')
    expect(text).toContain('QR scans')
    expect(text).toContain('Active links')
    expect(text).toContain('Links')
    expect(text).toContain('110')
    expect(text).toContain('+10%')
    expect(text).toContain('New')
  })

  it('hides deltas when previous is absent', () => {
    const { previous: _p, ...rest } = sampleTrends
    const wrapper = mount(LinkKpis, { props: { trends: rest, status: 'ready' } })
    expect(wrapper.find('[data-testid="delta"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('New')
  })

  it('shows New when previous clicks are zero and current is above zero', () => {
    const trends = {
      ...sampleTrends,
      previous: {
        totals: { clicks: 0, uniques: 0, qr: 0, activeLinks: 0 },
        timeline: [],
      },
    }
    const wrapper = mount(LinkKpis, { props: { trends, status: 'ready' } })
    expect(wrapper.text()).toContain('New')
  })
})