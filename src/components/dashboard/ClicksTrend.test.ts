// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClicksTrend from './ClicksTrend.vue'
import { sampleTrends } from './trendsFixture'

describe('ClicksTrend', () => {
  it('passes clicks, uniques and previous clicks series and labels totals', () => {
    const wrapper = mount(ClicksTrend, { props: { trends: sampleTrends, status: 'ready' } })
    const chart = wrapper.get('[role="img"]')
    const label = chart.attributes('aria-label') ?? ''
    expect(label.length).toBeGreaterThan(0)
    expect(wrapper.text()).toMatch(/110|total/i)
    expect(wrapper.text().toLowerCase()).toMatch(/best|peak|2026-10-02|oct/)
    const legend = wrapper.text()
    expect(legend).toContain('Clicks')
    expect(legend).toContain('Uniques')
    expect(legend).toContain('Previous period clicks')
  })

  it('omits the previous series when previous is absent', () => {
    const { previous: _p, ...rest } = sampleTrends
    const wrapper = mount(ClicksTrend, { props: { trends: rest, status: 'ready' } })
    expect(wrapper.text()).not.toContain('Previous period clicks')
  })
})