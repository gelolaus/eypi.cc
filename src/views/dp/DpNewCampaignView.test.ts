// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DpNewCampaignView from './DpNewCampaignView.vue'

describe('DpNewCampaignView', () => {
  it('renders inside AppPage with no nested main', () => {
    const wrapper = mount(DpNewCampaignView, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('source keeps the post-create Copy button at 44px', async () => {
    const src = (await import('./DpNewCampaignView.vue?raw')).default as string
    const m = src.match(/class="([^"]*)"\s+@click="copyShare"/)
    expect(src).not.toMatch(/<Button[^>]*size="(xs|sm)"[^>]*@click="copyShare"/)
    expect(m?.[1]).toContain('min-w-11')
  })
})
