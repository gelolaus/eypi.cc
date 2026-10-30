// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_TERM2, wholePage } from '@shared/schedule/fixtures'
import { saveAs } from 'file-saver'
import { renderToBlob } from '@/lib/wallpaper/render'
import { useToast } from '@/composables/useToast'
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))
vi.mock('@/lib/wallpaper/render', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wallpaper/render')>()),
  renderToBlob: vi.fn(),
}))

import WallpaperView from './WallpaperView.vue'

const PreviewStub = {
  name: 'WallpaperPreview',
  props: ['input'],
  template: '<div data-test="preview">{{ input.schedule.subjects.length }}</div>',
}
const ControlsStub = { name: 'WallpaperControls', template: '<div data-test="controls" />' }

const mountView = () =>
  mount(WallpaperView, { global: { stubs: { WallpaperPreview: PreviewStub, WallpaperControls: ControlsStub } } })

async function paste(wrapper: ReturnType<typeof mountView>, value: string) {
  await wrapper.get('textarea').setValue(value)
  vi.advanceTimersByTime(150)
  await flushPromises()
}

const EMPTY = 'Paste your schedule to see your wallpaper.'
const NOT_FOUND = 'We could not find a class schedule in that text. Copy the whole page from RAMS and paste it again.'

describe('WallpaperView', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the empty state until a schedule is pasted, then the preview', async () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain(EMPTY)
    expect(wrapper.find('[data-test="preview"]').exists()).toBe(false)
    await paste(wrapper, SAMPLE_TERM2)
    expect(wrapper.text()).not.toContain(EMPTY)
    expect(wrapper.get('[data-test="preview"]').text()).toBe('5')
    await wrapper.findAll('button').find((b) => b.text() === 'Clear')!.trigger('click')
    vi.advanceTimersByTime(150)
    await flushPromises()
    expect(wrapper.text()).toContain(EMPTY)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('explains when the text holds no schedule', async () => {
    const wrapper = mountView()
    await wrapper.get('textarea').setValue('hello')
    expect(wrapper.text()).not.toContain(NOT_FOUND)
    vi.advanceTimersByTime(150)
    await flushPromises()
    expect(wrapper.text()).toContain(NOT_FOUND)
    expect(wrapper.find('[data-test="preview"]').exists()).toBe(false)
  })

  it('lists parser warnings in a status region and still shows the other rows', async () => {
    const wrapper = mountView()
    const broken = 'XYZ1 AB101 3.0\nMonday\nThursday\n9:30AM - 11:30AM\n502\n502\nLast, First'
    await paste(wrapper, `${SAMPLE_TERM2}\n${broken}`)
    expect(wrapper.get('[role="status"]').text()).toContain('XYZ1')
    expect(Number(wrapper.get('[data-test="preview"]').text())).toBe(6)
  })

  it('limits the paste box to the parser cap', () => {
    expect(mountView().get('textarea').attributes('maxlength')).toBe('100000')
  })

  it('hides Paste from clipboard where the browser cannot read it', () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    expect(mountView().text()).not.toContain('Paste from clipboard')
  })

  it('fills the box from the clipboard when it can', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn().mockResolvedValue(SAMPLE_TERM2) } })
    const wrapper = mountView()
    await wrapper.findAll('button').find((b) => b.text() === 'Paste from clipboard')!.trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(150)
    await flushPromises()
    expect(wrapper.get('[data-test="preview"]').text()).toBe('5')
  })
})

describe('WallpaperView download and share', () => {
  const FILENAME = 'eypi-schedule-2026-2027-term-2.png'
  const PNG = new Blob(['x'], { type: 'image/png' })
  const page = () => wholePage(SAMPLE_TERM2, '2026 -2027, Term 2')
  const button = (wrapper: ReturnType<typeof mountView>, label: string) => wrapper.findAll('button').find((b) => b.text() === label)
  const messages = () => useToast().toasts.value.map((toast) => toast.message)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(saveAs).mockReset()
    vi.mocked(renderToBlob).mockReset().mockResolvedValue(PNG)
    const toast = useToast()
    while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('disables Download until there is a schedule', async () => {
    const wrapper = mountView()
    expect(button(wrapper, 'Download PNG')!.attributes('disabled')).toBeDefined()
    await paste(wrapper, page())
    expect(button(wrapper, 'Download PNG')!.attributes('disabled')).toBeUndefined()
  })

  it('renders at the full size, saves the png and says so', async () => {
    const wrapper = mountView()
    await paste(wrapper, page())
    await button(wrapper, 'Download PNG')!.trigger('click')
    await flushPromises()
    expect(renderToBlob).toHaveBeenCalledWith(expect.objectContaining({ width: 1170, height: 2532, layout: 'agenda', theme: 'dark' }))
    expect(saveAs).toHaveBeenCalledWith(PNG, FILENAME)
    expect(messages()).toContain('Downloaded. Set it as your lock screen.')
  })

  it('hides Share where files cannot be shared', async () => {
    const wrapper = mountView()
    await paste(wrapper, page())
    expect(button(wrapper, 'Share')).toBeUndefined()
  })

  it('shares the png as a file named like the download', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true })
    const wrapper = mountView()
    await paste(wrapper, page())
    await button(wrapper, 'Share')!.trigger('click')
    await flushPromises()
    const files = share.mock.calls[0][0].files as File[]
    expect(files[0]).toBeInstanceOf(File)
    expect(files[0].name).toBe(FILENAME)
    expect(messages()).toEqual([])
  })

  it('ignores a closed share sheet but reports other share failures', async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException('closed', 'AbortError')).mockRejectedValueOnce(new Error('no'))
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true })
    const wrapper = mountView()
    await paste(wrapper, page())
    await button(wrapper, 'Share')!.trigger('click')
    await flushPromises()
    expect(messages()).toEqual([])
    await button(wrapper, 'Share')!.trigger('click')
    await flushPromises()
    expect(messages()).toEqual(['Could not share. Try Download instead.'])
  })

  it('shows the render error and re-enables the buttons when rendering fails', async () => {
    vi.mocked(renderToBlob).mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountView()
    await paste(wrapper, page())
    await button(wrapper, 'Download PNG')!.trigger('click')
    await flushPromises()
    expect(messages()).toEqual(['Could not render the image. Try again.'])
    expect(saveAs).not.toHaveBeenCalled()
    expect(button(wrapper, 'Download PNG')!.attributes('disabled')).toBeUndefined()
  })
})
