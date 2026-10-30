// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { PRESETS, clampSize } from '@/lib/wallpaper/sizes'
import type { LayoutId, ThemeName } from '@/lib/wallpaper/types'
import WallpaperControls from './WallpaperControls.vue'

const base = {
  layout: 'agenda' as LayoutId,
  theme: 'dark' as ThemeName,
  dim: 0.45,
  size: { width: 1170, height: 2532 },
  photoName: null as string | null,
  photoNotice: null as string | null,
  photoError: null as string | null,
}

const mountControls = (props: Record<string, unknown> = {}) => mount(WallpaperControls, { props: { ...base, ...props } })
const tab = (wrapper: ReturnType<typeof mountControls>, label: string) =>
  wrapper.findAll('[data-slot="tabs-trigger"]').find((node) => node.text() === label)!

describe('WallpaperControls', () => {
  it('selects the layout tab that matches the prop', () => {
    const wrapper = mountControls({ layout: 'grid' })
    expect(tab(wrapper, 'Grid').attributes('data-state')).toBe('active')
    expect(tab(wrapper, 'Agenda').attributes('data-state')).toBe('inactive')
  })

  it('emits the layout when a tab is chosen', async () => {
    const wrapper = mountControls()
    await tab(wrapper, 'Cards').trigger('mousedown', { button: 0 })
    expect(wrapper.emitted('update:layout')?.[0]).toEqual(['cards'])
  })

  it('emits the theme when a theme tab is chosen', async () => {
    const wrapper = mountControls()
    await tab(wrapper, 'True black').trigger('mousedown', { button: 0 })
    expect(wrapper.emitted('update:theme')?.[0]).toEqual(['black'])
  })

  it('emits a preset size', async () => {
    const wrapper = mountControls()
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 'pixel-8')
    const pixel = PRESETS.find((preset) => preset.id === 'pixel-8')!
    expect(wrapper.emitted('update:size')?.[0]).toEqual([{ width: pixel.width, height: pixel.height }])
  })

  it('shows width and height for a custom size and clamps what is entered', async () => {
    const wrapper = mountControls()
    expect(wrapper.findAll('input[type="number"]')).toHaveLength(0)
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 'custom')
    await wrapper.vm.$nextTick()
    const [width, height] = wrapper.findAll('input[type="number"]')
    await width.setValue('99999')
    await width.trigger('blur')
    await height.setValue('99999')
    await height.trigger('blur')
    const emitted = wrapper.emitted('update:size')!
    expect(emitted[emitted.length - 1]).toEqual([clampSize({ width: 99999, height: 99999 })])
  })

  it('shows the dimming as a percent and emits the new level', () => {
    const wrapper = mountControls()
    expect(wrapper.text()).toContain('45%')
    wrapper.findComponent(Slider).vm.$emit('update:modelValue', [60])
    expect(wrapper.emitted('update:dim')?.[0]).toEqual([0.6])
  })

  it('emits the chosen photo file', async () => {
    const wrapper = mountControls()
    const input = wrapper.get('input[type="file"]')
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(wrapper.emitted('photo')?.[0]).toEqual([file])
  })

  it('offers Remove photo only when there is a photo', async () => {
    expect(mountControls().text()).not.toContain('Remove photo')
    const wrapper = mountControls({ photoName: 'lake.jpg' })
    expect(wrapper.text()).toContain('lake.jpg')
    const remove = wrapper.findAll('button').find((node) => node.text() === 'Remove photo')!
    await remove.trigger('click')
    expect(wrapper.emitted('clearPhoto')).toHaveLength(1)
  })

  it('shows the photo notice and error as text', () => {
    const wrapper = mountControls({ photoNotice: 'This photo is small.', photoError: 'Choose an image file.' })
    expect(wrapper.text()).toContain('This photo is small.')
    expect(wrapper.text()).toContain('Choose an image file.')
  })
})
