// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DpEditCampaignView from './DpEditCampaignView.vue'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'launch-night' } }),
  useRouter: () => ({ replace, push: vi.fn() }),
}))

describe('DpEditCampaignView', () => {
  it('replaces the editor route when the slug changes', async () => {
    replace.mockReset()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify({ status: 'ok', slug: 'reunion' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({
        status: 'ok',
        campaign: {
          id: 'camp-1',
          title: 'Launch',
          slug: 'launch-night',
          description: '',
          captionTemplate: '',
          frames: [],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const wrapper = mount(DpEditCampaignView, {
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()

    const save = wrapper.findAll('button').find((button) => button.text() === 'Save Details')
    expect(save).toBeTruthy()
    await save!.trigger('click')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith({ name: 'dp-edit', params: { slug: 'reunion' } })
    wrapper.unmount()
  })
})
