// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DpCampaignsView from './DpCampaignsView.vue'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    status: 'ok',
    campaigns: [{ id: 'c1', slug: 'launch', title: 'Launch', description: null, downloadCount: 2, frameCount: 1 }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})
afterEach(() => vi.unstubAllGlobals())

describe('DpCampaignsView', () => {
  it('uses AppPage, no nested main, and no in-page OrgSwitcher', async () => {
    const wrapper = mount(DpCampaignsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OrgSwitcher' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Launch')
  })
})
