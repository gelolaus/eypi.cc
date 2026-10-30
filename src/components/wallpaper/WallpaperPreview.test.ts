// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRams } from '@shared/schedule/parseRams'
import { SAMPLE_TERM2 } from '@shared/schedule/fixtures'
import type { RenderInput } from '@/lib/wallpaper/types'

const render = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/wallpaper/render', () => ({ render }))

import WallpaperPreview from './WallpaperPreview.vue'

const input = (overrides: Partial<RenderInput> = {}): RenderInput => ({
  schedule: parseRams(SAMPLE_TERM2),
  width: 1170,
  height: 2532,
  theme: 'dark',
  layout: 'agenda',
  photo: null,
  dim: 0.45,
  ...overrides,
})

describe('WallpaperPreview', () => {
  beforeEach(() => {
    render.mockClear()
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('draws on mount and again when the layout changes', async () => {
    const wrapper = mount(WallpaperPreview, { props: { input: input() } })
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBe(wrapper.find('canvas').element)
    expect(render.mock.calls[0][1]).toMatchObject({ layout: 'agenda', theme: 'dark', dim: 0.45 })
    await wrapper.setProps({ input: input({ layout: 'grid' }) })
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1][1]).toMatchObject({ layout: 'grid' })
  })

  it('draws at a reduced size with the same shape as the output', () => {
    mount(WallpaperPreview, { props: { input: input() } })
    const drawn = render.mock.calls[0][1] as RenderInput
    expect(drawn.width).toBeLessThan(1170)
    expect(drawn.width / drawn.height).toBeCloseTo(1170 / 2532, 2)
  })

  it('describes the classes by day for assistive tech', () => {
    const label = mount(WallpaperPreview, { props: { input: input() } }).find('canvas').attributes('aria-label')!
    expect(label).toContain('Wallpaper preview.')
    expect(label).toContain('Tue · Fri')
    expect(label).toContain('MIKE1')
  })

  it('says so when the preview cannot be drawn', async () => {
    render.mockRejectedValueOnce(new Error('no canvas'))
    const wrapper = mount(WallpaperPreview, { props: { input: input() } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Could not draw the preview.')
    render.mockResolvedValue(undefined)
    await wrapper.setProps({ input: input({ layout: 'grid' }) })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('says there are no classes for an empty schedule', () => {
    const empty = input({ schedule: { term: null, subjects: [], warnings: [] } })
    const label = mount(WallpaperPreview, { props: { input: empty } }).find('canvas').attributes('aria-label')
    expect(label).toContain('No classes to show.')
  })
})
