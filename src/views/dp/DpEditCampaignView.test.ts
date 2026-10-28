// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import DpEditCampaignView from './DpEditCampaignView.vue'

const { uploadVariants } = vi.hoisted(() => ({ uploadVariants: vi.fn() }))
vi.mock('@/lib/images/uploadVariants', () => ({ uploadVariants }))

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

  async function addFrame(variants: () => Promise<unknown>) {
    uploadVariants.mockReset()
    uploadVariants.mockImplementation(variants)
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.method === 'POST'
        ? { status: 'ok', frame: { id: 'f-new', key: 'frames/camp-1/f-new-aaaaaaaa.png', url: '/media/frames/camp-1/f-new-aaaaaaaa.png', position: 0 } }
        : { status: 'ok', campaign: { id: 'camp-1', title: 'Launch', slug: 'launch-night', description: '', captionTemplate: '', frames: [] } }
      return new Response(JSON.stringify(body), { status: init?.method === 'POST' ? 201 : 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = mount(DpEditCampaignView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    const file = new File([new Uint8Array([1])], 'f.png', { type: 'image/png' })
    wrapper.getComponent(DpFrameUploader).vm.$emit('add', 'data:image/png;base64,AA', file)
    await flushPromises()
    return { wrapper, file }
  }

  it('uploads variants for an added frame and shows its meta', async () => {
    const meta = { w: 1080, h: 1080, fmt: 'webp', widths: [256, 512, 1024], ph: '' }
    const { wrapper, file } = await addFrame(async () => meta)
    expect(uploadVariants).toHaveBeenCalledWith(file, 'frame', 'frames/camp-1/f-new-aaaaaaaa.png')
    const frames = wrapper.getComponent(DpFrameUploader).props('frames')
    expect(frames).toHaveLength(1)
    expect(frames[0].meta).toEqual(meta)
    wrapper.unmount()
  })

  it('keeps the added frame when variants fail', async () => {
    const { wrapper } = await addFrame(async () => {
      throw new Error('boom')
    })
    const frames = wrapper.getComponent(DpFrameUploader).props('frames')
    expect(frames).toHaveLength(1)
    expect(frames[0].meta).toBeUndefined()
    wrapper.unmount()
  })
})

describe('DpEditCampaignView insights tab', () => {
  it('loads the insights for the campaign only after the tab is opened', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = String(url).includes('/insights')
        ? { funnel: { view: 0, photo_added: 0, downloadOrShare: 0 }, conversion: 0, perFrame: [], daily: [] }
        : { status: 'ok', campaign: { id: 'camp-1', title: 'Launch', slug: 'launch-night', description: '', captionTemplate: '', frames: [] } }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(DpEditCampaignView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/insights'))).toBe(false)
    await wrapper.findAll('[role="tab"]').find((t) => t.text() === 'Insights')!.trigger('click')
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/dp/camp-1/insights'))).toBe(true))
    wrapper.unmount()
  })
})
