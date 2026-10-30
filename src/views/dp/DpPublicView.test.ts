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

function campaignResponse(downloadCount?: number) {
  return new Response(JSON.stringify({
    status: 'ok',
    campaign: {
      id: 'camp-1',
      title: 'Launch',
      slug: 'launch',
      description: null,
      captionTemplate: null,
      ...(downloadCount === undefined ? {} : { downloadCount }),
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
  // Tests that opt in to sharing define these; start every test without them.
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
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

describe('DpPublicView share', () => {
  const shareButton = (wrapper: Awaited<ReturnType<typeof mountReady>>) =>
    wrapper.findAll('button').find((button) => button.text() === 'Share')

  function supportSharing(share = vi.fn().mockResolvedValue(undefined)) {
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    return share
  }

  async function addPhoto(wrapper: Awaited<ReturnType<typeof mountReady>>) {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()
  }

  it('is hidden when the browser cannot share files', async () => {
    expect(shareButton(await mountReady())).toBeUndefined()
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
    expect(shareButton(await mountReady())).toBeUndefined()
  })

  it('shares the rendered png as a file, counts a download and does not save it', async () => {
    const share = supportSharing()
    const wrapper = await mountReady()
    await addPhoto(wrapper)
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(share).toHaveBeenCalledTimes(1)
    const [data] = share.mock.calls[0] as [{ files: File[]; text?: string }]
    expect(data.files).toHaveLength(1)
    expect(data.files[0]!.type).toBe('image/png')
    expect(data.files[0]!.name).toMatch(/^eypi-dp-.*\.png$/)
    expect(saveAs).not.toHaveBeenCalled()
    expect(vi.mocked(sendModuleBeacon).mock.calls).toContainEqual(['frames', 'camp-1:frame-1', 'download'])
  })

  it('asks for a photo first', async () => {
    const share = supportSharing()
    const wrapper = await mountReady()
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(share).not.toHaveBeenCalled()
    expect(useToast().toasts.value.map((toast) => toast.message)).toContain('Upload a photo first.')
  })

  it('stays quiet and counts nothing when the share sheet is dismissed', async () => {
    supportSharing(vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')))
    const wrapper = await mountReady()
    await addPhoto(wrapper)
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(useToast().toasts.value).toHaveLength(0)
    expect(vi.mocked(sendModuleBeacon).mock.calls.some(([, , action]) => action === 'download')).toBe(false)
  })

  it('points to Download when sharing fails', async () => {
    supportSharing(vi.fn().mockRejectedValue(new Error('no target')))
    const wrapper = await mountReady()
    await addPhoto(wrapper)
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(useToast().toasts.value.map((toast) => toast.message)).toContain('Could not share. Try Download instead.')
    expect(vi.mocked(sendModuleBeacon).mock.calls.some(([, , action]) => action === 'download')).toBe(false)
  })

  it('sends the filled caption as the share text', async () => {
    const share = supportSharing()
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = (await campaignResponse().json()) as { campaign: { captionTemplate: string | null } }
      body.campaign.captionTemplate = 'Hi {{Name}}'
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = await mountReady()
    await addPhoto(wrapper)
    await wrapper.get('input[placeholder="Name"]').setValue('Ana')
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(share.mock.calls[0]![0]).toMatchObject({ text: 'Hi Ana' })
  })

  it('shares only the picture while a required field is empty, so no [Label] is sent', async () => {
    const share = supportSharing()
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = (await campaignResponse().json()) as { campaign: { captionTemplate: string | null } }
      body.campaign.captionTemplate = 'Hi {{Name}}'
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = await mountReady()
    await addPhoto(wrapper)
    await shareButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(share).toHaveBeenCalledTimes(1)
    expect(share.mock.calls[0]![0]).not.toHaveProperty('text')
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

describe('DpPublicView audit fixes', () => {
  it('keeps Download enabled and says what to do when no photo is chosen', async () => {
    const wrapper = await mountReady()
    const download = wrapper.findAll('button').find((button) => button.text() === 'Download')
    expect(download!.attributes('disabled')).toBeUndefined()
    await download!.trigger('click')
    await flushPromises()
    expect(useToast().toasts.value.map((toast) => toast.message)).toContain('Upload a photo first.')
    expect(vi.mocked(saveAs)).not.toHaveBeenCalled()
  })

  it('titles the tab with the campaign name once loaded', async () => {
    document.title = 'Frame · Eypi'
    await mountReady()
    expect(document.title).toBe('Launch · Eypi')
  })

  it('caps the canvas height so the controls stay near the fold on desktop', async () => {
    const wrapper = await mountReady()
    expect(wrapper.get('canvas').element.parentElement!.className).toContain('lg:max-w-[70dvh]')
  })

  it('only animates the canvas wrapper when motion is allowed', async () => {
    const wrapper = await mountReady()
    const classes = wrapper.get('canvas').element.parentElement!.className.split(/\s+/)
    expect(classes).toContain('motion-safe:transition-all')
    expect(classes).toContain('motion-safe:duration-300')
    expect(classes).not.toContain('transition-all')
    expect(classes).not.toContain('duration-300')
  })
})

describe('DpPublicView canvas keyboard', () => {
  async function mountWithPhoto() {
    const drawImage = vi.fn()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage,
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
    // Return 0 so scheduleDraw is not left thinking a frame is pending after the synchronous callback.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 1200, close() {} })))
    const wrapper = await mountReady()
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()
    return { wrapper, drawImage }
  }

  it('canvas has role img, a label and tabindex 0', async () => {
    const wrapper = await mountReady()
    const canvas = wrapper.get('canvas')
    expect(canvas.attributes('role')).toBe('img')
    expect(canvas.attributes('aria-label')).toBe('Photo preview. Use arrow keys to move and plus or minus to zoom.')
    expect(canvas.attributes('tabindex')).toBe('0')
  })

  it('arrow keys on the canvas move the photo and plus zooms it', async () => {
    const { wrapper, drawImage } = await mountWithPhoto()
    const canvas = wrapper.get('canvas')
    const photoDraw = () => { const l = drawImage.mock.calls.filter((c) => typeof c[0].close === 'function'); return l[l.length - 1] }
    expect(photoDraw().slice(1, 5)).toEqual([0, 0, 1200, 1200])

    await canvas.trigger('keydown', { key: 'ArrowRight' })
    expect(photoDraw().slice(1, 5)).toEqual([10, 0, 1200, 1200])

    await canvas.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(photoDraw()[2]).toBe(40)

    await canvas.trigger('keydown', { key: '+' })
    expect(photoDraw()[3]).toBeCloseTo(1320)

    await canvas.trigger('keydown', { key: '0' })
    expect(photoDraw().slice(1, 5)).toEqual([0, 0, 1200, 1200])
  })

  it('ignores keys before a photo is loaded', async () => {
    const wrapper = await mountReady()
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true })
    wrapper.get('canvas').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('DpPublicView download count', () => {
  async function mountWithCount(count: number) {
    vi.stubGlobal('fetch', vi.fn(async () => campaignResponse(count)))
    return mountReady()
  }

  it('shows N downloads when the count is at least 1', async () => {
    const wrapper = await mountWithCount(2)
    expect(wrapper.get('[data-download-count]').text()).toBe('2 downloads')
  })

  it('says 1 download for one', async () => {
    const wrapper = await mountWithCount(1)
    expect(wrapper.get('[data-download-count]').text()).toBe('1 download')
  })

  it('formats thousands', async () => {
    const wrapper = await mountWithCount(1234)
    expect(wrapper.get('[data-download-count]').text()).toBe('1,234 downloads')
  })

  it('hides the count at 0', async () => {
    const wrapper = await mountWithCount(0)
    expect(wrapper.find('[data-download-count]').exists()).toBe(false)
  })

  it('hides the count when the payload has none', async () => {
    const wrapper = await mountReady()
    expect(wrapper.find('[data-download-count]').exists()).toBe(false)
  })
})

describe('DpPublicView caption fields', () => {
  const CAPTION = 'Hi, I am {{Name}} of {{Committee Name}}'

  async function mountWithCaption(caption: string) {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = (await campaignResponse().json()) as { campaign: { captionTemplate: string | null } }
      body.campaign.captionTemplate = caption
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    return { wrapper: await mountReady(), writeText }
  }

  const copy = async (wrapper: Awaited<ReturnType<typeof mountReady>>) => {
    await wrapper.findAll('button').find((b) => b.text() === 'Copy to clipboard')!.trigger('click')
    await flushPromises()
  }

  it('copies the filled caption', async () => {
    const { wrapper, writeText } = await mountWithCaption(CAPTION)
    const inputs = wrapper.findAll('input[aria-label]')
    await inputs[0]!.setValue('Ana')
    await inputs[1]!.setValue('Logistics')
    await copy(wrapper)
    expect(writeText).toHaveBeenCalledWith('Hi, I am Ana of Logistics')
  })

  it('opens the details form instead of copying while a required field is empty', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const { wrapper, writeText } = await mountWithCaption(CAPTION)
    await wrapper.findAll('input[aria-label]')[0]!.setValue('Ana')
    await copy(wrapper)
    expect(writeText).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Add your details')
    expect(vi.mocked(sendModuleBeacon).mock.calls.some(([, , action]) => action === 'share')).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('copies without an optional field that was left empty', async () => {
    const { wrapper, writeText } = await mountWithCaption('Hi {{Name}} {{Nickname?}} from APC')
    await wrapper.findAll('input[aria-label]')[0]!.setValue('Ana')
    await copy(wrapper)
    expect(writeText).toHaveBeenCalledWith('Hi Ana from APC')
  })

  it('never puts an answer in a beacon call', async () => {
    const { wrapper } = await mountWithCaption(CAPTION)
    const inputs = wrapper.findAll('input[aria-label]')
    await inputs[0]!.setValue('SecretName')
    await inputs[1]!.setValue('SecretGroup')
    await copy(wrapper)
    expect(vi.mocked(sendModuleBeacon).mock.calls.some(([, , action]) => action === 'share')).toBe(true)
    expect(JSON.stringify(vi.mocked(sendModuleBeacon).mock.calls)).not.toContain('SecretName')
  })
})

describe('DpPublicView details dialog', () => {
  const CAPTION = 'Hi, I am {{Name}}'
  const dialogText = () => document.body.textContent ?? ''

  async function mountReadyWithCaption(caption: string | null) {
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = (await campaignResponse().json()) as { campaign: { captionTemplate: string | null } }
      body.campaign.captionTemplate = caption
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    return mountReady()
  }

  async function addPhoto(wrapper: Awaited<ReturnType<typeof mountReady>>) {
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    chooseFile(input, new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' }))
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()
  }

  async function clickDownload(wrapper: Awaited<ReturnType<typeof mountReady>>) {
    await wrapper.findAll('button').find((b) => b.text() === 'Download')!.trigger('click')
    await flushPromises()
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens after a successful download when a field is empty, scrolling to the caption first', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    expect(dialogText()).not.toContain('Add your details')
    await clickDownload(wrapper)
    expect(saveAs).toHaveBeenCalled()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(dialogText()).toContain('Add your details')
    wrapper.unmount()
  })

  it('scrolls to the caption instantly so the dialog cannot interrupt it', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
    wrapper.unmount()
  })

  it('no longer calls the removed download counter endpoint', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(saveAs).toHaveBeenCalled()
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.endsWith('/download'))).toBe(false)
    wrapper.unmount()
  })

  it('still sends the download beacon when the dialog opens', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(vi.mocked(sendModuleBeacon).mock.calls).toContainEqual(['frames', 'camp-1:frame-1', 'download'])
    wrapper.unmount()
  })

  it('does not open when every field is answered', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await wrapper.get('input[aria-label="Name"]').setValue('Ana')
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('does not open after a download when only optional fields are empty', async () => {
    const wrapper = await mountReadyWithCaption('Hi {{Nickname?}}')
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(saveAs).toHaveBeenCalled()
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('does not open for a caption without fields', async () => {
    const wrapper = await mountReadyWithCaption('Hello #eypi')
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(saveAs).toHaveBeenCalled()
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('does not open when there is no photo', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await clickDownload(wrapper)
    expect(saveAs).not.toHaveBeenCalled()
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('does not open when the download fails', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    vi.mocked(saveAs).mockImplementationOnce(() => { throw new Error('disk full') })
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('copies the full caption straight away when the details form is submitted', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    const dialogInput = document.body.querySelector<HTMLInputElement>('[role="dialog"] input')!
    dialogInput.value = 'Ana'
    dialogInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const copy = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Copy caption')!
    copy.click()
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('Hi, I am Ana')
    expect(vi.mocked(sendModuleBeacon).mock.calls).toContainEqual(['frames', 'camp-1:frame-1', 'share'])
    expect(dialogText()).not.toContain('Add your details')
    wrapper.unmount()
  })

  it('centres the title and description', async () => {
    const wrapper = await mountReadyWithCaption(null)
    expect(wrapper.get('header').classes()).toContain('text-center')
    wrapper.unmount()
  })

  it('fills the inline field as the visitor types in the dialog', async () => {
    const wrapper = await mountReadyWithCaption(CAPTION)
    await addPhoto(wrapper)
    await clickDownload(wrapper)
    const dialogInput = document.body.querySelector<HTMLInputElement>('[role="dialog"] input')!
    dialogInput.value = 'Ana'
    dialogInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect((wrapper.get('input[aria-label="Name"]').element as HTMLInputElement).value).toBe('Ana')
    wrapper.unmount()
  })
})
