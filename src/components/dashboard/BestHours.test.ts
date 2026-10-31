// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BestHours from './BestHours.vue'
import { sampleTrends } from './trendsFixture'

describe('BestHours', () => {
  it('passes the heat grid and shows the peak sentence', () => {
    const wrapper = mount(BestHours, { props: { trends: sampleTrends, status: 'ready' } })
    expect(wrapper.find('[role="img"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mondays')
    expect(wrapper.text()).toContain('7 PM')
  })

  it('shows the empty state with no peak sentence for an all-zero heat', () => {
    const trends = { ...sampleTrends, heat: Array.from({ length: 168 }, () => 0) }
    const wrapper = mount(BestHours, { props: { trends, status: 'ready' } })
    expect(wrapper.text()).not.toContain('Mondays')
    expect(wrapper.text()).toMatch(/no .*hour|no clicks|best hours/i)
  })
})