// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoothWindow } from '@shared/boothWindows'
import BoothStudio from './BoothStudio.vue'
import { boothDepsKey, type BoothDeps } from './boothDeps'

const WINDOWS: BoothWindow[] = [
  { x: 90, y: 120, w: 900, h: 500 },
  { x: 90, y: 700, w: 900, h: 500 },
  { x: 90, y: 1280, w: 900, h: 500 },
]

const frame = { naturalWidth: 1080, naturalHeight: 1920, width: 1080, height: 1920 } as unknown as HTMLImageElement

let captures: HTMLCanvasElement[] = []
/** Size of each canvas at the moment it was exported. */
let blobSizes: { width: number; height: number }[] = []

function fakeStream() {
  const track = { stop: vi.fn() }
  // happy-dom's MediaStream, so the video element accepts it as srcObject; the tracks are fakes.
  const stream = new MediaStream()
  stream.getTracks = () => [track as unknown as MediaStreamTrack]
  return { stream, track }
}

function makeDeps(overrides: Partial<BoothDeps> = {}) {
  const streams: ReturnType<typeof fakeStream>[] = []
  const openCamera = vi.fn(async () => {
    const s = fakeStream()
    streams.push(s)
    return s.stream
  })
  return {
    deps: { openCamera, userAgent: () => 'Mozilla/5.0 Chrome/130', isSecureContext: () => true, ...overrides },
    openCamera,
    streams,
  }
}

function mountStudio(deps: Partial<BoothDeps>, windows = WINDOWS) {
  return mount(BoothStudio, {
    props: { frame, windows },
    global: { provide: { [boothDepsKey as symbol]: deps } },
    attachTo: document.body,
  })
}

const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text || b.attributes('aria-label') === text)

async function openCamera(wrapper: VueWrapper) {
  await button(wrapper, 'Open camera')!.trigger('click')
  await flushPromises()
}

async function runAllShots() {
  for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(4000)
  await flushPromises()
}

function pickFiles(wrapper: VueWrapper, count: number) {
  const input = wrapper.get('input[type="file"]')
  const files = Array.from({ length: count }, (_, i) => new File([new Uint8Array([i])], `p${i}.jpg`, { type: 'image/jpeg' }))
  Object.defineProperty(input.element, 'files', { configurable: true, value: files })
  return input.trigger('change')
}

beforeEach(() => {
  vi.useFakeTimers()
  captures = []
  blobSizes = []
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1080, height: 1440, close: vi.fn() })))
  HTMLCanvasElement.prototype.getContext = vi.fn(function getContext(this: HTMLCanvasElement) {
    return stubContext(this)
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toBlob = vi.fn(function toBlob(this: HTMLCanvasElement, callback: BlobCallback) {
    blobSizes.push({ width: this.width, height: this.height })
    callback(new Blob(['png'], { type: 'image/png' }))
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 })
  HTMLMediaElement.prototype.play = vi.fn(async () => {})
})

/** A 2D context stub that records every capture (a camera frame drawn onto a large canvas). */
function stubContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    drawImage: vi.fn((source: unknown) => {
      if (source instanceof HTMLVideoElement && canvas.width >= 600) captures.push(canvas)
    }),
    clearRect: vi.fn(),
    putImageData: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  }
}

