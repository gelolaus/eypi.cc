// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DpFrameUploader from './DpFrameUploader.vue'

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
