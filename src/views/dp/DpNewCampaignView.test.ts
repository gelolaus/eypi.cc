// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import DpNewCampaignView from './DpNewCampaignView.vue'

const { uploadVariants } = vi.hoisted(() => ({ uploadVariants: vi.fn() }))
vi.mock('@/lib/images/uploadVariants', () => ({ uploadVariants }))

describe('DpNewCampaignView variants', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    uploadVariants.mockReset()
  })

  async function create(response: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })))
    const wrapper = mount(DpNewCampaignView, { global: { stubs: { RouterLink: true } } })
    const files = [new File([new Uint8Array([1])], 'a.png'), new File([new Uint8Array([2])], 'b.png')]
    const uploader = wrapper.getComponent(DpFrameUploader)
    uploader.vm.$emit('add', 'data:image/png;base64,AA', files[0])
    uploader.vm.$emit('add', 'data:image/png;base64,BB', files[1])
    await wrapper.get('input[type="text"]').setValue('Launch')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    return { wrapper, files }
  }

  it('uploads variants for each new frame with the returned keys', async () => {
    uploadVariants.mockResolvedValue(null)
    const { wrapper, files } = await create({
      status: 'ok',
      campaign: { id: 'c', slug: 'launch', frames: [{ key: 'frames/c/a-11111111.png' }, { key: 'frames/c/b-22222222.png' }] },
    })
    expect(uploadVariants).toHaveBeenNthCalledWith(1, files[0], 'frame', 'frames/c/a-11111111.png')
    expect(uploadVariants).toHaveBeenNthCalledWith(2, files[1], 'frame', 'frames/c/b-22222222.png')
    expect(wrapper.text()).toContain('eypi.cc/frames/launch')
    wrapper.unmount()
  })

  it('still finishes the create when variants fail', async () => {
    uploadVariants.mockRejectedValue(new Error('boom'))
    const { wrapper } = await create({
      status: 'ok',
      campaign: { id: 'c', slug: 'launch', frames: [{ key: 'frames/c/a-11111111.png' }, { key: 'frames/c/b-22222222.png' }] },
    })
    expect(wrapper.text()).toContain('eypi.cc/frames/launch')
    wrapper.unmount()
  })
})

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