const lastReady = (wrapper: VueWrapper) => {
  const events = wrapper.emitted('update:ready') ?? []
  return events[events.length - 1]
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('BoothStudio camera', () => {
  it('shows the live preview and window outline once the camera opens', async () => {
    const { deps, openCamera: open, streams } = makeDeps()
    const wrapper = mountStudio(deps)
    expect(wrapper.find('[data-booth-viewfinder]').exists()).toBe(false)
    await openCamera(wrapper)
    expect(open).toHaveBeenCalledWith('user')
    const viewfinder = wrapper.get('[data-booth-viewfinder]')
    expect(viewfinder.attributes('style')).toContain('aspect-ratio: 900 / 500')
    expect(wrapper.find('[data-booth-outline]').exists()).toBe(true)
    expect((wrapper.get('video').element as HTMLVideoElement & { srcObject: unknown }).srcObject).toBe(streams[0]!.stream)
    expect(wrapper.get('[data-booth-preview]').classes()).toContain('-scale-x-100')
    wrapper.unmount()
  })

  it('Start runs the countdown and fills 3 windows', async () => {
    const { deps } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    await button(wrapper, 'Start')!.trigger('click')
    await runAllShots()
    expect(captures).toHaveLength(3)
    for (const c of captures) expect(c.width).toBeLessThanOrEqual(1080)
    expect(lastReady(wrapper)).toEqual([true])
    expect(wrapper.findAll('button').filter((b) => /^Retake shot \d$/.test(b.attributes('aria-label') ?? ''))).toHaveLength(3)
    wrapper.unmount()
  })

  it('tapping a window retakes only that shot', async () => {
    const { deps, openCamera: open } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    await button(wrapper, 'Start')!.trigger('click')
    await runAllShots()
    const [first, second, third] = captures
    await button(wrapper, 'Retake shot 2')!.trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(captures).toHaveLength(4)
    expect(second!.width).toBe(0)
    expect(first!.width).toBe(1080)
    expect(third!.width).toBe(1080)
    expect(lastReady(wrapper)).toEqual([true])
    wrapper.unmount()
  })

  it('Start is ignored while a countdown runs', async () => {
    const { deps } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    await button(wrapper, 'Start')!.trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    expect(button(wrapper, 'Start')!.attributes('disabled')).toBeDefined()
    await button(wrapper, 'Start')!.trigger('click')
    await runAllShots()
    expect(captures).toHaveLength(3)
    wrapper.unmount()
  })

  it('the countdown is announced in an aria-live region', async () => {
    const { deps } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    const live = () => wrapper.get('[data-booth-announce]')
    expect(live().attributes('aria-live')).toBe('polite')
    await button(wrapper, 'Start')!.trigger('click')
    expect(live().text()).toBe('Shot 1 of 3. 3')
    await vi.advanceTimersByTimeAsync(1000)
    expect(live().text()).toBe('2')
    await vi.advanceTimersByTimeAsync(1000)
    expect(live().text()).toBe('1')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(live().text()).toBe('Smile! Shot 1 taken.')
    expect(wrapper.text()).toContain('Shot 1 of 3')
    wrapper.unmount()
  })

  it('flip button switches facing', async () => {
    const { deps, openCamera: open, streams } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    await button(wrapper, 'Switch to back camera')!.trigger('click')
    await flushPromises()
    expect(open).toHaveBeenLastCalledWith('environment')
    expect(streams[0]!.track.stop).toHaveBeenCalled()
    expect(wrapper.get('[data-booth-preview]').classes()).not.toContain('-scale-x-100')
    expect(button(wrapper, 'Switch to front camera')).toBeTruthy()
    wrapper.unmount()
  })

  it('leaving the page stops every camera track', async () => {
    const { deps, streams } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    wrapper.unmount()
    expect(streams[0]!.track.stop).toHaveBeenCalled()
  })
})

describe('BoothStudio filters', () => {
  it('filter chips change the filter and the label of the active one is announced', async () => {
    const { deps } = makeDeps()
    const wrapper = mountStudio(deps)
    const chips = wrapper.get('[role="group"][aria-label="Filter"]').findAll('button')
    expect(chips.map((c) => c.text())).toEqual(['Normal', 'Soft', 'Bright', 'Warm', 'Cool', 'Film', 'Matte', 'B&W', 'Vivid'])
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    await chips[3]!.trigger('click')
    expect(chips[3]!.attributes('aria-pressed')).toBe('true')
    expect(chips[0]!.attributes('aria-pressed')).toBe('false')
    const status = wrapper.get('[data-booth-filter-status]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('Filter: Warm')
    wrapper.unmount()
  })
})

describe('BoothStudio fallbacks', () => {
  it('denied permission shows the allow-camera message and the Choose photos button', async () => {
    const { deps } = makeDeps({ openCamera: vi.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' })) })
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('Allow the camera')
    expect(button(wrapper, 'Choose photos instead')).toBeTruthy()
    wrapper.unmount()
  })

  it('an in-app browser shows Open in your browser guidance', async () => {
    const { deps } = makeDeps({ userAgent: () => 'Mozilla/5.0 (iPhone) Instagram 300.0' })
    const wrapper = mountStudio(deps)
    expect(wrapper.text()).toContain('Open in your browser')
    expect(button(wrapper, 'Choose photos instead')).toBeTruthy()
    wrapper.unmount()
  })

  it('Choose photos instead fills windows from picked files', async () => {
    const { deps, streams } = makeDeps()
    const wrapper = mountStudio(deps)
    await openCamera(wrapper)
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('accept')).toBe('image/*')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click').mockImplementation(() => {})
    await button(wrapper, 'Choose photos instead')!.trigger('click')
    expect(click).toHaveBeenCalled()
    expect(streams[0]!.track.stop).toHaveBeenCalled()
    await pickFiles(wrapper, 2)
    await flushPromises()
    expect(button(wrapper, 'Replace photo 1')).toBeTruthy()
    expect(button(wrapper, 'Replace photo 2')).toBeTruthy()
    expect(button(wrapper, 'Choose photo 3')).toBeTruthy()
    expect(lastReady(wrapper)).toEqual([false])
    await pickFiles(wrapper, 1)
    await flushPromises()
    expect(button(wrapper, 'Replace photo 3')).toBeTruthy()
    expect(lastReady(wrapper)).toEqual([true])
    wrapper.unmount()
  })
})

describe('BoothStudio export', () => {
  it('renderPng returns null before 3 shots and a PNG blob after', async () => {
    const { deps } = makeDeps()
    const wrapper = mountStudio(deps)
    const vm = wrapper.vm as unknown as { renderPng: () => Promise<Blob | null> }
    expect(await vm.renderPng()).toBeNull()
    await button(wrapper, 'Choose photos instead')!.trigger('click')
    await pickFiles(wrapper, 3)
    await flushPromises()
    blobSizes = []
    const blob = await vm.renderPng()
    expect(blob?.type).toBe('image/png')
    expect(blobSizes).toEqual([{ width: 1080, height: 1920 }])
    wrapper.unmount()
  })
})
