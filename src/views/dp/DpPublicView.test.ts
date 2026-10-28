// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAs } from 'file-saver'
import DpPublicView from './DpPublicView.vue'
import { useToast } from '@/composables/useToast'
import { sendModuleBeacon } from '@/lib/beacon'

vi.mock('@/lib/beacon', () => ({ sendModuleBeacon: vi.fn() }))

vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'launch' } }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const PHOTO_ERROR = "We couldn't read that photo. Try a JPG or PNG."

function campaignResponse() {
  return new Response(JSON.stringify({
    status: 'ok',
    campaign: {
      id: 'camp-1',
      title: 'Launch',
      slug: 'launch',
      description: null,
      captionTemplate: null,
      frames: [{
        id: 'frame-1',
        imageUrl: '/media/frames/camp-1/frame.png',
        url: '/media/frames/camp-1/frame.png',
        label: null,
        width: 1200,
        height: 1200,
        position: 0,
      }],
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

class FakeImage {
  naturalWidth = 1200
  naturalHeight = 1200
  width = 1200
  height = 1200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

async function mountReady() {
  const wrapper = mount(DpPublicView, {
    global: { stubs: { RouterLink: true } },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  let cleared = false
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => (cleared ? '' : 'C:\\photo'),
    set: (value: string) => {
      cleared = value === ''
    },
  })
  return {
    wasCleared: () => cleared,
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('fetch', vi.fn(async () => campaignResponse()))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
    callback(new Blob(['png'], { type: 'image/png' }))
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  vi.mocked(saveAs).mockReset()
  vi.mocked(sendModuleBeacon).mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DpPublicView photos', () => {
  it('downscales a photo so the longest side is at most 2160 px', async () => {
    const createImageBitmap = vi.fn(async (_source: unknown, options?: { resizeWidth?: number; resizeHeight?: number }) => {
      if (!options?.resizeWidth || !options.resizeHeight) return { width: 4000, height: 3000, close() {} }
      return { width: options.resizeWidth, height: options.resizeHeight, close() {} }
    })
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const wrapper = await mountReady()
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))

    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(createImageBitmap).toHaveBeenCalledTimes(2)
    expect(createImageBitmap.mock.calls[1]?.[1]).toMatchObject({ resizeWidth: 2160, resizeHeight: 1620 })
    const canvas = wrapper.get('canvas').element as HTMLCanvasElement
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(1200)
  })

  it('shows the photo error toast and resets the file input', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode')))
    const wrapper = await mountReady()
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    const file = chooseFile(input, new File([new Uint8Array([1])], 'photo.heic', { type: 'image/heic' }))

    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(useToast().toasts.value.map((toast) => toast.message)).toContain(PHOTO_ERROR)
    expect(file.wasCleared()).toBe(true)
  })

  it('saves the rendered photo to the device without opening the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    const wrapper = await mountReady()
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    const download = wrapper.findAll('button').find((button) => button.text() === 'Download')
    expect(download).toBeTruthy()
    await download!.trigger('click')
    await flushPromises()

    expect(share).not.toHaveBeenCalled()
    expect(vi.mocked(saveAs)).toHaveBeenCalledTimes(1)
    const [blob, filename] = vi.mocked(saveAs).mock.calls[0]
    expect((blob as Blob).type).toBe('image/png')
    expect(filename).toMatch(/^eypi-dp-.*\.png$/)
  })
})

describe('DpPublicView mobile controls', () => {
  it('uses AppPage, 44px shape toggles and no tiny text controls', async () => {
    const wrapper = await mountReady()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('text-[0.65rem]')
    const shape = wrapper.findAll('button').find((b) => b.text() === 'Circle Preview')
    expect(shape!.classes().join(' ')).toContain('min-h-11')
  })
})

describe('DpPublicView beacons', () => {
  it('sends view as soon as the campaign loads, before the frame images do', async () => {
    class StalledImage extends FakeImage {
      set src(_value: string) { /* never loads */ }
    }
    vi.stubGlobal('Image', StalledImage)
    mount(DpPublicView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(vi.mocked(sendModuleBeacon).mock.calls).toEqual([['frames', 'camp-1', 'view']])
  })

  it('sends a share beacon for the selected frame when the caption is copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = (await campaignResponse().json()) as { campaign: { captionTemplate: string | null } }
      body.campaign.captionTemplate = 'Hello #eypi'
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = await mountReady()
    const copy = wrapper.findAll('button').find((button) => button.text() === 'Copy to clipboard')
    expect(copy).toBeTruthy()
    await copy!.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('Hello #eypi')
    expect(vi.mocked(sendModuleBeacon).mock.calls).toEqual([
      ['frames', 'camp-1', 'view'],
      ['frames', 'camp-1:frame-1', 'share'],
    ])
  })

  it('sends view once per page load, then photo_added and download', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    const wrapper = await mountReady()
    expect(vi.mocked(sendModuleBeacon).mock.calls).toEqual([['frames', 'camp-1', 'view']])

    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()
    const download = wrapper.findAll('button').find((button) => button.text() === 'Download')
    await download!.trigger('click')
    await flushPromises()

    expect(vi.mocked(sendModuleBeacon).mock.calls).toEqual([
      ['frames', 'camp-1', 'view'],
      ['frames', 'camp-1', 'photo_added'],
      ['frames', 'camp-1:frame-1', 'download'],
    ])
  })
})
