// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AudiencePanels from './AudiencePanels.vue'
import { sampleTrends } from './trendsFixture'

describe('AudiencePanels', () => {
  it('renders device, country, referrer and app bar lists', () => {
    const wrapper = mount(AudiencePanels, { props: { trends: sampleTrends, status: 'ready' } })
    expect(wrapper.text()).toContain('Device')
    expect(wrapper.text()).toContain('Country')
    expect(wrapper.text()).toContain('Referrer')
    expect(wrapper.text()).toContain('App')
    expect(wrapper.text()).toContain('mobile')
    expect(wrapper.text()).toContain('PH')
    expect(wrapper.text()).toContain('instagram')
  })

  it('hides empty dimensions and shows empty copy when all are empty', () => {
    const trends = {
      ...sampleTrends,
      top: { links: sampleTrends.top.links, device: [], country: [], referrer: [], app: [] },
    }
    const wrapper = mount(AudiencePanels, { props: { trends, status: 'ready' } })
    expect(wrapper.text()).toContain('No audience data yet')
    expect(wrapper.text()).not.toContain('Device')
  })

  it('omits the App panel when app rows are empty', () => {
    const trends = {
      ...sampleTrends,
      top: { ...sampleTrends.top, app: [] },
    }
    const wrapper = mount(AudiencePanels, { props: { trends, status: 'ready' } })
    expect(wrapper.text()).toContain('Device')
    expect(wrapper.text()).not.toContain('App')
  })
})