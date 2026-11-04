// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DpFrameUploader from './DpFrameUploader.vue'

const { detectWindowsFromDataUrl } = vi.hoisted(() => ({ detectWindowsFromDataUrl: vi.fn() }))
vi.mock('@/lib/booth/detectWindows', () => ({ detectWindowsFromDataUrl }))

const frames = [
  { id: 'a', src: 'data:image/png;base64,aaaa' },
  { id: 'b', src: 'data:image/png;base64,bbbb' },
]

describe('DpFrameUploader', () => {
  it('moves a frame up and down from buttons', async () => {
    const wrapper = mount(DpFrameUploader, { props: { frames } })
    const down = wrapper.findAll('[aria-label="Move down"]')
    const up = wrapper.findAll('[aria-label="Move up"]')

    expect(down).toHaveLength(2)
    expect(up).toHaveLength(2)
    expect(up[0].attributes('disabled')).toBeDefined()
    expect(down[1].attributes('disabled')).toBeDefined()

    await down[0].trigger('click')
    expect(wrapper.emitted('reorder')?.[0]).toEqual([0, 1])

    await up[1].trigger('click')
    expect(wrapper.emitted('reorder')?.[1]).toEqual([1, 0])
  })

  it('emits adds one file at a time', async () => {
    const started: string[] = []
    let releaseFirst: () => void = () => {}
    const firstAdd = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const wrapper = mount(DpFrameUploader, {
      props: {
        frames: [],
        onAdd: async (dataUrl: string) => {
          started.push(dataUrl)
          if (started.length === 1) await firstAdd
        },
      },
    })

    const input = wrapper.get('input[type="file"]')
    const files = [
      new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }),
      new File([new Uint8Array([2])], 'two.png', { type: 'image/png' }),
    ]
    Object.defineProperty(input.element, 'files', { configurable: true, value: files })
    await input.trigger('change')
    await vi.waitFor(() => expect(started).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(started).toHaveLength(1)
    releaseFirst()
    await vi.waitFor(() => expect(started).toHaveLength(2))
    expect(started).toHaveLength(2)
  })
})

describe('DpFrameUploader tap targets', () => {
  it('keeps reorder and remove controls at 44px with no tiny text', () => {
    const wrapper = mount(DpFrameUploader, { props: { frames } })
    const html = wrapper.html()
    expect(html).not.toContain('text-[0.6rem]')
    for (const label of ['Move up', 'Move down', 'Remove frame']) {
      for (const button of wrapper.findAll(`[aria-label="${label}"]`)) {
        expect(button.classes().join(' ')).toContain('h-11')
        expect(button.classes().join(' ')).toContain('min-w-11')
      }
    }
  })
})

describe('DpFrameUploader booth mode', () => {
  const threeWindows = [
    { x: 100, y: 100, w: 880, h: 500 },
    { x: 100, y: 700, w: 880, h: 500 },
    { x: 100, y: 1300, w: 880, h: 500 },
  ]

  beforeEach(() => detectWindowsFromDataUrl.mockReset())

  async function pick(wrapper: ReturnType<typeof mount>) {
    const input = wrapper.get('input[type="file"]')
    const files = [new File([new Uint8Array([1])], 'booth.png', { type: 'image/png' })]
    Object.defineProperty(input.element, 'files', { configurable: true, value: files })
    await input.trigger('change')
  }

  it('shows the 1080x1920 hint', () => {
    const wrapper = mount(DpFrameUploader, { props: { frames: [], mode: 'booth' } })
    expect(wrapper.text()).toContain('1080×1920')
    expect(wrapper.text()).toContain('3 transparent')
  })

  it('emits add with the detected windows when exactly 3 are found', async () => {
    detectWindowsFromDataUrl.mockResolvedValue({ width: 1080, height: 1920, windows: threeWindows })
    const wrapper = mount(DpFrameUploader, { props: { frames: [], mode: 'booth' } })
    await pick(wrapper)
    await vi.waitFor(() => expect(wrapper.emitted('add')).toBeTruthy())
    expect(wrapper.emitted('add')![0][2]).toEqual(threeWindows)
  })

  it('passes windows through the parent onAdd handler too', async () => {
    detectWindowsFromDataUrl.mockResolvedValue({ width: 1080, height: 1920, windows: threeWindows })
    const onAdd = vi.fn()
    const wrapper = mount(DpFrameUploader, { props: { frames: [], mode: 'booth', onAdd } })
    await pick(wrapper)
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(onAdd.mock.calls[0][2]).toEqual(threeWindows)
  })

  it('blocks the upload and shows "We found 2 photo windows..." for 2', async () => {
    detectWindowsFromDataUrl.mockResolvedValue({ width: 1080, height: 1920, windows: threeWindows.slice(0, 2) })
    const wrapper = mount(DpFrameUploader, { props: { frames: [], mode: 'booth' } })
    await pick(wrapper)
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.get('[role="alert"]').text()).toBe('We found 2 photo windows. A booth frame needs exactly 3 separate transparent areas.')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('blocks a PNG that is not 1080x1920 with "Use a 1080×1920 PNG."', async () => {
    detectWindowsFromDataUrl.mockResolvedValue({ width: 1080, height: 1080, windows: threeWindows })
    const wrapper = mount(DpFrameUploader, { props: { frames: [], mode: 'booth' } })
    await pick(wrapper)
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.get('[role="alert"]').text()).toBe('Use a 1080×1920 PNG.')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('draws three numbered outlines over each thumbnail', () => {
    const wrapper = mount(DpFrameUploader, {
      props: { frames: [{ id: 'a', src: 'data:image/png;base64,aaaa', windows: threeWindows }], mode: 'booth' },
    })
    const outlines = wrapper.findAll('[data-booth-window]')
    expect(outlines).toHaveLength(3)
    expect(outlines.map((o) => o.text())).toEqual(['1', '2', '3'])
    expect(outlines[0].attributes('style')).toContain('left: 9.259')
    expect(wrapper.html()).toContain('aspect-[9/16]')
  })

  it('profile mode is unchanged', () => {
    const wrapper = mount(DpFrameUploader, { props: { frames } })
    expect(wrapper.text()).not.toContain('1080×1920')
    expect(wrapper.findAll('[data-booth-window]')).toHaveLength(0)
    expect(wrapper.find('.aspect-square').exists()).toBe(true)
  })
})
