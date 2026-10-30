// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_TERM2 } from '@shared/schedule/fixtures'
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
